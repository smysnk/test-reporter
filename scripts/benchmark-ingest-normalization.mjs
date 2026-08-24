#!/usr/bin/env node

import { performance } from 'node:perf_hooks';
import { normalizeIngestPayload } from '../packages/server/ingest/normalize.js';
import { createPerformanceFixture } from './generate-performance-fixture.mjs';

export function benchmarkIngestNormalization({ tiers = [100, 1_000, 10_000], samples = 5 } = {}) {
  const performanceStats = [];
  const tests = [];
  for (const testCount of tiers) {
    const report = createPerformanceFixture({ testCount, seed: 'ingest-normalization-v1' });
    normalizeFixture(report, testCount);
    const durations = [];
    for (let sample = 0; sample < samples; sample += 1) {
      const startedAt = performance.now();
      const normalized = normalizeFixture(report, testCount);
      durations.push(performance.now() - startedAt);
      if (normalized.counts.tests !== testCount) throw new Error(`Expected ${testCount} normalized tests`);
    }
    const tier = testCount >= 10_000 ? 'large' : testCount >= 1_000 ? 'medium' : 'small';
    for (const [statName, value] of [['normalize_ms_median', percentile(durations, 0.5)], ['normalize_ms_p95', percentile(durations, 0.95)]]) {
      performanceStats.push({
        statGroup: 'benchmark.server.test-station.ingest',
        statName,
        unit: 'ms',
        numericValue: Number(value.toFixed(2)),
        metadata: {
          seriesId: `controlled.node.${tier}`,
          runnerKey: `controlled.node.${process.version}`,
          lowerIsBetter: true,
          fixtureTier: tier,
          testCount,
          sampleCount: samples,
        },
      });
    }
    tests.push({
      name: `${tier} ingest normalization`,
      fullName: `Test Station ${tier} ingest normalization (${testCount} tests)`,
      status: 'passed',
      durationMs: Math.round(percentile(durations, 0.95)),
      failureMessages: [],
      assertions: [],
      setup: [],
      mocks: [],
      rawDetails: { testCount, samples, durations },
    });
  }
  return {
    status: 'passed',
    durationMs: tests.reduce((total, test) => total + test.durationMs, 0),
    summary: { total: tests.length, passed: tests.length, failed: 0, skipped: 0 },
    tests,
    warnings: [],
    performanceStats,
    rawArtifacts: [],
  };
}

function normalizeFixture(report, testCount) {
  return normalizeIngestPayload({
    projectKey: 'test-station-performance-fixture',
    report,
    source: {
      provider: 'performance-fixture',
      runId: `fixture-${testCount}`,
      commitSha: 'fixture',
      completedAt: report.generatedAt,
    },
    artifacts: [],
    submission: {
      kind: 'combined',
      producerKey: 'ingest-normalization-benchmark',
      submissionKey: `fixture-${testCount}`,
    },
  }, { now: report.generatedAt });
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

if (process.argv[1]?.endsWith('benchmark-ingest-normalization.mjs')) {
  process.stdout.write(`${JSON.stringify(benchmarkIngestNormalization())}\n`);
}
