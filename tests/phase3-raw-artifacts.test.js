import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runReport, readJson } from '@test-reporter/core';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'phase3', 'raw-artifacts');
const fixtureConfigPath = path.join(fixtureDir, 'test-reporter.fixture.config.mjs');

function createTempOutputDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `test-reporter-${label}-`));
}

test('runReport writes raw artifact manifests and copies file and directory sources into raw/', async () => {
  const outputDir = createTempOutputDir('phase3-raw-artifacts');
  const execution = await runReport({
    configPath: fixtureConfigPath,
    outputDir,
    writeArtifacts: true,
  });

  const suite = execution.report.packages[0].suites[0];
  assert.equal(Array.isArray(suite.rawArtifacts), true);
  assert.equal(suite.rawArtifacts.length, 3);
  assert.deepEqual(
    suite.rawArtifacts.map((artifact) => artifact.href),
    [
      'raw/fixture-inline/log.txt',
      'raw/fixture-file/trace.zip',
      'raw/fixture-dir/test-results',
    ],
  );
  assert.equal(suite.rawArtifacts[1].mediaType, 'application/zip');
  assert.equal(suite.rawArtifacts[2].kind, 'directory');

  assert.equal(fs.existsSync(path.join(outputDir, 'raw', 'fixture-inline', 'log.txt')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'raw', 'fixture-file', 'trace.zip')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'raw', 'fixture-dir', 'test-results', 'result.txt')), true);

  const report = readJson(path.join(outputDir, 'report.json'));
  assert.equal(report.packages[0].suites[0].rawArtifacts[0].label, 'Inline log');
  assert.equal(report.packages[0].suites[0].rawArtifacts[2].href, 'raw/fixture-dir/test-results');

  const rawSuitePayload = readJson(path.join(outputDir, 'raw', 'web-web-e2e.json'));
  assert.equal(rawSuitePayload.rawArtifacts.length, 3);
  assert.equal(rawSuitePayload.rawArtifacts[1].href, 'raw/fixture-file/trace.zip');
});
