import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runReport, formatConsoleSummary, readJson } from '@test-reporter/core';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'phase2');
const fixtureConfigPath = path.join(fixtureDir, 'test-reporter.fixture.config.mjs');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.js');

function createTempOutputDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `test-reporter-${label}-`));
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
