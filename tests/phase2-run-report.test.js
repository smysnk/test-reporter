import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildReportFromSuiteResults, formatConsoleSummary, readJson, runReport } from '@test-station/core';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'phase2');
const fixtureConfigPath = path.join(fixtureDir, 'test-station.fixture.config.mjs');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.js');

function createTempOutputDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `test-station-${label}-`));
}

test('runReport executes configured suites and writes artifacts', async () => {
  const outputDir = createTempOutputDir('phase2-run-report');

  const execution = await runReport({
    configPath: fixtureConfigPath,
    outputDir,
    writeArtifacts: true,
  });

  assert.equal(execution.report.schemaVersion, '1');
  assert.equal(execution.report.summary.totalPackages, 2);
  assert.equal(execution.report.summary.totalSuites, 2);
  assert.equal(execution.report.summary.totalTests, 3);
  assert.equal(execution.report.summary.failedTests, 1);
  assert.deepEqual(execution.report.summary.filterOptions.modules.sort(), ['editor', 'filesystem', 'runtime']);
  assert.equal(fs.existsSync(execution.artifactPaths.reportJsonPath), true);
  assert.equal(execution.artifactPaths.rawSuitePaths.length >= 4, true);
  assert.equal(execution.context.project.outputDir, outputDir);

  const storedReport = readJson(execution.artifactPaths.reportJsonPath);
  assert.equal(storedReport.summary.failedPackages, 1);
  assert.equal(Array.isArray(storedReport.performanceStats), true);
  assert.equal(storedReport.performanceStats.length, 1);
  assert.deepEqual(storedReport.performanceStats[0], {
    scope: 'suite',
    suiteIdentifier: 'app-unit',
    testIdentifier: null,
    statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
    statName: 'elapsed_ms',
    unit: 'ms',
    numericValue: 12.34,
    textValue: null,
    metadata: {
      packageName: 'app',
      suiteLabel: 'App Unit',
      runtime: 'custom',
      seriesId: 'interpreter',
      engineId: 'interpreter',
      statistic: 'median',
    },
  });

  const rawSuitePath = execution.artifactPaths.rawSuitePaths.find((entry) => entry.endsWith('app-app-unit.json'));
  assert.equal(typeof rawSuitePath, 'string');
  const rawSuite = readJson(rawSuitePath);
  assert.equal(Array.isArray(rawSuite.performanceStats), true);
  assert.deepEqual(rawSuite.performanceStats[0], {
    scope: 'suite',
    testIdentifier: null,
    statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
    statName: 'elapsed_ms',
    unit: 'ms',
    numericValue: 12.34,
    textValue: null,
    metadata: {
      seriesId: 'interpreter',
      engineId: 'interpreter',
      statistic: 'median',
    },
  });

  const consoleSummary = formatConsoleSummary(execution.report, execution.artifactPaths);
  assert.match(consoleSummary, /Workspace Test Report/);
  assert.match(consoleSummary, /Packages: 2/);
  assert.match(consoleSummary, /Failed: 1/);
  assert.match(consoleSummary, /Report JSON:/);
});

test('cli run writes report json and html output', () => {
  const outputDir = createTempOutputDir('phase2-cli-run');

  const result = spawnSync(process.execPath, [cliPath, 'run', '--config', fixtureConfigPath, '--output-dir', outputDir], {
    encoding: 'utf8',
    cwd: repoRoot,
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /Running Workspace Tests/);
  assert.match(result.stdout, /Workspace Test Report/);
  assert.match(result.stdout, /HTML report:/);
  assert.equal(fs.existsSync(path.join(outputDir, 'report.json')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'index.html')), true);
});

test('cli render re-renders html from an existing report file', () => {
  const sourceDir = createTempOutputDir('phase2-render-source');
  const resultDir = createTempOutputDir('phase2-render-copy');
  const seeded = spawnSync(process.execPath, [cliPath, 'run', '--config', fixtureConfigPath, '--output-dir', sourceDir], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  assert.equal(seeded.status, 1, seeded.stderr || seeded.stdout);
  const reportPath = path.join(sourceDir, 'report.json');

  const result = spawnSync(process.execPath, [cliPath, 'render', '--input', reportPath, '--output', resultDir], {
    encoding: 'utf8',
    cwd: repoRoot,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(resultDir, 'index.html')), true);
});

test('runReport captures GitHub Actions default environment in report metadata', async () => {
  const outputDir = createTempOutputDir('phase2-run-report-github-env');
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    GITHUB_SHA: 'abc123',
    GITHUB_REF_NAME: 'main',
    GITHUB_WORKFLOW: 'CI',
    GITHUB_ACTIONS: 'true',
    RUNNER_OS: 'Linux',
    CI: 'true',
    GITHUB_TOKEN: 'should-not-be-captured',
  };

  try {
    const execution = await runReport({
      configPath: fixtureConfigPath,
      outputDir,
      writeArtifacts: false,
    });

    assert.equal(execution.report.meta.ci.provider, 'github-actions');
    assert.equal(execution.report.meta.ci.environment.CI, 'true');
    assert.equal(execution.report.meta.ci.environment.GITHUB_SHA, 'abc123');
    assert.equal(execution.report.meta.ci.environment.GITHUB_WORKFLOW, 'CI');
    assert.equal(execution.report.meta.ci.environment.RUNNER_OS, 'Linux');
    assert.equal('GITHUB_TOKEN' in execution.report.meta.ci.environment, false);
  } finally {
    process.env = originalEnv;
  }
});

test('buildReportFromSuiteResults keeps zero-test failed suites failed at the package level', () => {
  const report = buildReportFromSuiteResults({
    config: {},
    project: {
      name: 'fixture-project',
      rootDir: repoRoot,
      outputDir: path.join(repoRoot, 'artifacts'),
    },
    packageCatalog: [
      {
        name: 'web',
        location: 'packages/web',
        index: 0,
      },
    ],
    execution: {},
    policy: null,
  }, [
    {
      id: 'prompt-terminal-e2e',
      label: 'Prompt terminal e2e',
      runtime: 'playwright',
      command: 'yarn test:e2e e2e/prompt-terminal.spec.ts',
      cwd: repoRoot,
      status: 'failed',
      durationMs: 1446,
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      coverage: null,
      tests: [],
      warnings: ['Error: Failed to launch: Error: spawn /bin/sh ENOENT'],
      output: {
        stdout: '',
        stderr: 'Error: Failed to launch: Error: spawn /bin/sh ENOENT',
      },
      rawArtifacts: [],
      packageName: 'web',
    },
  ], 1446);

  assert.equal(report.summary.failedPackages, 1);
  assert.equal(report.summary.skippedPackages, 0);
  assert.equal(report.packages[0].status, 'failed');
  assert.equal(report.packages[0].summary.total, 0);
  assert.equal(report.packages[0].suites[0].status, 'failed');
});
