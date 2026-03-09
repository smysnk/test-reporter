import path from 'node:path';
import { spawn } from 'node:child_process';

export const id = 'playwright';
export const description = 'Playwright adapter';

export function createPlaywrightAdapter() {
  return {
    id,
    description,
    phase: 3,
    async run({ project, suite }) {
      const commandSpec = parseCommandSpec(suite.command);
      const execution = await spawnCommand(commandSpec.command, appendPlaywrightJsonArgs(commandSpec.args), {
        cwd: suite.cwd || project.rootDir,
        env: resolveSuiteEnv(suite.env),
      });

      const payload = extractJsonPayload(execution.stdout || execution.stderr);
      const parsed = parsePlaywrightReport(payload, suite.cwd || project.rootDir);

      return {
        status: deriveSuiteStatus(parsed.summary, execution.exitCode),
        durationMs: execution.durationMs,
        summary: parsed.summary,
        coverage: null,
        tests: parsed.tests,
        warnings: [],
        output: {
          stdout: execution.stdout,
          stderr: execution.stderr,
        },
        rawArtifacts: [
          {
            relativePath: `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-playwright.json`,
            content: JSON.stringify(payload, null, 2),
          },
        ],
      };
    },
  };
}

function parseCommandSpec(command) {
  if (Array.isArray(command) && command.length > 0) {
    return { command: String(command[0]), args: command.slice(1).map((entry) => String(entry)) };
  }
  if (typeof command === 'string' && command.trim().length > 0) {
    const tokens = tokenizeCommand(command);
    return { command: tokens[0], args: tokens.slice(1) };
  }
  throw new Error('Playwright adapter requires suite.command as a non-empty string or array.');
}

function appendPlaywrightJsonArgs(args) {
  const filtered = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--reporter') {
      index += 1;
      continue;
    }
    if (token.startsWith('--reporter=')) {
      continue;
    }
    filtered.push(token);
  }
  return [...filtered, '--reporter=json'];
}

function tokenizeCommand(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && quote === '"' && index + 1 < command.length) {
        current += command[index + 1];
        index += 1;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function spawnCommand(command, args, options) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      stderr += `${error.message}\n`;
      resolve({ exitCode: 1, stdout, stderr, durationMs: Date.now() - startedAt });
    });
    child.on('close', (code) => {
      resolve({
        exitCode: Number.isInteger(code) ? code : 1,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function extractJsonPayload(text) {
  const value = String(text || '').trim();
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(value.slice(start, end + 1));
    }
    throw new Error('Playwright adapter could not parse JSON reporter output.');
  }
}

function parsePlaywrightReport(report, workspaceDir) {
  const tests = [];
  const rootDir = report.config?.rootDir ? path.resolve(report.config.rootDir) : path.resolve(workspaceDir);
  for (const suite of report.suites || []) {
    collectPlaywrightTests(suite, [], tests, rootDir);
  }
  return {
    summary: createSummary({
      total: tests.length,
      passed: tests.filter((test) => test.status === 'passed').length,
      failed: tests.filter((test) => test.status === 'failed').length,
      skipped: tests.filter((test) => test.status === 'skipped').length,
    }),
    tests: tests.sort(sortTests),
  };
}

function collectPlaywrightTests(suite, titleTrail, bucket, rootDir) {
  const nextTrail = suite.title && !suite.title.endsWith('.spec.js') ? [...titleTrail, suite.title] : titleTrail;
  for (const spec of suite.specs || []) {
    const latestTest = spec.tests?.[spec.tests.length - 1];
    const latestResult = latestTest?.results?.[latestTest.results.length - 1] || {};
    const errors = (latestResult.errors || []).map((error) => {
      if (typeof error?.message === 'string' && error.message.length > 0) {
        return trimForReport(error.message, 1000);
      }
      return trimForReport(JSON.stringify(error, null, 2), 1000);
    });
    bucket.push({
      name: spec.title,
      fullName: [...nextTrail, spec.title].join(' '),
      status: normalizeStatus(latestResult.status || latestTest?.status || 'passed'),
      durationMs: Number.isFinite(latestResult.duration) ? latestResult.duration : 0,
      file: spec.file ? path.resolve(rootDir, spec.file) : null,
      line: Number.isFinite(spec.line) ? spec.line : null,
      column: Number.isFinite(spec.column) ? spec.column : null,
      failureMessages: errors,
      rawDetails: {
        retries: Array.isArray(latestTest?.results) ? latestTest.results.length - 1 : 0,
      },
    });
  }
  for (const child of suite.suites || []) {
    collectPlaywrightTests(child, nextTrail, bucket, rootDir);
  }
}

function createSummary(values = {}) {
  return {
    total: Number.isFinite(values.total) ? values.total : 0,
    passed: Number.isFinite(values.passed) ? values.passed : 0,
    failed: Number.isFinite(values.failed) ? values.failed : 0,
    skipped: Number.isFinite(values.skipped) ? values.skipped : 0,
  };
}

function normalizeStatus(status) {
  if (status === 'passed' || status === 'expected') return 'passed';
  if (status === 'pending' || status === 'skipped' || status === 'todo') return 'skipped';
  return 'failed';
}

function deriveSuiteStatus(summary, exitCode) {
  if (exitCode !== 0 || summary.failed > 0) {
    return 'failed';
  }
  if (summary.total === 0 || summary.skipped === summary.total) {
    return 'skipped';
  }
  return 'passed';
}

function sortTests(left, right) {
  const leftFile = left.file || '';
  const rightFile = right.file || '';
  if (leftFile !== rightFile) {
    return leftFile.localeCompare(rightFile);
  }
  if ((left.line || 0) !== (right.line || 0)) {
    return (left.line || 0) - (right.line || 0);
  }
  return left.name.localeCompare(right.name);
}

function trimForReport(value, limit) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sanitizeEnv(env) {
  const nextEnv = { ...env };
  delete nextEnv.NODE_TEST_CONTEXT;
  return nextEnv;
}

function resolveSuiteEnv(suiteEnv) {
  return {
    ...sanitizeEnv(process.env),
    ...normalizeEnvRecord(suiteEnv),
  };
}

function normalizeEnvRecord(env) {
  if (!env || typeof env !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === null) {
      continue;
    }
    normalized[key] = String(value);
  }
  return normalized;
}
