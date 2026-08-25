#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPerformanceFixture } from './generate-performance-fixture.mjs';

export async function runMixedLoadBenchmark({ baseUrl, apiKey, runId, readers = 25, samples = 3, fetchImpl = fetch } = {}) {
  if (!baseUrl || !apiKey || !runId) throw new Error('baseUrl, apiKey, and runId are required');
  const root = baseUrl.replace(/\/$/, '');
  const report = createPerformanceFixture({ testCount: 10_000, seed: 'test-station-performance-v1' });
  const ingestPromise = timedFetch(fetchImpl, `${root}/api/ingest`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      projectKey: 'test-station-performance-fixture', report,
      source: { provider: 'performance-fixture', runId: 'deterministic-large-v1', branch: 'performance-fixtures', commitSha: 'large', completedAt: '2026-07-22T00:03:00.000Z', isPublic: true },
      submission: { kind: 'combined', producerKey: 'test-station-self-benchmark', submissionKey: 'deterministic-large-v1' }, artifacts: [],
    }),
  });
  const paths = ['/', '/projects/test-station-performance-fixture', `/runs/${encodeURIComponent(runId)}`, `/runs/${encodeURIComponent(runId)}?template=web`, `/api/projects/test-station-performance-fixture/activity`, `/api/runs/${encodeURIComponent(runId)}/insights`, `/api/runs/${encodeURIComponent(runId)}/operations`];
  const readResults = await Promise.all(Array.from({ length: readers }, async (_, reader) => {
    const results = [];
    for (let sample = 0; sample < samples; sample += 1) results.push(await timedFetch(fetchImpl, `${root}${paths[(reader + sample) % paths.length]}`));
    return results;
  }));
  const ingest = await ingestPromise;
  const reads = readResults.flat();
  const durations = reads.map((entry) => entry.durationMs);
  const failures = reads.filter((entry) => entry.status >= 500 || entry.error);
  const pathSummaries = summarizePaths(reads);
  return {
    schemaVersion: '1', readers, samplesPerReader: samples, requestCount: reads.length,
    p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95), p99Ms: percentile(durations, 0.99),
    fiveXxCount: reads.filter((entry) => entry.status >= 500).length, failureCount: failures.length,
    ingest, paths: pathSummaries, failures, passed: failures.length === 0 && ingest.status < 500,
  };
}

function summarizePaths(reads) {
  const grouped = new Map();
  for (const entry of reads) {
    const summary = grouped.get(entry.url) || { path: entry.url, requestCount: 0, fiveXxCount: 0, failureCount: 0, durations: [] };
    summary.requestCount += 1;
    summary.fiveXxCount += entry.status >= 500 ? 1 : 0;
    summary.failureCount += entry.status >= 500 || entry.error ? 1 : 0;
    summary.durations.push(entry.durationMs);
    grouped.set(entry.url, summary);
  }
  return Array.from(grouped.values()).map(({ durations, ...summary }) => ({
    ...summary,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: Math.max(...durations),
  }));
}

async function timedFetch(fetchImpl, url, options) {
  const startedAt = performance.now();
  try {
    const response = await fetchImpl(url, options);
    const body = await response.arrayBuffer();
    return {
      url: new URL(url).pathname,
      status: response.status,
      durationMs: round(performance.now() - startedAt),
      ...(response.status >= 500 ? { responsePreview: new TextDecoder().decode(body.slice(0, 1_024)) } : {}),
    };
  }
  catch (error) { return { url: new URL(url).pathname, status: 0, durationMs: round(performance.now() - startedAt), error: error?.name || 'FetchError' }; }
}
function percentile(values, ratio) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] || 0; }
function round(value) { return Number(value.toFixed(2)); }

if (process.argv[1]?.endsWith('mixed-load-benchmark.mjs')) {
  const output = process.env.TEST_STATION_MIXED_LOAD_OUTPUT || 'artifacts/e2e-performance/mixed-load.json';
  runMixedLoadBenchmark({ baseUrl: process.env.TEST_STATION_E2E_BASE_URL, apiKey: process.env.TEST_STATION_INGEST_SHARED_KEY, runId: process.env.TEST_STATION_MIXED_LOAD_RUN_ID })
    .then((result) => { fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true }); fs.writeFileSync(path.resolve(output), `${JSON.stringify(result, null, 2)}\n`); process.stdout.write(`${JSON.stringify(result)}\n`); if (!result.passed) process.exitCode = 1; });
}
