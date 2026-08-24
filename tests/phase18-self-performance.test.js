import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createPerformanceFixture } from '../scripts/generate-performance-fixture.mjs';
import { convertPerformanceResults } from '../scripts/convert-performance-results.mjs';
import { aggregatePerformanceSamples } from '../scripts/aggregate-performance-samples.mjs';
import { createIngestPayload } from '../scripts/ingest-report-utils.mjs';
import { benchmarkIngestNormalization } from '../scripts/benchmark-ingest-normalization.mjs';

test('performance fixture generator creates deterministic size tiers', () => {
  const first = createPerformanceFixture({ testCount: 1_000, seed: 'phase18' });
  const second = createPerformanceFixture({ testCount: 1_000, seed: 'phase18' });

  assert.equal(first.summary.totalTests, 1_000);
  assert.equal(first.packages[0].suites.flatMap((suite) => suite.tests).length, 1_000);
  assert.equal(first.metadata.fixtureTier, 'medium');
  assert.equal(first.metadata.fixtureChecksum, second.metadata.fixtureChecksum);
  assert.deepEqual(first.summary, second.summary);
});

test('performance converter emits stable Test Station performance stats and budget status', () => {
  const suite = convertPerformanceResults({
    generatedAt: '2026-07-22T00:00:00.000Z',
    baseURL: 'https://test-station.example',
    viewport: { width: 1440, height: 1024 },
    budgets: { homeReadyMs: 1_000 },
    benchmarks: [{
      scenario: 'home-load',
      route: 'https://test-station.example/',
      metrics: { homeReadyMs: 1_250, domNodeCount: 400 },
      context: { visibleRunCount: 30 },
    }],
  }, {
    benchmarkProfile: 'controlled.chromium.medium',
    baselineId: 'pre-refactor-2026-07',
    refactorPhase: 'phase-0',
    targetCommit: 'abc123',
  });

  assert.equal(suite.status, 'failed');
  assert.equal(suite.performanceStats.length, 2);
  assert.deepEqual(suite.performanceStats[0], {
    statGroup: 'benchmark.web.test-station.home.load',
    statName: 'home_ready_ms',
    unit: 'ms',
    numericValue: 1_250,
    metadata: {
      seriesId: 'controlled.chromium.medium',
      runnerKey: 'controlled.chromium.medium',
      lowerIsBetter: true,
      baselineId: 'pre-refactor-2026-07',
      refactorPhase: 'phase-0',
      targetCommit: 'abc123',
      route: 'https://test-station.example/',
      statistic: 'sample',
      budget: 1_000,
      budgetStatus: 'failed',
      context: { visibleRunCount: 30 },
    },
  });
});

test('ingest payload supports a synthetic performance source run identity', () => {
  const reportPath = path.resolve(import.meta.dirname, 'fixtures/phase2/artifacts/report/report.json');
  const payload = createIngestPayload({
    reportPath,
    projectKey: 'test-station',
    outputDir: path.dirname(reportPath),
    sourceRunId: '123:web-performance:1',
    targetCommit: 'deadbeef',
    submission: {
      kind: 'performance',
      producerKey: 'test-station-web-performance',
      submissionKey: 'deadbeef:phase-0:1',
    },
    env: {
      GITHUB_REPOSITORY: 'smysnk/test-station',
      GITHUB_RUN_ID: '123',
      GITHUB_SHA: 'deadbeef',
      GITHUB_SERVER_URL: 'https://github.com',
    },
  });

  assert.equal(payload.source.runId, '123:web-performance:1');
  assert.equal(payload.source.ci.targetCommit, 'deadbeef');
  assert.deepEqual(payload.submission, {
    kind: 'performance',
    producerKey: 'test-station-web-performance',
    submissionKey: 'deadbeef:phase-0:1',
  });
  assert.equal(fs.existsSync(reportPath), true);
});

test('performance sample aggregation records median and p95 without the warmup payload', () => {
  const payloads = [100, 120, 80, 110, 90].map((homeReadyMs) => ({
    baseURL: 'https://test-station.example',
    viewport: { width: 1440, height: 1024 },
    budgets: { homeReadyMs: 100 },
    benchmarks: [{ scenario: 'home-load', route: '/', metrics: { homeReadyMs }, context: {} }],
  }));
  const result = aggregatePerformanceSamples(payloads);
  assert.equal(result.sampleCount, 5);
  assert.deepEqual(result.benchmarks[0].metrics, {
    homeReadyMsMedian: 100,
    homeReadyMsP95: 120,
  });
});

test('ingest normalization benchmark publishes tiered performance stats', () => {
  const result = benchmarkIngestNormalization({ tiers: [10], samples: 2 });
  assert.equal(result.status, 'passed');
  assert.equal(result.performanceStats.length, 2);
  assert.equal(result.performanceStats[0].statGroup, 'benchmark.server.test-station.ingest');
  assert.equal(result.performanceStats[0].metadata.testCount, 10);
});
