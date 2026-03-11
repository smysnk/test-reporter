import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

export const id = 'node-test';
export const description = 'node:test adapter';

const reporterPath = path.resolve(import.meta.dirname, 'ndjson-reporter.js');

export function createNodeTestAdapter() {
  return {
    id,
    description,
    phase: 3,
    async run({ project, suite, execution }) {
      const commandSpec = parseCommandSpec(suite.command);
      const resolvedCommand = resolveNodeTestCommand(commandSpec, {
        cwd: suite.cwd || project.rootDir,
      });
      const primaryExecution = await executeNodeTestRun(resolvedCommand.commandSpec, {
        cwd: suite.cwd || project.rootDir,
        suiteEnv: mergeEnvRecords(suite.env, resolvedCommand.env),
        rawRelativePath: `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-node.ndjson`,
      });
      const parsed = parseNodeEvents(parseNdjson(primaryExecution.stdout), suite.cwd || project.rootDir);
      const warnings = [];
      let coverage = null;
      let coverageArtifact = null;

      if (execution?.coverage && suite?.coverage?.enabled !== false) {
        const coverageCommandSpec = suite?.coverage?.command
          ? parseCommandSpec(suite.coverage.command)
          : commandSpec;
        const resolvedCoverageCommand = resolveNodeTestCommand(coverageCommandSpec, {
          cwd: suite.cwd || project.rootDir,
        });

        if (!resolvedCoverageCommand.directNodeTest) {
          warnings.push(createUnsupportedCoverageWarning(Boolean(suite?.coverage?.command)));
        } else {
          const coverageExecution = await executeNodeTestRun(resolvedCoverageCommand.commandSpec, {
            cwd: suite.cwd || project.rootDir,
            enableCoverage: true,
            suiteEnv: mergeEnvRecords(suite.env, resolvedCoverageCommand.env),
            rawRelativePath: `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-node-coverage.ndjson`,
          });
          const coverageParsed = parseNodeEvents(parseNdjson(coverageExecution.stdout), suite.cwd || project.rootDir);
          coverage = coverageParsed.coverage;
          coverageArtifact = {
            relativePath: `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-node-coverage.ndjson`,
            content: coverageExecution.stdout,
          };
          if (coverageExecution.exitCode !== 0) {
            warnings.push('Coverage pass failed; coverage may be incomplete.');
          }
        }
      }

      return {
        status: deriveSuiteStatus(parsed.summary, primaryExecution.exitCode),
        durationMs: primaryExecution.durationMs,
        summary: parsed.summary,
        coverage,
        tests: parsed.tests,
        warnings,
        output: {
          stdout: primaryExecution.stdout,
          stderr: primaryExecution.stderr,
        },
        rawArtifacts: [
          {
            relativePath: `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-node.ndjson`,
            content: primaryExecution.stdout,
          },
          ...(coverageArtifact ? [coverageArtifact] : []),
        ],
      };
    },
  };
}

async function executeNodeTestRun(commandSpec, options) {
  const directNodeTest = isDirectNodeTestCommand(commandSpec);
  const env = resolveSuiteEnv(options.suiteEnv);
  let command = commandSpec.command;
  let args = [...commandSpec.args];

  if (directNodeTest) {
    args = withReporterArgs(args, { enableCoverage: Boolean(options.enableCoverage) });
  } else {
    env.NODE_OPTIONS = appendNodeOption(env.NODE_OPTIONS, `--test-reporter=${reporterPath}`);
  }

  return spawnCommand(command, args, {
    cwd: options.cwd,
    env,
  });
}

function parseCommandSpec(command) {
  if (Array.isArray(command) && command.length > 0) {
    return {
      command: String(command[0]),
      args: command.slice(1).map((entry) => String(entry)),
    };
  }

  if (typeof command === 'string' && command.trim().length > 0) {
    const tokens = tokenizeCommand(command);
    if (tokens.length === 0) {
      throw new Error('node:test adapter received an empty command string.');
    }
    return {
      command: tokens[0],
      args: tokens.slice(1),
    };
  }

  throw new Error('node:test adapter requires suite.command as a non-empty string or array.');
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

function isDirectNodeTestCommand(commandSpec) {
  const binary = normalizeBinaryName(commandSpec.command);
  return binary.startsWith('node') && commandSpec.args.includes('--test');
}

function resolveNodeTestCommand(commandSpec, options = {}) {
  const normalized = extractLeadingEnvAssignments(commandSpec);
  if (isDirectNodeTestCommand(normalized.commandSpec)) {
    return {
      commandSpec: normalized.commandSpec,
      env: normalized.env,
      directNodeTest: true,
    };
  }

  const packageScript = resolvePackageScriptNodeTestCommand(normalized.commandSpec, options);
  if (packageScript) {
    return {
      commandSpec: packageScript.commandSpec,
      env: mergeEnvRecords(normalized.env, packageScript.env),
      directNodeTest: true,
    };
  }

  return {
    commandSpec: normalized.commandSpec,
    env: normalized.env,
    directNodeTest: false,
  };
}

function resolvePackageScriptNodeTestCommand(commandSpec, options = {}) {
  const invocation = parsePackageScriptInvocation(commandSpec);
  if (!invocation) {
    return null;
  }

  const packageJsonPath = findClosestPackageJson(options.cwd);
  if (!packageJsonPath) {
    return null;
  }

  const seenScripts = options.seenScripts || new Set();
  const scriptKey = `${packageJsonPath}:${invocation.scriptName}`;
  if (seenScripts.has(scriptKey)) {
    return null;
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scriptValue = pkg?.scripts?.[invocation.scriptName];
  if (typeof scriptValue !== 'string' || scriptValue.trim().length === 0) {
    return null;
  }

  const scriptCommand = parseCommandSpec(scriptValue);
  if (containsShellControlTokens([scriptCommand.command, ...scriptCommand.args])) {
    return null;
  }

  const normalizedScript = extractLeadingEnvAssignments(scriptCommand);
  const scriptCommandSpec = appendForwardedArgs(normalizedScript.commandSpec, invocation.forwardedArgs);
  if (isDirectNodeTestCommand(scriptCommandSpec)) {
    return {
      commandSpec: scriptCommandSpec,
      env: normalizedScript.env,
    };
  }

  const nested = resolvePackageScriptNodeTestCommand(scriptCommandSpec, {
    cwd: path.dirname(packageJsonPath),
    seenScripts: new Set([...seenScripts, scriptKey]),
  });
  if (!nested) {
    return null;
  }

  return {
    commandSpec: nested.commandSpec,
    env: mergeEnvRecords(normalizedScript.env, nested.env),
  };
}

function extractLeadingEnvAssignments(commandSpec) {
  const tokens = [commandSpec.command, ...commandSpec.args];
  const env = {};
  let index = 0;

  while (index < tokens.length && isEnvAssignmentToken(tokens[index])) {
    const token = tokens[index];
    const equalsIndex = token.indexOf('=');
    env[token.slice(0, equalsIndex)] = token.slice(equalsIndex + 1);
    index += 1;
  }

  if (index >= tokens.length) {
    return {
      commandSpec,
      env,
    };
  }

  return {
    commandSpec: {
      command: tokens[index],
      args: tokens.slice(index + 1),
    },
    env,
  };
}

function parsePackageScriptInvocation(commandSpec) {
  const binary = normalizeBinaryName(commandSpec.command);
  const args = [...commandSpec.args];

  if (binary === 'yarn') {
    let scriptIndex = 0;
    if (args[0] === 'run') {
      scriptIndex = 1;
    }
    const scriptName = args[scriptIndex];
    if (!scriptName || scriptName.startsWith('-')) {
      return null;
    }
    return {
      manager: 'yarn',
      scriptName,
      forwardedArgs: normalizeForwardedArgs(args.slice(scriptIndex + 1)),
    };
  }

  if (binary === 'npm' || binary === 'pnpm') {
    if (args[0] !== 'run') {
      return null;
    }
    const scriptName = args[1];
    if (!scriptName || scriptName.startsWith('-')) {
      return null;
    }
    return {
      manager: binary,
      scriptName,
      forwardedArgs: normalizeForwardedArgs(args.slice(2)),
    };
  }

  return null;
}

function normalizeForwardedArgs(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return [];
  }
  if (args[0] === '--') {
    return args.slice(1);
  }
  return args;
}

function appendForwardedArgs(commandSpec, forwardedArgs) {
  if (!Array.isArray(forwardedArgs) || forwardedArgs.length === 0) {
    return commandSpec;
  }
  return {
    command: commandSpec.command,
    args: [...commandSpec.args, ...forwardedArgs],
  };
}

function findClosestPackageJson(startDir) {
  let current = path.resolve(startDir || process.cwd());
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function containsShellControlTokens(tokens) {
  return tokens.some((token) => ['&&', '||', ';', '|', '>', '>>', '<', '2>', '2>>', '2>&1'].includes(token));
}

function isEnvAssignmentToken(token) {
  return typeof token === 'string' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function normalizeBinaryName(command) {
  return path.basename(command || '').toLowerCase().replace(/\.cmd$/, '');
}

function createUnsupportedCoverageWarning(hasCoverageCommand) {
  if (hasCoverageCommand) {
    return 'Coverage pass skipped for suite.coverage.command because it did not resolve to a supported node:test pattern.';
  }
  return 'Coverage pass skipped for wrapped node:test command; use a direct node --test invocation, a supported yarn/npm/pnpm package script, or suite.coverage.command.';
}

function withReporterArgs(args, options = {}) {
  const filtered = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--test-reporter' || token === '--test-reporter-destination') {
      index += 1;
      continue;
    }
    if (token === '--experimental-test-coverage') {
      continue;
    }
    if (token.startsWith('--test-reporter=')) {
      continue;
    }
    if (token.startsWith('--test-reporter-destination=')) {
      continue;
    }
    filtered.push(token);
  }

  const testIndex = filtered.indexOf('--test');
  if (testIndex === -1) {
    throw new Error('node:test adapter requires a direct node --test command to inject the reporter.');
  }

  const injected = [...filtered];
  injected.splice(testIndex + 1, 0, `--test-reporter=${reporterPath}`);
  if (options.enableCoverage) {
    injected.splice(testIndex + 1, 0, '--experimental-test-coverage');
  }
  return injected;
}

function appendNodeOption(existing, option) {
  const prefix = typeof existing === 'string' && existing.trim().length > 0 ? `${existing.trim()} ` : '';
  return `${prefix}${option}`;
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

function parseNdjson(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function parseNodeEvents(events, workspaceDir) {
  const testsByKey = new Map();
  const summary = createSummary();
  let coverage = null;

  for (const event of events) {
    if (event.type === 'test:coverage' && event.data?.summary) {
      coverage = normalizeNodeCoverage(event.data.summary, workspaceDir);
      continue;
    }

    if (event.type === 'test:summary' && event.data?.counts) {
      summary.total = event.data.counts.tests || 0;
      summary.passed = event.data.counts.passed || 0;
      summary.failed = event.data.counts.failed || 0;
      summary.skipped = (event.data.counts.skipped || 0) + (event.data.counts.todo || 0);
      continue;
    }

    if (!['test:pass', 'test:fail', 'test:skip'].includes(event.type)) {
      continue;
    }

    const data = event.data || {};
    if (isNodeFileHarnessEvent(data, workspaceDir)) {
      continue;
    }

    const filePath = resolveMaybeRelative(workspaceDir, data.file);
    const key = [filePath, data.line, data.column, data.name, data.testNumber].join(':');
    testsByKey.set(key, {
      name: data.name,
      fullName: data.name,
      status: data.skip || event.type === 'test:skip'
        ? 'skipped'
        : event.type === 'test:pass'
          ? 'passed'
          : 'failed',
      durationMs: Number.isFinite(data.details?.duration_ms) ? Math.round(data.details.duration_ms) : 0,
      file: filePath,
      line: Number.isFinite(data.line) ? data.line : null,
      column: Number.isFinite(data.column) ? data.column : null,
      failureMessages: serializeNodeFailure(data.details?.error),
      rawDetails: data.details?.error ? { error: data.details.error } : {},
    });
  }

  return {
    coverage,
    summary: summary.total > 0 ? summary : summarizeTests(Array.from(testsByKey.values())),
    tests: Array.from(testsByKey.values()).sort(sortTests),
  };
}

function isNodeFileHarnessEvent(data, workspaceDir) {
  if (!data?.file || typeof data.name !== 'string') {
    return false;
  }
  const resolvedFile = realPathSafe(resolveMaybeRelative(workspaceDir, data.file));
  const resolvedName = realPathSafe(resolveMaybeRelative(workspaceDir, data.name));
  return resolvedFile === resolvedName || data.line === 1;
}

function resolveMaybeRelative(baseDir, filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }
  if (path.isAbsolute(filePath)) {
    return realPathSafe(filePath);
  }
  return realPathSafe(path.resolve(baseDir, filePath));
}

function realPathSafe(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

function serializeNodeFailure(error) {
  if (!error) {
    return [];
  }

  const messages = [];
  if (typeof error.message === 'string' && error.message.length > 0) {
    messages.push(error.message);
  }

  if (error.cause && typeof error.cause === 'object') {
    if (typeof error.cause.message === 'string' && error.cause.message.length > 0) {
      messages.push(error.cause.message);
    } else if ('expected' in error.cause || 'actual' in error.cause) {
      messages.push(`expected ${safePreview(error.cause.expected)} but received ${safePreview(error.cause.actual)}`);
    }
  }

  if (messages.length === 0) {
    messages.push(trimForReport(JSON.stringify(error, null, 2), 800));
  }

  return Array.from(new Set(messages));
}

function safePreview(value) {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeNodeCoverage(summary, workspaceDir) {
  const files = (summary.files || [])
    .map((entry) => ({
      path: realPathSafe(entry.path),
      lines: createCoverageMetric(entry.coveredLineCount, entry.totalLineCount),
      branches: createCoverageMetric(entry.coveredBranchCount, entry.totalBranchCount),
      functions: createCoverageMetric(entry.coveredFunctionCount, entry.totalFunctionCount),
      statements: null,
    }))
    .filter((entry) => shouldIncludeCoverageFile(entry.path, workspaceDir));

  return createCoverageSummary(files);
}

function shouldIncludeCoverageFile(filePath, workspaceDir) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }
  const resolved = realPathSafe(filePath);
  const workspaceRoot = realPathSafe(workspaceDir);
  if (!resolved.startsWith(workspaceRoot)) {
    return false;
  }
  if (
    /(^|\/)(node_modules|coverage|artifacts|playwright-report|test-results)(\/|$)/.test(resolved)
  ) {
    return false;
  }
  return true;
}

function createCoverageSummary(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return null;
  }

  return {
    lines: aggregateCoverageMetric(files, 'lines'),
    statements: aggregateCoverageMetric(files, 'statements'),
    functions: aggregateCoverageMetric(files, 'functions'),
    branches: aggregateCoverageMetric(files, 'branches'),
    files: files.sort((left, right) => {
      const leftPct = left.lines?.pct ?? 100;
      const rightPct = right.lines?.pct ?? 100;
      if (leftPct !== rightPct) {
        return leftPct - rightPct;
      }
      return left.path.localeCompare(right.path);
    }),
  };
}

function aggregateCoverageMetric(files, metricKey) {
  const valid = files.map((file) => file?.[metricKey]).filter((metric) => metric && Number.isFinite(metric.total));
  if (valid.length === 0) {
    return null;
  }
  const total = valid.reduce((sum, metric) => sum + metric.total, 0);
  const covered = valid.reduce((sum, metric) => sum + metric.covered, 0);
  return createCoverageMetric(covered, total);
}

function createCoverageMetric(covered, total) {
  if (!Number.isFinite(total)) {
    return null;
  }
  const safeTotal = Math.max(0, total);
  const safeCovered = Number.isFinite(covered) ? Math.max(0, Math.min(safeTotal, covered)) : 0;
  const pct = safeTotal === 0 ? 100 : Number(((safeCovered / safeTotal) * 100).toFixed(2));
  return {
    covered: safeCovered,
    total: safeTotal,
    pct,
  };
}

function summarizeTests(tests) {
  return tests.reduce((acc, entry) => {
    acc.total += 1;
    if (entry.status === 'failed') acc.failed += 1;
    else if (entry.status === 'skipped') acc.skipped += 1;
    else acc.passed += 1;
    return acc;
  }, createSummary());
}

function createSummary(values = {}) {
  return {
    total: Number.isFinite(values.total) ? values.total : 0,
    passed: Number.isFinite(values.passed) ? values.passed : 0,
    failed: Number.isFinite(values.failed) ? values.failed : 0,
    skipped: Number.isFinite(values.skipped) ? values.skipped : 0,
  };
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
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1)}…`;
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sanitizeEnv(env) {
  const nextEnv = { ...env };
  delete nextEnv.NODE_TEST_CONTEXT;
  return nextEnv;
}

function mergeEnvRecords(...records) {
  return records.reduce((merged, record) => ({
    ...merged,
    ...normalizeEnvRecord(record),
  }), {});
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
