#!/usr/bin/env node

import crypto from 'node:crypto';
import { createPerformanceFixture } from './generate-performance-fixture.mjs';

export async function seedPerformanceFixtures({ endpoint, apiKey, projectKey = 'test-station-performance-fixture', fetchImpl = fetch } = {}) {
  if (!endpoint || !apiKey) throw new Error('endpoint and apiKey are required');
  const tiers = [
    { name: 'small', count: 100, completedAt: '2026-07-22T00:01:00.000Z' },
    { name: 'medium', count: 1_000, completedAt: '2026-07-22T00:02:00.000Z' },
    { name: 'large', count: 10_000, completedAt: '2026-07-22T00:03:00.000Z' },
  ];
  const receipts = [];
  for (const tier of tiers) {
    const report = createPerformanceFixture({ testCount: tier.count, seed: 'test-station-performance-v1' });
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        projectKey,
        report,
        source: {
          provider: 'performance-fixture',
          runId: `deterministic-${tier.name}-v1`,
          branch: 'performance-fixtures',
          commitSha: crypto.createHash('sha256').update(tier.name).digest('hex'),
          completedAt: tier.completedAt,
          isPublic: true,
          projectName: 'Test Station Performance Fixture',
        },
        submission: {
          kind: 'combined',
          producerKey: 'test-station-self-benchmark',
          submissionKey: `deterministic-${tier.name}-v1`,
        },
        artifacts: [],
      }),
    });
    const receipt = await response.json();
    if (!response.ok) throw new Error(`Fixture ${tier.name} failed (${response.status}): ${receipt?.error?.message || 'unknown error'}`);
    receipts.push({ tier: tier.name, count: tier.count, checksum: report.metadata.fixtureChecksum, ...receipt });
  }
  return { schemaVersion: '1', projectKey, receipts };
}

if (process.argv[1]?.endsWith('seed-performance-fixtures.mjs')) {
  seedPerformanceFixtures({
    endpoint: process.env.TEST_STATION_INGEST_ENDPOINT,
    apiKey: process.env.TEST_STATION_INGEST_SHARED_KEY,
    projectKey: process.env.TEST_STATION_BENCHMARK_PROJECT_KEY,
  }).then((result) => process.stdout.write(`${JSON.stringify(result)}\n`));
}
