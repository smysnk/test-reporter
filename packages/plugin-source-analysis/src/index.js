import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

export const id = 'source-analysis';
export const description = 'Enriches test results with assertions, setup, mocks, and source snippets extracted from test files.';

export function createSourceAnalysisPlugin(options = {}) {
  const cache = new Map();
  const config = {
    includeSharedSetup: options.includeSharedSetup !== false,
    includeSharedMocks: options.includeSharedMocks !== false,
    includeSourceSnippet: options.includeSourceSnippet !== false,
  };

  return {
    id,
    description,
    phase: 5,
    async enrichTest({ test }) {
      if (!test?.file || !looksLikeJavaScriptFile(test.file)) {
        return null;
      }

      const analysis = analyzeTestFile(test.file, cache);
      if (!analysis) {
        return null;
      }

      const matched = matchAnalyzedTest(analysis, test);
      const sharedSetup = config.includeSharedSetup
        ? analysis.sharedSetup.map((entry) => entry.summary)
        : [];
      const sharedMocks = config.includeSharedMocks
        ? analysis.sharedMocks.map((entry) => entry.summary)
        : [];

      const patch = {
        rawDetails: {
          sourceAnalysis: {
            file: analysis.filePath,
            matched: Boolean(matched),
          },
        },
      };

      if (matched) {
        patch.assertions = matched.assertions || [];
        patch.setup = [
          ...sharedSetup,
          ...(matched.setup || []).map((entry) => entry.summary),
        ];
        patch.mocks = [
          ...sharedMocks,
          ...(matched.mocks || []).map((entry) => entry.summary),
        ];
        if (config.includeSourceSnippet && matched.snippet) {
          patch.sourceSnippet = matched.snippet;
        }
        if (!test.fullName && matched.fullName) {
          patch.fullName = matched.fullName;
        }
      } else {
        patch.setup = sharedSetup;
        patch.mocks = sharedMocks;
      }

      return patch;
    },
  };
}

function analyzeTestFile(filePath, cache) {
  const resolvedPath = realPathSafe(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }
  if (cache.has(resolvedPath)) {
    return cache.get(resolvedPath);
  }

  const source = fs.readFileSync(resolvedPath, 'utf8');
  const ast = parseSource(source);
  if (!ast) {
    cache.set(resolvedPath, null);
    return null;
  }

  const analysis = {
    filePath: resolvedPath,
    source,
    lines: source.split(/\r?\n/),
    sharedSetup: [],
    sharedMocks: [],
    tests: [],
  };

  traverseNode(ast, analysis, { titles: [], currentTest: null });
  cache.set(resolvedPath, analysis);
  return analysis;
}

function parseSource(source) {
  const parseOptions = {
    ecmaVersion: 'latest',
    locations: true,
    allowHashBang: true,
  };

  try {
    return acorn.parse(source, {
      ...parseOptions,
      sourceType: 'module',
    });
  } catch {
    try {
      return acorn.parse(source, {
        ...parseOptions,
        sourceType: 'script',
      });
    } catch {
      return null;
    }
  }
}

function traverseNode(node, analysis, context) {
  if (!node || typeof node.type !== 'string') {
    return;
  }

  if (node.type === 'CallExpression') {
    const classification = classifyCall(node.callee);
    const callback = getCallbackFunction(node.arguments || []);
    const title = getCallTitle(node.arguments || []);

    if (classification === 'describe' && callback?.body?.type === 'BlockStatement') {
      const nextContext = {
        ...context,
        titles: title ? [...context.titles, title] : [...context.titles],
      };
      for (const statement of callback.body.body) {
        traverseNode(statement, analysis, nextContext);
      }
      return;
    }

    if (classification === 'hook') {
      const entry = {
        summary: summarizeHook(node, analysis),
        snippet: extractSnippet(node, analysis),
      };
      if (context.currentTest) {
        context.currentTest.setup.push(entry);
      } else {
        analysis.sharedSetup.push(entry);
      }
      if (callback?.body?.type === 'BlockStatement') {
        for (const statement of callback.body.body) {
          traverseNode(statement, analysis, context);
        }
      }
      return;
    }

    if (classification === 'test') {
      const resolvedTitle = title || dynamicLabel('test');
      const record = {
        title: resolvedTitle,
        fullName: [...context.titles, resolvedTitle].join(' '),
        line: node.loc?.start?.line || null,
        column: (node.loc?.start?.column || 0) + 1,
        snippet: extractSnippet(node, analysis),
        assertions: [],
        setup: [],
        mocks: [],
      };
      analysis.tests.push(record);
      if (callback?.body?.type === 'BlockStatement') {
        for (const statement of callback.body.body) {
          traverseNode(statement, analysis, {
            ...context,
            currentTest: record,
          });
        }
      }
      return;
    }

    if (context.currentTest) {
      if (isAssertionCall(node)) {
        context.currentTest.assertions.push(trimForReport(extractSnippet(node, analysis), 240));
      }
      const mockSummary = summarizeMock(node);
      if (mockSummary) {
        context.currentTest.mocks.push({
          summary: mockSummary,
          snippet: extractSnippet(node, analysis),
        });
      }
    } else {
      const sharedMock = summarizeMock(node);
      if (sharedMock) {
        analysis.sharedMocks.push({
          summary: sharedMock,
          snippet: extractSnippet(node, analysis),
        });
      }
    }
  }

  for (const value of Object.values(node)) {
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.type === 'string') {
          traverseNode(item, analysis, context);
        }
      }
      continue;
    }
    if (value && typeof value.type === 'string') {
      traverseNode(value, analysis, context);
    }
  }
}

function classifyCall(callee) {
  const chain = getCalleeChain(callee);
  if (chain.length === 0) {
    return null;
  }
  if (chain[0] === 'describe' || (chain[0] === 'test' && chain.includes('describe'))) {
    return 'describe';
  }
  if (['beforeEach', 'beforeAll', 'afterEach', 'afterAll'].includes(chain[0])) {
    return 'hook';
  }
  if (['test', 'it'].includes(chain[0])) {
    return 'test';
  }
  return null;
}

function getCalleeChain(node) {
  if (!node) {
    return [];
  }
  if (node.type === 'Identifier') {
    return [node.name];
  }
  if (node.type === 'MemberExpression' && !node.computed) {
    return [...getCalleeChain(node.object), node.property.name];
  }
  return [];
}

function getCallbackFunction(args) {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const arg = args[index];
    if (arg?.type === 'ArrowFunctionExpression' || arg?.type === 'FunctionExpression') {
      return arg;
    }
  }
  return null;
}

function getCallTitle(args) {
  const first = args[0];
  if (!first) {
    return null;
  }
  if (first.type === 'Literal' && typeof first.value === 'string') {
    return first.value;
  }
  if (first.type === 'TemplateLiteral' && first.expressions.length === 0) {
    return first.quasis.map((part) => part.value.cooked || '').join('');
  }
  return null;
}

function dynamicLabel(kind) {
  return `[dynamic ${kind}]`;
}

function isAssertionCall(node) {
  const chain = getCalleeChain(node.callee);
  if (chain[0] === 'expect' || chain[0] === 'assert') {
    return true;
  }
  return chain[0] === 't' && chain.length > 1;
}

function summarizeMock(node) {
  const chain = getCalleeChain(node.callee);
  if ((chain[0] === 'vi' || chain[0] === 'jest') && chain[1] === 'mock') {
    return `mock module ${getLiteralPreview(node.arguments?.[0])}`;
  }
  if (chain[0] === 'vi' && chain[1] === 'spyOn') {
    return `spyOn ${getLiteralPreview(node.arguments?.[0])}.${getLiteralPreview(node.arguments?.[1])}`;
  }
  if (chain[0] === 'mock' && chain[1] === 'module') {
    return `mock module ${getLiteralPreview(node.arguments?.[0])}`;
  }
  return null;
}

function summarizeHook(node, analysis) {
  const chain = getCalleeChain(node.callee);
  const label = chain[0] || 'hook';
  return `${label}: ${trimForReport(extractSnippet(node, analysis), 200)}`;
}

function getLiteralPreview(node) {
  if (!node) {
    return '<dynamic>';
  }
  if (node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : String(node.value);
  }
  if (node.type === 'Identifier') {
    return node.name;
  }
  return '<dynamic>';
}

function extractSnippet(node, analysis) {
  if (!node?.loc) {
    return '';
  }
  const startLine = Math.max(1, node.loc.start.line);
  const endLine = Math.min(analysis.lines.length, node.loc.end.line);
  const snippet = analysis.lines.slice(startLine - 1, endLine).join('\n').trim();
  return trimForReport(snippet, 320);
}

function matchAnalyzedTest(analysis, test) {
  if (Number.isFinite(test.line)) {
    const byLine = analysis.tests.find((entry) => entry.line === test.line);
    if (byLine) {
      return byLine;
    }
  }
  if (typeof test.fullName === 'string' && test.fullName.length > 0) {
    return analysis.tests.find((entry) => entry.fullName === test.fullName)
      || analysis.tests.find((entry) => entry.title === test.name);
  }
  return analysis.tests.find((entry) => entry.title === test.name) || null;
}

function looksLikeJavaScriptFile(filePath) {
  return /\.[cm]?[jt]sx?$/.test(String(filePath || ''));
}

function realPathSafe(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

function trimForReport(value, maxLength) {
  const input = String(value || '').trim();
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
