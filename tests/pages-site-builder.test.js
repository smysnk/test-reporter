import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    message: '80.00% lines',
    color: 'yellowgreen',
  });
  assert.equal(summary.artifacts.html, 'index.html');
  assert.equal(summary.artifacts.testsBadge, 'badges/tests.json');
  assert.equal(summary.summary.totalTests, 12);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
