import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const id = 'jest';
export const description = 'Jest adapter';

export function createJestAdapter() {
  return {
    id,
    description,
    phase: 3,
    async run({ project, suite, execution }) {
      const commandSpec = parseCommandSpec(suite.command);
      const slug = `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}`;
      const outputFile = path.join(project.rawDir, `${slug}-jest.json`);
      const primary = await spawnCommand(commandSpec.command, appendJestJsonArgs(commandSpec.args, outputFile), {
        cwd: suite.cwd || project.rootDir,
        env: resolveSuiteEnv(suite.env),
      });

      const report = readPrimaryReport(outputFile, primary);
      const parsed = parseJestReport(report);
      const warnings = [];
      let coverage = null;
      let coverageArtifact = null;

      if (execution?.coverage && suite?.coverage?.enabled !== false) {
        const coverageDir = path.join(project.rawDir, `${slug}-coverage`);
        const coverageReportFile = path.join(project.rawDir, `${slug}-jest-coverage.json`);
        fs.rmSync(coverageDir, { recursive: true, force: true });
        const coverageExecution = await spawnCommand(commandSpec.command, appendJestCoverageArgs(commandSpec.args, coverageReportFile, coverageDir), {
          cwd: suite.cwd || project.rootDir,
          env: resolveSuiteEnv(suite.env),
        });
        const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
        if (fs.existsSync(coverageSummaryPath)) {
          coverage = normalizeJestCoverage(readJson(coverageSummaryPath), suite.cwd || project.rootDir);
          coverageArtifact = {
            relativePath: `${slug}-jest-coverage-summary.json`,
            content: fs.readFileSync(coverageSummaryPath, 'utf8'),
          };
        }
        if (coverageExecution.exitCode !== 0) {
          warnings.push('Coverage pass failed; runtime results still reflect the non-coverage test run.');
        }
      }

      return {
        status: deriveSuiteStatus(parsed.summary, primary.exitCode),
        durationMs: primary.durationMs,
        summary: parsed.summary,
        coverage,
        tests: parsed.tests,
        warnings,
        output: {
          stdout: primary.stdout,
          stderr: primary.stderr,
        },
        rawArtifacts: [
          {
            relativePath: `${slug}-jest.json`,
            content: JSON.stringify(report, null, 2),
          },
          ...(coverageArtifact ? [coverageArtifact] : []),
        ],
      };
    },
  };
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
    return {
      command: tokens[0],
      args: tokens.slice(1),
    };
  }
  throw new Error('Jest adapter requires suite.command as a non-empty string or array.');
}

function appendJestJsonArgs(args, outputFile) {
  const filtered = stripJestManagedArgs(args);
  return [...filtered, '--json', `--outputFile=${outputFile}`];
}

function appendJestCoverageArgs(args, outputFile, coverageDir) {
  const filtered = stripJestManagedArgs(args);
  return [
    ...filtered,
    '--json',
    `--outputFile=${outputFile}`,
    '--coverage',
    '--coverageReporters=json-summary',
    `--coverageDirectory=${coverageDir}`,
  ];
}

function stripJestManagedArgs(args) {
  const filtered = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (
      token === '--json'
      || token === '--coverage'
      || token === '--coverageReporters'
      || token === '--coverageDirectory'
      || token === '--outputFile'
    ) {
      if (token !== '--json' && token !== '--coverage') {
        index += 1;
      }
      continue;
    }
    if (
      token.startsWith('--outputFile=')
      || token.startsWith('--coverageReporters=')
      || token.startsWith('--coverageDirectory=')
    ) {
      continue;
    }
    filtered.push(token);
  }
  return filtered;
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

function readPrimaryReport(outputFile, execution) {
  if (fs.existsSync(outputFile)) {
    return readJson(outputFile);
  }
  const payload = parseJsonSafe(execution.stdout) || parseJsonSafe(execution.stderr);
  if (payload) {
    return payload;
  }
  throw new Error(`Jest adapter expected JSON report at ${outputFile}`);
}

function parseJestReport(report) {
  const tests = [];
  for (const fileResult of report.testResults || []) {
    for (const assertion of fileResult.assertionResults || []) {
      const location = assertion.location && typeof assertion.location === 'object' ? assertion.location : {};
      tests.push({
        name: assertion.title,
        fullName: assertion.fullName || [...(assertion.ancestorTitles || []), assertion.title].join(' '),
        status: normalizeStatus(assertion.status),
        durationMs: Number.isFinite(assertion.duration) ? Math.round(assertion.duration) : 0,
        file: fileResult.name ? path.resolve(fileResult.name) : null,
        line: Number.isFinite(location.line) ? location.line : null,
        column: Number.isFinite(location.column) ? location.column : null,
        failureMessages: Array.isArray(assertion.failureMessages)
          ? assertion.failureMessages.filter(Boolean).map((message) => trimForReport(message, 1000))
          : [],
        rawDetails: assertion.meta && Object.keys(assertion.meta).length > 0 ? { meta: assertion.meta } : {},
      });
    }
  }

  return {
    summary: createSummary({
      total: report.numTotalTests || tests.length,
      passed: report.numPassedTests || tests.filter((test) => test.status === 'passed').length,
      failed: report.numFailedTests || tests.filter((test) => test.status === 'failed').length,
      skipped: (report.numPendingTests || 0) + (report.numTodoTests || 0),
    }),
    tests: tests.sort(sortTests),
  };
}

function normalizeJestCoverage(summary, workspaceDir) {
  const files = Object.entries(summary)
    .filter(([filePath]) => filePath !== 'total')
    .map(([filePath, metrics]) => ({
      path: path.resolve(filePath),
      lines: createCoverageMetric(metrics.lines?.covered, metrics.lines?.total),
      statements: createCoverageMetric(metrics.statements?.covered, metrics.statements?.total),
      functions: createCoverageMetric(metrics.functions?.covered, metrics.functions?.total),
      branches: createCoverageMetric(metrics.branches?.covered, metrics.branches?.total),
    }))
    .filter((entry) => shouldIncludeCoverageFile(entry.path, workspaceDir));

  return createCoverageSummary(files);
}

function shouldIncludeCoverageFile(filePath, workspaceDir) {
  const resolved = path.resolve(filePath);
  const workspaceRoot = path.resolve(workspaceDir);
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
  const totals = files.reduce((accumulator, file) => {
    accumulator.lines.covered += file.lines.covered;
    accumulator.lines.total += file.lines.total;
    accumulator.branches.covered += file.branches.covered;
    accumulator.branches.total += file.branches.total;
    accumulator.functions.covered += file.functions.covered;
    accumulator.functions.total += file.functions.total;
    accumulator.statements.covered += file.statements.covered;
    accumulator.statements.total += file.statements.total;
    return accumulator;
  }, {
    lines: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    statements: { covered: 0, total: 0 },
  });

  return {
    lines: createCoverageMetric(totals.lines.covered, totals.lines.total),
    branches: createCoverageMetric(totals.branches.covered, totals.branches.total),
    functions: createCoverageMetric(totals.functions.covered, totals.functions.total),
    statements: createCoverageMetric(totals.statements.covered, totals.statements.total),
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function createCoverageMetric(covered, total) {
  const safeCovered = Number.isFinite(covered) ? covered : 0;
  const safeTotal = Number.isFinite(total) ? total : 0;
  return {
    covered: safeCovered,
    total: safeTotal,
    pct: safeTotal > 0 ? Number(((safeCovered / safeTotal) * 100).toFixed(2)) : 100,
  };
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
  if (status === 'passed') return 'passed';
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

function parseJsonSafe(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
