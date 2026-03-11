import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runReport, readJson } from '@test-station/core';
import { parseCliArgs } from '@test-station/cli';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'phase2');
const fixtureConfigPath = path.join(fixtureDir, 'test-station.fixture.config.mjs');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.js');

test('parseCliArgs supports workspace filters, package alias, and output-dir', () => {
  const parsed = parseCliArgs([
    'run',
    '--config', './test-station.config.mjs',
    '--workspace', 'web',
    '--package', 'transpiler',
    '--output-dir', './artifacts/custom-report',
    '--coverage',
  ]);

  assert.equal(parsed.command, 'run');
  assert.equal(parsed.config, './test-station.config.mjs');
  assert.equal(parsed.outputDir, './artifacts/custom-report');
  assert.equal(parsed.coverage, true);
  assert.deepEqual(parsed.workspaceFilters, ['web', 'transpiler']);
});

test('parseCliArgs leaves coverage undefined when the flag is omitted', () => {
  const parsed = parseCliArgs([
    'run',
    '--config', './test-station.config.mjs',
    '--workspace', 'app',
  ]);

  assert.equal(parsed.coverage, undefined);
  assert.deepEqual(parsed.workspaceFilters, ['app']);
});

test('parseCliArgs supports explicit no-coverage overrides', () => {
  const parsed = parseCliArgs([
    'run',
    '--config', './test-station.config.mjs',
    '--coverage',
    '--no-coverage',
  ]);

  assert.equal(parsed.coverage, false);
});

test('runReport filters suites by workspace and writes artifacts to the overridden output directory', async () => {
  const outputDir = path.join(fixtureDir, 'artifacts', 'filtered-app');
  fs.rmSync(outputDir, { recursive: true, force: true });

  const execution = await runReport({
    configPath: fixtureConfigPath,
    workspaceFilters: ['app'],
    outputDir,
  });

  assert.equal(execution.report.summary.totalPackages, 2);
  assert.equal(execution.report.summary.totalSuites, 1);
  assert.equal(execution.report.summary.totalTests, 2);
  assert.equal(execution.report.summary.failedTests, 0);
  assert.equal(execution.report.packages[0].name, 'app');
  assert.equal(execution.report.packages[1].name, 'lib');
  assert.equal(execution.report.packages[1].status, 'skipped');
  assert.equal(execution.context.project.outputDir, outputDir);
  assert.equal(execution.context.project.rawDir, path.join(outputDir, 'raw'));
  assert.equal(fs.existsSync(path.join(outputDir, 'report.json')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'raw', 'app-app-unit.json')), true);

  const storedReport = readJson(path.join(outputDir, 'report.json'));
  assert.equal(storedReport.summary.totalPackages, 2);
  assert.equal(storedReport.packages[0].name, 'app');
});

test('runReport fails clearly when workspace filters match no suites', async () => {
  await assert.rejects(
    () => runReport({
      configPath: fixtureConfigPath,
      workspaceFilters: ['missing-workspace'],
      writeArtifacts: false,
    }),
    /No suites matched workspaces: missing-workspace/
  );
});

test('cli run supports package alias and output-dir without host wrapper logic', () => {
  const outputDir = path.join(fixtureDir, 'artifacts', 'cli-filtered-app');
  fs.rmSync(outputDir, { recursive: true, force: true });

  const result = spawnSync(process.execPath, [
    cliPath,
    'run',
    '--config', fixtureConfigPath,
    '--package', 'app',
    '--output-dir', outputDir,
  ], {
    encoding: 'utf8',
    cwd: repoRoot,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Running Workspace Tests/);
  assert.match(result.stdout, /Workspace Test Report/);
  assert.match(result.stdout, /HTML report:/);
  assert.equal(fs.existsSync(path.join(outputDir, 'report.json')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'index.html')), true);

  const report = readJson(path.join(outputDir, 'report.json'));
  assert.equal(report.summary.totalPackages, 2);
  assert.equal(report.packages[0].name, 'app');
});
