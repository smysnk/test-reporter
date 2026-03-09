import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runReport, readJson } from '@test-station/core';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'phase5');
const fixtureConfigPath = path.join(fixtureDir, 'test-station.fixture.config.mjs');

test('runReport applies manifest and plugin policy plus source analysis enrichment', async () => {
  const artifactsDir = path.join(fixtureDir, 'artifacts');
  fs.rmSync(artifactsDir, { recursive: true, force: true });

  const execution = await runReport({
    configPath: fixtureConfigPath,
    writeArtifacts: true,
  });

  assert.equal(execution.report.summary.totalPackages, 2);
  assert.equal(execution.report.summary.totalModules, 2);
  assert.deepEqual(execution.report.summary.filterOptions.modules.sort(), ['repository', 'runtime']);
  assert.deepEqual(execution.report.summary.coverageAttribution, {
    totalFiles: 2,
    attributedFiles: 2,
    sharedFiles: 0,
    moduleOnlyFiles: 0,
    packageOnlySharedFiles: 0,
    unattributedFiles: 0,
    manifestFiles: 1,
    heuristicFiles: 0,
    pluginFiles: 1,
  });

  const runtimeModule = execution.report.modules.find((entry) => entry.module === 'runtime');
  assert.ok(runtimeModule);
  assert.equal(runtimeModule.owner, 'runtime-team');
  assert.equal(runtimeModule.themes[0].owner, 'runtime-core-team');
  assert.equal(runtimeModule.coverage.lines.pct, 80);

  const runtimeTest = execution.report.packages
    .find((entry) => entry.name === 'app')
    .suites[0]
    .tests[0];
  assert.equal(runtimeTest.module, 'runtime');
  assert.equal(runtimeTest.theme, 'core');
  assert.equal(runtimeTest.classificationSource, 'manifest');
  assert.match(runtimeTest.sourceSnippet, /test\('loads runtime state'/);
  assert.ok(runtimeTest.assertions.includes("assert.equal(loadRuntimeState(), 'ok');"));
  assert.ok(runtimeTest.setup.some((entry) => entry.startsWith('beforeEach:')));
  assert.ok(runtimeTest.mocks.includes('mock module ../src/runtime.js'));
  assert.equal(runtimeTest.rawDetails.sourceAnalysis.matched, true);

  const repositoryModule = execution.report.modules.find((entry) => entry.module === 'repository');
  assert.ok(repositoryModule);
  assert.equal(repositoryModule.owner, 'repository-team');
  assert.equal(repositoryModule.themes[0].owner, 'repository-team');
  assert.equal(repositoryModule.coverage.lines.pct, 50);
  assert.equal(repositoryModule.coverage.files[0].attributionSource, 'plugin');
  assert.equal(repositoryModule.coverage.files[0].attributionReason, 'fixture plugin coverage mapping');

  const repositoryTest = execution.report.packages
    .find((entry) => entry.name === 'lib')
    .suites[0]
    .tests[0];
  assert.equal(repositoryTest.module, 'repository');
  assert.equal(repositoryTest.theme, 'sync');
  assert.equal(repositoryTest.classificationSource, 'plugin');
  assert.ok(repositoryTest.assertions.includes('expect(syncRepository()).toBeTruthy();'));
  assert.ok(repositoryTest.setup.some((entry) => entry.startsWith('beforeAll:')));
  assert.ok(repositoryTest.mocks.includes('mock module ../src/custom.js'));

  const storedReport = readJson(execution.artifactPaths.reportJsonPath);
  assert.equal(storedReport.summary.coverageAttribution.pluginFiles, 1);
});
