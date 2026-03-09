import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readJson } from '@test-reporter/core';

const repoRoot = path.resolve(import.meta.dirname, '..');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.js');
const exampleDir = path.join(repoRoot, 'examples', 'generic-node-library');
const exampleConfigPath = path.join(exampleDir, 'test-reporter.config.mjs');

test('generic external consumer project can run through the standalone CLI without varcad-specific code', () => {
  const artifactsDir = path.join(exampleDir, 'artifacts');
  fs.rmSync(artifactsDir, { recursive: true, force: true });

  const result = spawnSync(process.execPath, [cliPath, 'run', '--config', exampleConfigPath, '--coverage'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const reportPath = path.join(exampleDir, 'artifacts', 'test-report', 'report.json');
  const htmlPath = path.join(exampleDir, 'artifacts', 'test-report', 'index.html');
  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(fs.existsSync(htmlPath), true);

  const report = readJson(reportPath);
  assert.equal(report.meta.projectName, 'generic-node-library');
  assert.equal(report.summary.totalPackages, 1);
  assert.equal(report.summary.totalSuites, 1);
  assert.equal(report.summary.totalTests, 1);
  assert.deepEqual(report.summary.filterOptions.modules, ['library']);

  const moduleEntry = report.modules.find((entry) => entry.module === 'library');
  assert.ok(moduleEntry);
  assert.equal(moduleEntry.owner, 'library-team');
  assert.equal(moduleEntry.themes[0].owner, 'library-api-team');
  assert.equal(moduleEntry.coverage.lines.pct, 100);

  const testEntry = report.packages[0].suites[0].tests[0];
  assert.equal(testEntry.classificationSource, 'manifest');
  assert.ok(testEntry.assertions.includes('assert.equal(add(2, 3), 5);'));
  assert.ok(testEntry.setup.some((entry) => entry.startsWith('beforeEach:')));
  assert.match(testEntry.sourceSnippet, /adds positive integers/);
});
