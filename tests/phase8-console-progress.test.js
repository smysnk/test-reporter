import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runReport, formatConsoleSummary, createConsoleProgressReporter } from '@test-station/core';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixtureConfigPath = path.join(repoRoot, 'tests', 'fixtures', 'phase8', 'test-station.fixture.config.mjs');

test('runReport emits package and suite progress events including skipped packages from workspace discovery', async () => {
  const events = [];
  const execution = await runReport({
    configPath: fixtureConfigPath,
    writeArtifacts: false,
    onEvent(event) {
      events.push(event);
    },
  });

  assert.equal(execution.report.summary.totalPackages, 2);
  assert.deepEqual(execution.report.packages.map((entry) => entry.name), ['app', 'empty']);

  const eventTypes = events.map((event) => `${event.type}:${event.packageName || ''}:${event.suiteLabel || ''}`);
  assert.deepEqual(eventTypes, [
    'run-start::',
    'package-start:app:',
    'suite-start:app:App Unit',
    'suite-complete:app:App Unit',
    'package-complete:app:',
    'package-start:empty:',
    'package-complete:empty:',
  ]);

  const skippedPackageEvent = events.find((event) => event.type === 'package-complete' && event.packageName === 'empty');
  assert.equal(skippedPackageEvent.status, 'skipped');
  assert.deepEqual(skippedPackageEvent.summary, { total: 0, passed: 0, failed: 0, skipped: 0 });
});

test('createConsoleProgressReporter and formatConsoleSummary render the legacy-style console layout', () => {
  let output = '';
  const reporter = createConsoleProgressReporter({
    stream: {
      write(chunk) {
        output += chunk;
      },
    },
  });

  reporter.onEvent({ type: 'run-start', totalPackages: 2 });
  reporter.onEvent({ type: 'package-start', packageName: 'app', packageLocation: 'packages/app', packageIndex: 1, totalPackages: 2 });
  reporter.onEvent({ type: 'suite-start', suiteLabel: 'Unit Tests', runtime: 'node-test' });
  reporter.onEvent({
    type: 'suite-complete',
    result: {
      status: 'passed',
      durationMs: 42000,
      summary: { total: 3, passed: 3, failed: 0, skipped: 0 },
    },
  });
  reporter.onEvent({
    type: 'package-complete',
    packageName: 'app',
    status: 'passed',
    durationMs: 42000,
    summary: { total: 3, passed: 3, failed: 0, skipped: 0 },
  });

  const summary = formatConsoleSummary({
    durationMs: 42000,
    summary: {
      totalPackages: 2,
      totalSuites: 1,
      totalTests: 3,
      passedTests: 3,
      failedTests: 0,
      skippedTests: 0,
      coverage: {
        lines: { pct: 80 },
        branches: { pct: 50 },
        functions: { pct: 75 },
        statements: { pct: 80 },
      },
    },
    packages: [
      {
        name: 'app',
        status: 'passed',
        durationMs: 42000,
        summary: { total: 3, passed: 3, failed: 0, skipped: 0 },
        coverage: { lines: { pct: 80 } },
      },
      {
        name: 'empty',
        status: 'skipped',
        durationMs: 0,
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
        coverage: null,
      },
    ],
  }, {}, { htmlPath: '/tmp/report/index.html' });

  assert.match(output, /Running Workspace Tests/);
  assert.match(output, /01\/02 PACKAGE app \(packages\/app\)/);
  assert.match(output, /- Unit Tests: running node-test/);
  assert.match(output, /PASS 00:42 tests 3 \| pass 3 \| fail 0 \| skip 0/);
  assert.match(summary, /Workspace Test Report/);
  assert.match(summary, /Packages: 2/);
  assert.match(summary, /Coverage: lines 80.00% \| branches 50.00% \| functions 75.00% \| statements 80.00%/);
  assert.match(summary, /HTML report: \/tmp\/report\/index.html/);
  assert.match(summary, /PASS\s+app\s+00:42\s+tests 3 \| pass 3 \| fail 0 \| skip 0\s+L 80.00%/);
  assert.match(summary, /SKIP\s+empty\s+00:00\s+tests 0 \| pass 0 \| fail 0 \| skip 0/);
});
