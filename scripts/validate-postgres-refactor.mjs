#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import sequelize, { dbReady } from '../packages/server/db.js';
import { createIngestionService } from '../packages/server/ingest/index.js';
import { Project, ReportSubmission, RunActiveSubmission } from '../packages/server/models/index.js';
import { createGraphqlQueryService } from '../packages/server/graphql/query-service.js';
import { createPerformanceFixture } from './generate-performance-fixture.mjs';

async function main() {
  try {
    await dbReady({ skipMigrations: true });
    const service = createIngestionService({ sequelize });
    const source = { provider: 'postgres-integration', runId: 'concurrent-kinds-v1', branch: 'main', commitSha: 'integration', completedAt: '2026-08-24T00:00:00.000Z', isPublic: true };
    const base = createPerformanceFixture({ testCount: 100, seed: 'postgres-integration' });
    const submissions = [
      { kind: 'tests', report: base },
      { kind: 'coverage', report: base },
      { kind: 'performance', report: base },
    ];
    const receipts = await Promise.all(submissions.map(({ kind, report }) => service.ingest({ projectKey: 'postgres-refactor-integration', source, report, submission: { kind, producerKey: `integration-${kind}`, submissionKey: kind }, artifacts: [] })));
    const runId = receipts[0].runId;
    const pointers = await RunActiveSubmission.findAll({ where: { runId }, order: [['kind', 'ASC']] });
    const selected = await ReportSubmission.findAll({ where: { id: pointers.map((entry) => entry.reportSubmissionId) } });
    const selectedById = new Map(selected.map((entry) => [entry.id, entry]));
    if (pointers.length !== 3 || pointers.some((pointer) => selectedById.get(pointer.reportSubmissionId)?.kind !== pointer.kind)) throw new Error('Concurrent active submission selection did not preserve all kinds');
    const project = await Project.findOne({ where: { key: 'postgres-refactor-integration' } });
    const actor = { kind: 'service', role: 'service', projectKeys: ['*'] };
    const queryService = createGraphqlQueryService({ benchmarkQueryCache: false });
    const catalog = await queryService.listBenchmarkCatalog({ actor, projectKey: project.key });
    const metrics = catalog.flatMap((entry) => entry.statNames.map((statName) => ({ statGroup: entry.statGroup, statName })));
    const trends = await queryService.listPerformanceTrends({ actor, projectKey: project.key, metrics, limit: 125 });
    if (metrics.length < 139 || trends.length !== metrics.length) throw new Error(`Metric completeness failed: ${trends.length}/${metrics.length}`);
    const evidence = { schemaVersion: '1', runId, receipts, activeKinds: pointers.map((entry) => entry.kind), requestedMetricCount: metrics.length, returnedMetricCount: trends.length, passed: true };
    const output = path.resolve(process.env.TEST_STATION_POSTGRES_EVIDENCE_OUTPUT || 'artifacts/postgres-refactor/evidence.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
