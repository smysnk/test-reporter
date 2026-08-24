import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, resolveServerRole } from '../packages/server/index.js';
import {
  finalizeRequestProfile,
  measureProfileStage,
  recordCacheOutcome,
  recordDatabaseQuery,
  recordPoolWait,
  renderPrometheusMetrics,
  resetRuntimeMetrics,
  runWithRequestProfile,
  summarizeRequestProfile,
} from '../packages/server/profiling/requestProfile.js';
import { BOUNDED_TRENDS_SQL } from '../packages/server/graphql/repositories/benchmarkRepository.js';
import { resolveActorFromRequest } from '../packages/server/graphql/context.js';
import { generatePhaseCheckpoint } from '../scripts/generate-phase-checkpoint.mjs';
import { validatePhaseCheckpoint } from '../scripts/validate-phase-checkpoint.mjs';

test('read and ingest server roles expose only their owned request surfaces', async () => {
  const readServer = await createServer({ serverRole: 'read' });
  const ingestServer = await createServer({ serverRole: 'ingest' });
  try {
    const readBase = await listen(readServer);
    const ingestBase = await listen(ingestServer);

    assert.equal((await fetch(`${readBase}/healthz`).then((response) => response.json())).role, 'read');
    assert.equal((await fetch(`${ingestBase}/healthz`).then((response) => response.json())).role, 'ingest');
    assert.equal((await fetch(`${readBase}/api/ingest`, { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await fetch(`${ingestBase}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 404);
  } finally {
    await Promise.all([closeServer(readServer), closeServer(ingestServer)]);
  }
});

test('server role configuration rejects an accidental mixed or unknown topology', () => {
  assert.equal(resolveServerRole({ serverRole: 'all' }), 'all');
  assert.throws(() => resolveServerRole({ serverRole: 'worker' }), /all, read, or ingest/);
});

test('unpersisted identity headers cannot self-assert administrator authority', async () => {
  const actor = await resolveActorFromRequest({
    headers: {
      'x-test-station-actor-id': 'external-user',
      'x-test-station-actor-email': 'external@example.com',
      'x-test-station-actor-role': 'admin',
    },
  }, { models: {} });
  assert.equal(actor.role, 'member');
  assert.equal(actor.isAdmin, false);
});

test('request profiling aggregates bounded labels and strips sensitive stage details', async () => {
  resetRuntimeMetrics();
  const summary = await runWithRequestProfile({
    requestId: 'request-1',
    traceId: 'trace-1',
    route: '/runs/01775c24-b350-4c3c-a8ca-d91e97293a0f?token=secret',
    method: 'GET',
  }, async () => {
    await measureProfileStage('Run insights repository', async () => 'ok', {
      rowCount: 12,
      reportContents: 'must not escape',
      userEmail: 'must-not-escape@example.com',
      bindValues: ['secret'],
    });
    recordDatabaseQuery(4.5, { name: 'run overview', rows: 1 });
    recordPoolWait(1.25);
    recordCacheOutcome('report artifact', 'hit', { durationMs: 2 });
    finalizeRequestProfile({ statusCode: 200, responseBytes: 512 });
    return summarizeRequestProfile();
  });

  assert.equal(summary.route, '/runs/:id');
  assert.equal(summary.database.queryCount, 1);
  assert.equal(summary.database.rows, 1);
  assert.equal(summary.database.poolAcquireCount, 1);
  assert.deepEqual(summary.stages[0].details, { rowCount: 12 });
  const metrics = renderPrometheusMetrics();
  assert.match(metrics, /test_station_database_query_duration_ms_count\{operation="run_overview"\} 1/);
  assert.doesNotMatch(metrics, /secret|example\.com|01775c24/i);
});

test('bounded benchmark SQL requests top-N series without metric truncation or whole-history materialization', () => {
  assert.match(BOUNDED_TRENDS_SQL, /ROW_NUMBER\(\) OVER/);
  assert.match(BOUNDED_TRENDS_SQL, /series_rank <= :pointLimit/);
  assert.match(BOUNDED_TRENDS_SQL, /jsonb_to_recordset/);
  assert.doesNotMatch(BOUNDED_TRENDS_SQL, /LIMIT\s+100\b/i);
});

test('phase checkpoints require immutable evidence and reject red critical metrics without a current waiver', () => {
  const checkpoint = generatePhaseCheckpoint({
    aggregate: {
      sampleCount: 5,
      budgets: { homeReadyMs: 1_000 },
      benchmarks: [{ scenario: 'home-load', metrics: { homeReadyMsMedian: 900 } }],
    },
    phase: 'phase-6',
    commit: 'abcdef1234567',
    imageDigest: `sha256:${'1'.repeat(64)}`,
    artifact: `sha256:${'2'.repeat(64)}`,
  });
  assert.deepEqual(validatePhaseCheckpoint(checkpoint), []);

  checkpoint.metrics[0].current = 1_200;
  checkpoint.metrics[0].status = 'red';
  assert.match(validatePhaseCheckpoint(checkpoint).join('\n'), /requires a valid waiver/);
  checkpoint.waivers.push({
    metricKey: checkpoint.metrics[0].key,
    owner: 'performance-owner',
    rationale: 'Known upstream variance while capacity change rolls out.',
    expiresAt: '2026-09-01T00:00:00.000Z',
  });
  assert.deepEqual(validatePhaseCheckpoint(checkpoint, { now: new Date('2026-08-24T00:00:00.000Z') }), []);

  checkpoint.metrics[0].artifact = 'artifacts/latest.json';
  assert.match(validatePhaseCheckpoint(checkpoint).join('\n'), /mutable artifact reference/);
});

function listen(server) {
  return new Promise((resolve) => {
    server.httpServer.listen(0, '127.0.0.1', () => {
      const address = server.httpServer.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function closeServer(server) {
  if (server.httpServer.listening) {
    await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  }
  await server.graphqlServer.stop();
}
