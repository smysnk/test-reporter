import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runReport, formatConsoleSummary } from '@test-station/core';
import { renderHtmlReport } from '@test-station/render-html';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'phase7');
const thresholdConfigPath = path.join(fixtureDir, 'test-station.thresholds.fixture.config.mjs');
const diagnosticsConfigPath = path.join(fixtureDir, 'test-station.diagnostics.fixture.config.mjs');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.js');

function createTempOutputDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `test-station-${label}-`));
}

test('runReport evaluates module and theme coverage thresholds', async () => {
  const execution = await runReport({
    configPath: thresholdConfigPath,
    writeArtifacts: false,
  });

  assert.equal(execution.report.summary.failedPackages, 0);
  assert.equal(execution.report.summary.failedSuites, 0);
  assert.deepEqual(execution.report.summary.policy, {
    failedThresholds: 1,
    warningThresholds: 1,
    diagnosticsSuites: 0,
    failedDiagnostics: 0,
  });
  assert.equal(execution.report.policy.thresholds.totalRules, 2);
  assert.equal(execution.report.policy.thresholds.failedRules, 1);
  assert.equal(execution.report.policy.thresholds.warningRules, 1);
  assert.equal(execution.report.policy.thresholds.violations.length, 2);

  const runtimeModule = execution.report.modules.find((entry) => entry.module === 'runtime');
  assert.ok(runtimeModule);
  assert.equal(runtimeModule.owner, 'platform-team');
  assert.equal(runtimeModule.threshold.status, 'failed');
  assert.equal(runtimeModule.threshold.metrics[0].metric, 'lines');
  assert.equal(runtimeModule.threshold.metrics[0].actualPct, 40);
  assert.equal(runtimeModule.threshold.metrics[0].minPct, 45);

  const runtimeTheme = runtimeModule.themes.find((entry) => entry.theme === 'core');
  assert.ok(runtimeTheme);
  assert.equal(runtimeTheme.owner, 'runtime-core-team');
  assert.equal(runtimeTheme.threshold.status, 'warn');

  const html = renderHtmlReport(execution.report, {
    title: 'phase7-thresholds',
    projectRootDir: fixtureDir,
  });
  assert.match(html, /Threshold Failures/);
  assert.match(html, /Threshold Warnings/);
  assert.match(html, /Coverage Policy/);

  const consoleSummary = formatConsoleSummary(execution.report, {});
  assert.match(consoleSummary, /Policy: threshold failures 1 \| threshold warnings 1/);
});

test('cli run exits non-zero when error thresholds fail', () => {
  const outputDir = createTempOutputDir('phase7-threshold-cli');
  const result = spawnSync(process.execPath, [cliPath, 'run', '--config', thresholdConfigPath, '--output-dir', outputDir], {
    encoding: 'utf8',
    cwd: repoRoot,
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /Policy: threshold failures 1 \| threshold warnings 1/);
});

test('runReport skips threshold evaluation when coverage is disabled', async () => {
  const execution = await runReport({
    configPath: thresholdConfigPath,
    coverage: false,
    writeArtifacts: false,
  });

  assert.deepEqual(execution.report.summary.policy, {
    failedThresholds: 0,
    warningThresholds: 0,
    diagnosticsSuites: 0,
    failedDiagnostics: 0,
  });
  assert.equal(execution.report.policy.thresholds.totalRules, 2);
  assert.equal(execution.report.policy.thresholds.evaluatedRules, 0);
  assert.equal(execution.report.policy.thresholds.failedRules, 0);
  assert.equal(execution.report.policy.thresholds.warningRules, 0);

  const runtimeModule = execution.report.modules.find((entry) => entry.module === 'runtime');
  assert.ok(runtimeModule);
  assert.equal(runtimeModule.threshold.status, 'skipped');
  assert.equal(runtimeModule.themes[0].threshold.status, 'skipped');
});

test('runReport reruns failing suites for diagnostics and preserves raw artifacts', async () => {
  const outputDir = createTempOutputDir('phase7-diagnostics');
  const events = [];
  const execution = await runReport({
    configPath: diagnosticsConfigPath,
    outputDir,
    writeArtifacts: true,
    onEvent(event) {
      events.push(event.type);
    },
  });

  assert.equal(events.includes('suite-diagnostics-start'), true);
  assert.equal(events.includes('suite-diagnostics-complete'), true);
  assert.deepEqual(execution.report.summary.policy, {
    failedThresholds: 0,
    warningThresholds: 0,
    diagnosticsSuites: 1,
    failedDiagnostics: 1,
  });

  const suite = execution.report.packages[0].suites[0];
  assert.equal(suite.status, 'failed');
  assert.equal(suite.diagnostics.label, 'Verbose rerun');
  assert.equal(suite.diagnostics.status, 'failed');
  assert.match(suite.diagnostics.output.stdout, /rerun stdout/);
  assert.match(suite.diagnostics.output.stderr, /rerun stderr/);
  assert.equal(suite.rawArtifacts.some((artifact) => artifact.relativePath === 'diagnostics/app-app-unit-rerun.log'), true);
  assert.equal(suite.rawArtifacts.some((artifact) => artifact.relativePath === 'diagnostics/app-app-unit-rerun.json'), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'raw', 'diagnostics', 'app-app-unit-rerun.log')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'raw', 'diagnostics', 'app-app-unit-rerun.json')), true);

  const html = renderHtmlReport(execution.report, {
    title: 'phase7-diagnostics',
    projectRootDir: fixtureDir,
  });
  assert.match(html, /Verbose rerun/);
  assert.match(html, /diagnostics\/app-app-unit-rerun\.log/);

  const consoleSummary = formatConsoleSummary(execution.report, {});
  assert.match(consoleSummary, /Policy: diagnostic reruns 1 \| failed diagnostics 1/);
});
