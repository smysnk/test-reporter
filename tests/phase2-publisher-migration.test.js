import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runReport, readJson } from '@test-reporter/core';
import { createDiscordPayload, createLegacySummary } from '../scripts/examples/report-json-migration-utils.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'phase2');
const fixtureConfigPath = path.join(fixtureDir, 'test-reporter.fixture.config.mjs');
const summaryScriptPath = path.join(repoRoot, 'scripts', 'examples', 'report-json-to-summary.mjs');
const discordScriptPath = path.join(repoRoot, 'scripts', 'examples', 'report-json-to-discord-payload.mjs');

function createTempOutputDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `test-reporter-${label}-`));
}

async function buildFixtureReport() {
  const outputDir = createTempOutputDir('phase2-migration-report');
  const execution = await runReport({
    configPath: fixtureConfigPath,
    outputDir,
    writeArtifacts: true,
  });
  return {
    outputDir,
    reportPath: execution.artifactPaths.reportJsonPath,
    report: execution.report,
  };
}

test('createLegacySummary derives package totals, failures, and git metadata from report.json', async () => {
  const { report, reportPath } = await buildFixtureReport();
  const summary = createLegacySummary(report, {
    reportPath,
    git: { sha: 'abc123456789', ref: 'main' },
  });

  assert.equal(summary.status, 'failed');
  assert.equal(summary.project.name, 'fixture-project');
  assert.equal(summary.git.sha, 'abc123456789');
  assert.equal(summary.git.ref, 'main');
  assert.equal(summary.totals.packages, 2);
  assert.equal(summary.totals.tests, 3);
  assert.deepEqual(summary.failures.packageNames, ['lib']);
  assert.equal(summary.packages.find((entry) => entry.name === 'lib')?.totals.failed, 1);
});

test('report-json-to-summary script writes a compatibility summary file', async () => {
  const { reportPath } = await buildFixtureReport();
  const outputPath = path.join(createTempOutputDir('phase2-legacy-summary'), '.test-results', 'summary.json');
  const result = spawnSync(process.execPath, [
    summaryScriptPath,
    '--input',
    reportPath,
    '--output',
    outputPath,
    '--sha',
    'deadbeefcafebabe',
    '--ref',
    'refs/heads/main',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(outputPath), true);
  const summary = readJson(outputPath);
  assert.equal(summary.schemaVersion, 'legacy-summary-v1');
  assert.equal(summary.git.sha, 'deadbeefcafebabe');
  assert.equal(summary.totals.tests, 3);
  assert.deepEqual(summary.failures.packageNames, ['lib']);
});

test('createDiscordPayload formats a minimal direct-publisher payload from report.json', async () => {
  const { report, reportPath } = await buildFixtureReport();
  const payload = createDiscordPayload(report, {
    reportPath,
    git: { sha: 'deadbeefcafebabe', ref: 'main' },
  });

  assert.match(payload.content, /fixture-project failed/);
  assert.match(payload.content, /packages 2 \| suites 2 \| tests 3/);
  assert.match(payload.content, /failed packages: lib/);
});

test('report-json-to-discord-payload script prints a webhook-friendly payload', async () => {
  const { reportPath } = await buildFixtureReport();
  const result = spawnSync(process.execPath, [
    discordScriptPath,
    '--input',
    reportPath,
    '--sha',
    'deadbeefcafebabe',
    '--ref',
    'main',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.match(payload.content, /fixture-project failed on main \(deadbeef\)/);
  assert.equal(payload.metadata.totals.tests, 3);
});
