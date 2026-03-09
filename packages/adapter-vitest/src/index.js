import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const id = 'vitest';
export const description = 'Vitest adapter';

export function createVitestAdapter() {
  return {
    id,
    description,
    phase: 3,
    async run({ project, suite, execution }) {
      const commandSpec = parseCommandSpec(suite.command);
      const slug = `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}`;
      const outputFile = path.join(project.rawDir, `${slug}-vitest.json`);
      const primary = await spawnCommand(commandSpec.command, appendVitestJsonArgs(commandSpec.args, outputFile), {
        cwd: suite.cwd || project.rootDir,
        env: resolveSuiteEnv(suite.env),
      });

      if (!fs.existsSync(outputFile)) {
        throw new Error(`Vitest adapter expected JSON report at ${outputFile}`);
      }

      const report = readJson(outputFile);
      const parsed = parseVitestReport(report);
      const warnings = [];
      let coverage = null;
      let coverageArtifact = null;

      if (execution?.coverage && suite?.coverage?.enabled !== false) {
        const coverageDir = path.join(project.rawDir, `${slug}-coverage`);
        const coverageReportFile = path.join(project.rawDir, `${slug}-vitest-coverage.json`);
        fs.rmSync(coverageDir, { recursive: true, force: true });
        const coverageExecution = await spawnCommand(commandSpec.command, appendVitestCoverageArgs(commandSpec.args, coverageReportFile, coverageDir), {
          cwd: suite.cwd || project.rootDir,
          env: resolveSuiteEnv(suite.env),
        });
        const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
        if (fs.existsSync(coverageSummaryPath)) {
          coverage = normalizeVitestCoverage(readJson(coverageSummaryPath), suite.cwd || project.rootDir);
          coverageArtifact = {
            relativePath: `${slug}-vitest-coverage-summary.json`,
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
            relativePath: `${slug}-vitest.json`,
            content: fs.readFileSync(outputFile, 'utf8'),
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
  throw new Error('Vitest adapter requires suite.command as a non-empty string or array.');
}

function appendVitestJsonArgs(args, outputFile) {
  const filtered = stripVitestManagedArgs(args);
  return [...filtered, '--reporter=json', `--outputFile=${outputFile}`];
}

function appendVitestCoverageArgs(args, outputFile, coverageDir) {
  const filtered = stripVitestManagedArgs(args);
  return [
    ...filtered,
    '--reporter=json',
    `--outputFile=${outputFile}`,
    '--coverage',
    '--coverage.provider=v8',
    '--coverage.reporter=json-summary',
    '--coverage.reportOnFailure',
    `--coverage.reportsDirectory=${coverageDir}`,
  ];
}

function stripVitestManagedArgs(args) {
  const filtered = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--reporter' || token === '--outputFile') {
      index += 1;
      continue;
    }
    if (token === '--coverage.provider' || token === '--coverage.reporter' || token === '--coverage.reportsDirectory') {
      index += 1;
      continue;
    }
    if (token === '--coverage' || token === '--coverage.reportOnFailure') {
      continue;
    }
    if (/^--reporter=/.test(token) || /^--outputFile=/.test(token) || /^--coverage(=|$)/.test(token)) {
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

function parseVitestReport(report) {
  const tests = [];
  for (const fileResult of report.testResults || []) {
    for (const assertion of fileResult.assertionResults || []) {
      tests.push({
        name: assertion.title,
        fullName: assertion.fullName || [...(assertion.ancestorTitles || []), assertion.title].join(' '),
        status: normalizeStatus(assertion.status),
        durationMs: Number.isFinite(assertion.duration) ? Math.round(assertion.duration) : 0,
        file: fileResult.name ? path.resolve(fileResult.name) : null,
        line: null,
        column: null,
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

function normalizeVitestCoverage(summary, workspaceDir) {
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
  if (!files.length) {
    return null;
  }
  return {
    lines: aggregateCoverageMetric(files, 'lines'),
    statements: aggregateCoverageMetric(files, 'statements'),
    functions: aggregateCoverageMetric(files, 'functions'),
    branches: aggregateCoverageMetric(files, 'branches'),
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function aggregateCoverageMetric(files, metricKey) {
  const valid = files.map((file) => file?.[metricKey]).filter((metric) => metric && Number.isFinite(metric.total));
  if (!valid.length) {
    return null;
  }
  return createCoverageMetric(
    valid.reduce((sum, metric) => sum + metric.covered, 0),
    valid.reduce((sum, metric) => sum + metric.total, 0),
  );
}

function createCoverageMetric(covered, total) {
  if (!Number.isFinite(total)) {
    return null;
  }
  const safeTotal = Math.max(0, total);
  const safeCovered = Number.isFinite(covered) ? Math.max(0, Math.min(safeTotal, covered)) : 0;
  return {
    covered: safeCovered,
    total: safeTotal,
    pct: safeTotal === 0 ? 100 : Number(((safeCovered / safeTotal) * 100).toFixed(2)),
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
  if (status === 'skipped' || status === 'pending' || status === 'todo') return 'skipped';
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
  return left.name.localeCompare(right.name);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
