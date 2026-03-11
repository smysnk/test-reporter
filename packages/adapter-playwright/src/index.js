import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import istanbulCoverage from 'istanbul-lib-coverage';

export const id = 'playwright';
export const description = 'Playwright adapter';

const { createCoverageMap } = istanbulCoverage;

export function createPlaywrightAdapter() {
  return {
    id,
    description,
    phase: 8,
    async run({ project, suite, execution: executionOptions }) {
      const commandSpec = parseCommandSpec(suite.command);
      const browserCoverageEnabled = shouldCollectBrowserCoverage({
        execution: executionOptions,
        suite,
      });
      const coverageDir = browserCoverageEnabled
        ? fs.mkdtempSync(
            path.join(
              os.tmpdir(),
              `test-station-playwright-coverage-${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-`
            )
          )
        : null;
      const commandExecution = await spawnCommand(commandSpec.command, appendPlaywrightJsonArgs(commandSpec.args), {
        cwd: suite.cwd || project.rootDir,
        env: resolveSuiteEnv({
          ...(suite.env || {}),
          ...(browserCoverageEnabled
            ? {
                PLAYWRIGHT_BROWSER_COVERAGE: '1',
                PLAYWRIGHT_BROWSER_COVERAGE_DIR: coverageDir,
              }
            : {}),
        }),
      });

      const payload = extractJsonPayload(commandExecution.stdout || commandExecution.stderr);
      const parsed = parsePlaywrightReport(payload, suite.cwd || project.rootDir);
      const rawArtifacts = [
        {
          relativePath: `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-playwright.json`,
          content: JSON.stringify(payload, null, 2),
        },
      ];
      const warnings = [];
      let coverage = null;

      if (browserCoverageEnabled && coverageDir) {
        const coverageArtifactBase = `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-playwright-coverage`;
        coverage = mergeBrowserCoverage({
          coverageDir,
          packageName: suite.packageName || null,
          coverageRootDir: suite.cwd || project.rootDir,
          projectRootDir: project.rootDir,
        });

        rawArtifacts.push({
          relativePath: coverageArtifactBase,
          sourcePath: coverageDir,
          kind: 'directory',
        });

        if (coverage) {
          const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
          const mergedCoveragePath = path.join(coverageDir, 'merged-coverage.json');
          fs.writeFileSync(coverageSummaryPath, `${JSON.stringify(coverage, null, 2)}\n`);
          fs.writeFileSync(mergedCoveragePath, `${JSON.stringify(buildMergedCoveragePayload(coverageDir), null, 2)}\n`);
          rawArtifacts.push({
            relativePath: `${coverageArtifactBase}/coverage-summary.json`,
            sourcePath: coverageSummaryPath,
          });
          rawArtifacts.push({
            relativePath: `${coverageArtifactBase}/merged-coverage.json`,
            sourcePath: mergedCoveragePath,
          });
        } else {
          warnings.push('Browser coverage was requested, but no window.__coverage__ payloads were collected.');
        }
      }

      return {
        status: deriveSuiteStatus(parsed.summary, commandExecution.exitCode),
        durationMs: commandExecution.durationMs,
        summary: parsed.summary,
        coverage,
        tests: parsed.tests,
        warnings,
        output: {
          stdout: commandExecution.stdout,
          stderr: commandExecution.stderr,
        },
        rawArtifacts,
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

function shouldCollectBrowserCoverage(context) {
  return Boolean(
    context?.execution?.coverage
      && context?.suite?.coverage?.enabled !== false
      && context?.suite?.coverage?.strategy === 'browser-istanbul'
  );
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

function mergeBrowserCoverage(options) {
  const payloads = readCoveragePayloads(options.coverageDir);
  if (payloads.length === 0) {
    return null;
  }

  const coverageMap = createCoverageMap({});
  for (const payload of payloads) {
    const pageEntries = Array.isArray(payload.pages) ? payload.pages : [];
    for (const pageEntry of pageEntries) {
      if (pageEntry?.coverage && typeof pageEntry.coverage === 'object') {
        coverageMap.merge(pageEntry.coverage);
      }
    }
  }

  const files = coverageMap.files()
    .map((filePath) => normalizeCoverageFileEntry(coverageMap, filePath, options))
    .filter(Boolean)
    .sort((left, right) => left.path.localeCompare(right.path));

  if (files.length === 0) {
    return null;
  }

  return normalizeCoverageSummary({ files }, options.packageName || null);
}

function buildMergedCoveragePayload(coverageDir) {
  const payloads = readCoveragePayloads(coverageDir);
  const coverageMap = createCoverageMap({});
  for (const payload of payloads) {
    for (const pageEntry of payload.pages || []) {
      if (pageEntry?.coverage && typeof pageEntry.coverage === 'object') {
        coverageMap.merge(pageEntry.coverage);
      }
    }
  }
  return coverageMap.toJSON();
}

function readCoveragePayloads(coverageDir) {
  if (!coverageDir || !fs.existsSync(coverageDir)) {
    return [];
  }

  return fs.readdirSync(coverageDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .filter((fileName) => !['coverage-summary.json', 'merged-coverage.json'].includes(fileName))
    .map((fileName) => path.join(coverageDir, fileName))
    .map((filePath) => {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeCoverageFileEntry(coverageMap, filePath, options = {}) {
  const normalizedPath = normalizeSourcePath(filePath, options.projectRootDir);
  if (options.coverageRootDir && !isWithinDirectory(normalizedPath, options.coverageRootDir)) {
    return null;
  }

  const summary = coverageMap.fileCoverageFor(filePath).toSummary();
  return {
    path: normalizedPath,
    lines: createCoverageMetric(summary.lines?.covered, summary.lines?.total),
    statements: createCoverageMetric(summary.statements?.covered, summary.statements?.total),
    functions: createCoverageMetric(summary.functions?.covered, summary.functions?.total),
    branches: createCoverageMetric(summary.branches?.covered, summary.branches?.total),
    packageName: options.packageName || null,
  };
}

function normalizeCoverageSummary(coverage, packageName = null) {
  if (!coverage) {
    return null;
  }

  const files = Array.isArray(coverage.files)
    ? coverage.files.map((file) => ({
        path: file.path,
        lines: file.lines || null,
        statements: file.statements || null,
        functions: file.functions || null,
        branches: file.branches || null,
        packageName: file.packageName || packageName || null,
      }))
    : [];

  return {
    lines: coverage.lines || aggregateCoverageMetric(files, 'lines'),
    statements: coverage.statements || aggregateCoverageMetric(files, 'statements'),
    functions: coverage.functions || aggregateCoverageMetric(files, 'functions'),
    branches: coverage.branches || aggregateCoverageMetric(files, 'branches'),
    files,
  };
}

function aggregateCoverageMetric(files, metricKey) {
  const valid = files
    .map((file) => file?.[metricKey])
    .filter((metric) => metric && Number.isFinite(metric.total));

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

function normalizeSourcePath(filePath, projectRootDir) {
  let nextPath = String(filePath || '');
  nextPath = nextPath.replace(/^file:\/\//, '');
  nextPath = nextPath.replace(/^webpack:\/\/_N_E\//, '');
  nextPath = nextPath.replace(/^webpack:\/\//, '');
  nextPath = nextPath.replace(/^\.\//, '');
  nextPath = nextPath.split('?')[0];
  nextPath = nextPath.split('#')[0];

  if (path.isAbsolute(nextPath)) {
    return path.normalize(nextPath);
  }

  return path.resolve(projectRootDir || process.cwd(), nextPath);
}

function isWithinDirectory(targetPath, rootDir) {
  const relative = path.relative(rootDir, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
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
