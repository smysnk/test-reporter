import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPagesSite } from '@test-station/render-html';
import { buildSelfTestPagesSite } from '../scripts/pages/build-self-test-site.mjs';

test('buildSelfTestPagesSite copies the self-test report and writes Pages badge endpoints', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-station-pages-'));
  const inputDir = path.join(tempRoot, 'input');
  const outputDir = path.join(tempRoot, 'output');
  const rawDir = path.join(inputDir, 'raw');

  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(inputDir, 'index.html'), '<html><body>report</body></html>\n');
  fs.writeFileSync(path.join(rawDir, 'repo-repo-node.json'), '{}\n');
  fs.writeFileSync(path.join(inputDir, 'report.json'), `${JSON.stringify({
    generatedAt: '2026-03-09T12:00:00.000Z',
    summary: {
      totalTests: 12,
      passedTests: 11,
      failedTests: 1,
      skippedTests: 0,
      totalSuites: 1,
      totalPackages: 1,
      coverage: {
        lines: {
          covered: 80,
          total: 100,
          pct: 80,
        },
      },
    },
    meta: {
      projectName: 'test-station self-test',
    },
  }, null, 2)}\n`);

  const result = buildSelfTestPagesSite({ inputDir, outputDir });

  assert.equal(fs.existsSync(result.htmlPath), true);
  assert.equal(fs.existsSync(result.reportPath), true);
  assert.equal(fs.existsSync(path.join(outputDir, '.nojekyll')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'raw', 'repo-repo-node.json')), true);

  const testsBadge = JSON.parse(fs.readFileSync(result.testsBadgePath, 'utf8'));
  const coverageBadge = JSON.parse(fs.readFileSync(result.coverageBadgePath, 'utf8'));
  const healthBadge = JSON.parse(fs.readFileSync(result.healthBadgePath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(result.summaryPath, 'utf8'));

  assert.deepEqual(testsBadge, {
    schemaVersion: 1,
    label: 'tests',
    message: '11 passed / 1 failed',
    color: 'red',
  });
  assert.deepEqual(coverageBadge, {
    schemaVersion: 1,
    label: 'coverage',
    message: '80.0%',
    color: 'yellowgreen',
  });
  assert.deepEqual(healthBadge, {
    schemaVersion: 1,
    label: 'health',
    message: '80%',
    color: 'yellowgreen',
  });
  assert.equal(summary.artifacts.html, 'index.html');
  assert.equal(summary.artifacts.testsBadge, 'badges/tests.json');
  assert.equal(summary.artifacts.healthBadge, 'badges/health.json');
  assert.equal(summary.summary.totalTests, 12);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('buildPagesSite writes HTML when the source report directory has no index.html', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-station-pages-generic-'));
  const inputDir = path.join(tempRoot, 'input');
  const outputDir = path.join(tempRoot, 'output');
  const rawDir = path.join(inputDir, 'raw');

  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(inputDir, 'report.json'), `${JSON.stringify({
    generatedAt: '2026-03-09T12:00:00.000Z',
    summary: {
      totalTests: 8,
      passedTests: 8,
      failedTests: 0,
      skippedTests: 0,
      totalSuites: 1,
      totalPackages: 1,
      coverage: {
        lines: {
          covered: 92,
          total: 100,
          pct: 92,
        },
      },
    },
    meta: {
      projectName: 'generic fixture',
      projectRootDir: tempRoot,
    },
  }, null, 2)}\n`);

  const result = buildPagesSite({
    input: path.join(inputDir, 'report.json'),
    outputDir,
  });

  assert.equal(fs.existsSync(result.htmlPath), true);
  assert.equal(fs.existsSync(result.healthBadgePath), true);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('cli pages builds a Pages-ready site with health and coverage badges', () => {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const cliPath = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.js');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-station-pages-cli-'));
  const inputDir = path.join(tempRoot, 'input');
  const outputDir = path.join(tempRoot, 'output');

  fs.mkdirSync(path.join(inputDir, 'raw'), { recursive: true });
  fs.writeFileSync(path.join(inputDir, 'report.json'), `${JSON.stringify({
    generatedAt: '2026-03-09T12:00:00.000Z',
    summary: {
      totalTests: 4,
      passedTests: 4,
      failedTests: 0,
      skippedTests: 0,
      totalSuites: 1,
      totalPackages: 1,
      coverage: {
        lines: {
          covered: 87,
          total: 100,
          pct: 87,
        },
      },
    },
    meta: {
      projectName: 'cli pages fixture',
      projectRootDir: tempRoot,
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    cliPath,
    'pages',
    '--input', path.join(inputDir, 'report.json'),
    '--output', outputDir,
  ], {
    encoding: 'utf8',
    cwd: repoRoot,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(outputDir, 'badges', 'coverage.json')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'badges', 'health.json')), true);

  const healthBadge = JSON.parse(fs.readFileSync(path.join(outputDir, 'badges', 'health.json'), 'utf8'));
  assert.equal(healthBadge.message, '87%');

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
