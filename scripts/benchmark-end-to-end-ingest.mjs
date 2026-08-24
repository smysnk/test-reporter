#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPerformanceFixture } from './generate-performance-fixture.mjs';

export async function benchmarkEndToEndIngest({ endpoint, apiKey, samples = 5, fetchImpl = fetch } = {}) {
  if (!endpoint || !apiKey) throw new Error('endpoint and apiKey are required');
  const tiers = [{ name: 'small', count: 100 }, { name: 'medium', count: 1_000 }, { name: 'large', count: 10_000 }];
  const performanceStats = [];
  const tests = [];
  for (const tier of tiers) {
    const report = createPerformanceFixture({ testCount: tier.count, seed: 'test-station-e2e-ingest-v1' });
    const payloadBytes = Buffer.byteLength(JSON.stringify(report));
    const durations = [];
    let heapHighWaterBytes = 0;
    for (let sample = 0; sample < samples; sample += 1) {
      const startedAt = performance.now();
      const response = await fetchWithRetry(fetchImpl, endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ projectKey: 'test-station-performance-fixture', report, source: { provider: 'performance-ingest-benchmark', runId: `${process.env.GITHUB_RUN_ID || 'local'}-${tier.name}-${sample}`, completedAt: new Date(Date.UTC(2026, 6, 23, 0, tier.count / 100, sample)).toISOString(), branch: 'performance-fixtures', isPublic: true }, submission: { kind: 'combined', producerKey: 'e2e-ingest-benchmark', submissionKey: `${tier.name}-${sample}` }, artifacts: [] }),
      });
      const receipt = await response.json();
      if (!response.ok) throw new Error(receipt?.error?.message || `Ingest failed (${response.status})`);
      durations.push(performance.now() - startedAt);
      heapHighWaterBytes = Math.max(heapHighWaterBytes, process.memoryUsage().heapUsed);
    }
    for (const [name, value, unit, lowerIsBetter] of [
      ['end_to_end_ms_median', percentile(durations, 0.5), 'ms', true],
      ['end_to_end_ms_p95', percentile(durations, 0.95), 'ms', true],
      ['payload_bytes', payloadBytes, 'bytes', true],
      ['client_heap_high_water_bytes', heapHighWaterBytes, 'bytes', true],
    ]) performanceStats.push({ statGroup: 'benchmark.server.test-station.ingest', statName: name, unit, numericValue: Number(value.toFixed(2)), metadata: { seriesId: `deployed.${tier.name}`, runnerKey: 'deployed.http', lowerIsBetter, fixtureTier: tier.name, testCount: tier.count, sampleCount: samples } });
    tests.push({ name: `${tier.name} end-to-end ingest`, fullName: `Test Station ${tier.name} end-to-end ingest`, status: 'passed', durationMs: Math.round(percentile(durations, 0.95)), failureMessages: [], assertions: [], setup: [], mocks: [], rawDetails: { durations, payloadBytes } });
  }
  return { status: 'passed', durationMs: tests.reduce((sum, test) => sum + test.durationMs, 0), summary: { total: tests.length, passed: tests.length, failed: 0, skipped: 0 }, tests, warnings: [], performanceStats, rawArtifacts: [] };
}

async function fetchWithRetry(fetchImpl, endpoint, options, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, options);
      if (response.ok || ![429, 502, 503, 504].includes(response.status) || attempt === maxAttempts) return response;
      lastError = new Error(`Ingest temporarily unavailable (${response.status})`);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  throw lastError || new Error('Ingest request failed');
}
function percentile(values, ratio) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]; }

if (process.argv[1]?.endsWith('benchmark-end-to-end-ingest.mjs')) {
  benchmarkEndToEndIngest({ endpoint: process.env.TEST_STATION_INGEST_ENDPOINT, apiKey: process.env.TEST_STATION_INGEST_SHARED_KEY, samples: Number(process.env.TEST_STATION_INGEST_BENCHMARK_SAMPLES) || 5 })
    .then((result) => { const output = path.resolve(process.env.TEST_STATION_INGEST_BENCHMARK_OUTPUT || 'artifacts/e2e-performance/ingest-suite.json'); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`); process.stdout.write(`${JSON.stringify(result)}\n`); });
}
