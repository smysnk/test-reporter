import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createNodeTestAdapter } from '@test-station/adapter-node-test';
import { createVitestAdapter } from '@test-station/adapter-vitest';
import { createPlaywrightAdapter } from '@test-station/adapter-playwright';
import { createShellAdapter } from '@test-station/adapter-shell';
import { createJestAdapter } from '@test-station/adapter-jest';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureRoot = path.join(repoRoot, 'tests', 'fixtures', 'phase3');

function createProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-station-phase3-'));
  return {
    name: 'fixture-project',
    rootDir: repoRoot,
    outputDir: path.join(tempDir, 'report'),
    rawDir: path.join(tempDir, 'raw'),
  };
}

function createWrappedNodeTestFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-station-node-wrapper-'));
  const sourceDir = path.join(fixtureRoot, 'node-test');
  for (const fileName of ['env.test.js']) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(tempDir, fileName));
  }
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
    name: 'node-test-wrapper-fixture',
    private: true,
    scripts: {
      'test:wrapped': 'TEST_STATION_PHASE3_ENV=enabled node --test ./env.test.js',
    },
  }, null, 2));
  return tempDir;
}

test('node:test adapter executes and normalizes suite output', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'node-test');
  const adapter = createNodeTestAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'node-fixture',
      label: 'Node Fixture',
      packageName: 'fixtures',
      cwd,
      command: [process.execPath, '--test', './math.test.js'],
      coverage: { enabled: true },
    },
    execution: { coverage: true },
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.summary, { total: 3, passed: 1, failed: 1, skipped: 1 });
  assert.equal(result.tests.length, 3);
  assert.equal(result.coverage?.lines?.total > 0, true);
  assert.match(result.rawArtifacts[0].relativePath, /node\.ndjson$/);
});

test('node:test adapter collects coverage for supported package-script wrappers', async () => {
  const project = createProject();
  const cwd = createWrappedNodeTestFixture();
  const adapter = createNodeTestAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'node-package-script',
      label: 'Node Package Script Fixture',
      packageName: 'fixtures',
      cwd,
      command: ['yarn', 'test:wrapped'],
      coverage: { enabled: true },
    },
    execution: { coverage: true },
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.summary, { total: 1, passed: 1, failed: 0, skipped: 0 });
  assert.equal(result.coverage?.lines?.total > 0, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.rawArtifacts.some((artifact) => /node-coverage\.ndjson$/.test(artifact.relativePath)), true);
});

test('vitest adapter executes and parses json report plus coverage', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'vitest');
  const adapter = createVitestAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'vitest-fixture',
      label: 'Vitest Fixture',
      packageName: 'fixtures',
      cwd,
      command: ['yarn', 'vitest', 'run', './math.test.js', '--config', './vitest.config.mjs'],
      coverage: { enabled: true },
    },
    execution: { coverage: true },
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.summary, { total: 3, passed: 1, failed: 1, skipped: 1 });
  assert.equal(result.tests.length, 3);
  assert.equal(result.coverage?.lines?.total > 0, true);
  assert.equal(result.rawArtifacts.some((artifact) => /vitest-coverage-summary\.json$/.test(artifact.relativePath)), true);
});

test('playwright adapter executes and parses json report', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'playwright');
  const adapter = createPlaywrightAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'playwright-fixture',
      label: 'Playwright Fixture',
      packageName: 'fixtures',
      cwd,
      command: ['yarn', 'playwright', 'test', './simple.spec.js', '--config', './playwright.config.mjs'],
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.summary, { total: 3, passed: 1, failed: 1, skipped: 1 });
  assert.equal(result.tests.length, 3);
  assert.match(result.rawArtifacts[0].relativePath, /playwright\.json$/);
});

test('playwright adapter collects suite-scoped browser Istanbul coverage when requested', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'playwright');
  const adapter = createPlaywrightAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'playwright-browser-coverage',
      label: 'Playwright Browser Coverage Fixture',
      packageName: 'fixtures',
      cwd,
      command: ['yarn', 'playwright', 'test', './coverage.spec.js', '--config', './playwright.config.mjs'],
      coverage: {
        enabled: true,
        strategy: 'browser-istanbul',
      },
    },
    execution: { coverage: true },
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.summary, { total: 1, passed: 1, failed: 0, skipped: 0 });
  assert.equal(result.coverage?.lines?.total, 1);
  assert.equal(result.coverage?.files.length, 1);
  assert.match(result.coverage?.files[0].path || '', /coverage-target\.js$/);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.rawArtifacts.some((artifact) => /playwright-coverage$/.test(artifact.relativePath)), true);
  assert.equal(
    result.rawArtifacts.some((artifact) => /playwright-coverage\/coverage-summary\.json$/.test(artifact.relativePath)),
    true,
  );
});

test('playwright adapter surfaces top-level launcher errors when no tests are emitted', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'playwright');
  const adapter = createPlaywrightAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'playwright-launch-error',
      label: 'Playwright Launch Error Fixture',
      packageName: 'fixtures',
      cwd,
      command: [process.execPath, './launch-error.mjs'],
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.summary, { total: 0, passed: 0, failed: 0, skipped: 0 });
  assert.equal(result.tests.length, 0);
  assert.deepEqual(result.warnings, ['Error: Failed to launch: Error: spawn /bin/sh ENOENT']);
});

test('shell adapter executes command and synthesizes suite result', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'shell');
  const adapter = createShellAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'shell-fixture',
      label: 'Shell Fixture',
      packageName: 'fixtures',
      cwd,
      command: [process.execPath, './suite.mjs'],
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.summary, { total: 3, passed: 2, failed: 1, skipped: 0 });
  assert.equal(result.tests.length, 1);
  assert.match(result.tests[0].failureMessages[0], /simulated shell failure/);
});

test('shell adapter supports single-check-json-v1 result parsing', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'shell-json');
  const adapter = createShellAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'shell-json-fixture',
      label: 'Mapping Parity',
      packageName: 'fixtures',
      cwd,
      command: [process.execPath, './suite.mjs'],
      resultFormat: 'single-check-json-v1',
      resultFormatOptions: {
        name: 'OpenJSCAD mapping parity',
        assertions: [
          'Compare local mappings against the upstream reference list.',
        ],
        module: 'transpiler',
        theme: 'analysis',
        classificationSource: 'config',
        warningFields: [
          { field: 'missingFromLocal', label: 'mappings missing locally', mode: 'count-array' },
          { field: 'localOnly', label: 'local-only mappings', mode: 'count-array' },
        ],
        rawDetailsFields: ['referenceCount', 'localCount', 'missingFromLocal', 'localOnly'],
      },
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.summary, { total: 1, passed: 1, failed: 0, skipped: 0 });
  assert.equal(result.tests.length, 1);
  assert.equal(result.tests[0].name, 'OpenJSCAD mapping parity');
  assert.equal(result.tests[0].module, 'transpiler');
  assert.equal(result.tests[0].theme, 'analysis');
  assert.equal(result.tests[0].classificationSource, 'config');
  assert.deepEqual(result.tests[0].rawDetails, {
    referenceCount: 28,
    localCount: 27,
    missingFromLocal: ['surface'],
    localOnly: [],
  });
  assert.deepEqual(result.warnings, ['1 mappings missing locally']);
  assert.match(result.rawArtifacts[0].relativePath, /shell\.json$/);
});

test('jest adapter executes and parses json report plus coverage', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'jest');
  const adapter = createJestAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'jest-fixture',
      label: 'Jest Fixture',
      packageName: 'fixtures',
      cwd,
      command: [process.execPath, './runner.mjs', './math.test.js'],
      coverage: { enabled: true },
    },
    execution: { coverage: true },
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.summary, { total: 3, passed: 1, failed: 1, skipped: 1 });
  assert.equal(result.tests.length, 3);
  assert.equal(result.coverage?.lines?.total > 0, true);
  assert.equal(result.rawArtifacts.some((artifact) => /jest-coverage-summary\.json$/.test(artifact.relativePath)), true);
});

test('node:test adapter merges suite.env into execution environment', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'node-test');
  const adapter = createNodeTestAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'node-env',
      label: 'Node Env Fixture',
      packageName: 'fixtures',
      cwd,
      command: [process.execPath, '--test', './env.test.js'],
      env: {
        TEST_STATION_PHASE3_ENV: 'enabled',
      },
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.summary, { total: 1, passed: 1, failed: 0, skipped: 0 });
});

test('vitest adapter merges suite.env into execution environment', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'vitest');
  const adapter = createVitestAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'vitest-env',
      label: 'Vitest Env Fixture',
      packageName: 'fixtures',
      cwd,
      command: ['yarn', 'vitest', 'run', './env.test.js', '--config', './vitest.env.config.mjs'],
      env: {
        TEST_STATION_PHASE3_ENV: 'enabled',
      },
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.summary, { total: 1, passed: 1, failed: 0, skipped: 0 });
});

test('playwright adapter merges suite.env into execution environment', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'playwright');
  const adapter = createPlaywrightAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'playwright-env',
      label: 'Playwright Env Fixture',
      packageName: 'fixtures',
      cwd,
      command: ['yarn', 'playwright', 'test', './env.spec.js', '--config', './playwright.config.mjs'],
      env: {
        TEST_STATION_PHASE3_ENV: 'enabled',
      },
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.summary, { total: 1, passed: 1, failed: 0, skipped: 0 });
});

test('shell adapter merges suite.env into execution environment', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'shell');
  const adapter = createShellAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'shell-env',
      label: 'Shell Env Fixture',
      packageName: 'fixtures',
      cwd,
      command: [process.execPath, './env-suite.mjs'],
      env: {
        TEST_STATION_PHASE3_ENV: 'enabled',
      },
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.summary, { total: 1, passed: 1, failed: 0, skipped: 0 });
});

test('jest adapter merges suite.env into execution environment', async () => {
  const project = createProject();
  const cwd = path.join(fixtureRoot, 'jest');
  const adapter = createJestAdapter();
  const result = await adapter.run({
    project,
    suite: {
      id: 'jest-env',
      label: 'Jest Env Fixture',
      packageName: 'fixtures',
      cwd,
      command: [process.execPath, './runner.mjs', './env.test.js'],
      env: {
        TEST_STATION_PHASE3_ENV: 'enabled',
      },
    },
    execution: { coverage: false },
  });

  assert.equal(result.status, 'passed');
  assert.deepEqual(result.summary, { total: 1, passed: 1, failed: 0, skipped: 0 });
});
