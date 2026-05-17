import test from 'node:test';
import assert from 'node:assert/strict';
import { createBenchmarkQueryCache } from '../packages/server/benchmark-query-cache.js';
import { createGraphqlQueryService } from '../packages/server/graphql/query-service.js';
import { classifyBenchmarkComparison, resolveBenchmarkSemantics } from '../packages/core/src/benchmark-semantics.js';

test('benchmark semantics supports project-specific neutral overrides', () => {
  const semantics = resolveBenchmarkSemantics({
    projectKey: 'varcad-io',
    statGroup: 'benchmark.varcad.gallery.widget.example',
    statName: 'canvas_created_count',
    unit: 'count',
  });

  assert.equal(semantics.comparisonMode, 'neutral');
  assert.equal(semantics.semanticsSource, 'override');

  const classification = classifyBenchmarkComparison({
    projectKey: 'varcad-io',
    statGroup: 'benchmark.varcad.gallery.widget.example',
    statName: 'canvas_created_count',
    unit: 'count',
    latestPoint: {
      projectKey: 'varcad-io',
      statGroup: 'benchmark.varcad.gallery.widget.example',
      statName: 'canvas_created_count',
      unit: 'count',
      numericValue: 12,
    },
    previousPoint: {
      projectKey: 'varcad-io',
      statGroup: 'benchmark.varcad.gallery.widget.example',
      statName: 'canvas_created_count',
      unit: 'count',
      numericValue: 9,
    },
  });

  assert.equal(classification.status, 'stable');
  assert.equal(classification.directionStatus, 'neutral');
  assert.ok(Math.abs(classification.deltaPercent - 33.33333333333333) < 1e-9);
});

test('benchmark query cache stores and invalidates project summaries and catalogs', () => {
  const cache = createBenchmarkQueryCache({ ttlMs: 1000 });
  const summary = { projectKey: 'workspace', topChanges: [] };
  const catalog = [{ projectKey: 'workspace', statGroup: 'benchmark.workspace' }];

  cache.writeSummary({ projectId: 'project-1', projectKey: 'workspace' }, summary);
  cache.writeCatalog({ projectId: 'project-1', projectKey: 'workspace' }, catalog);

  assert.equal(cache.readSummary({ projectId: 'project-1' }), summary);
  assert.equal(cache.readSummary({ projectKey: 'workspace' }), summary);
  assert.equal(cache.readCatalog({ projectKey: 'workspace' }), catalog);

  cache.invalidateProject({ projectKey: 'workspace' });

  assert.equal(cache.readSummary({ projectKey: 'workspace' }), null);
  assert.equal(cache.readCatalog({ projectId: 'project-1' }), null);
});

test('query service caches single-project benchmark summary and catalog reads', async () => {
  const projectRows = [{
    id: 'project-1',
    key: 'workspace',
    slug: 'workspace',
    name: 'Workspace',
    isPublic: true,
  }];
  const runRows = [
    {
      id: 'run-2',
      projectId: 'project-1',
      projectVersionId: 'version-2',
      externalKey: 'workspace:2',
      branch: 'main',
      startedAt: '2026-05-17T11:05:00.000Z',
      completedAt: '2026-05-17T11:06:00.000Z',
    },
    {
      id: 'run-1',
      projectId: 'project-1',
      projectVersionId: 'version-1',
      externalKey: 'workspace:1',
      branch: 'main',
      startedAt: '2026-05-17T10:05:00.000Z',
      completedAt: '2026-05-17T10:06:00.000Z',
    },
  ];
  const projectVersionRows = [
    { id: 'version-1', versionKey: 'commit:111' },
    { id: 'version-2', versionKey: 'commit:222' },
  ];
  const statRows = [
    {
      id: 'stat-2',
      runId: 'run-2',
      statGroup: 'benchmark.workspace.render',
      statName: 'elapsed_ms',
      unit: 'ms',
      numericValue: 120,
      metadata: { seriesId: 'default', runnerKey: 'playwright' },
    },
    {
      id: 'stat-1',
      runId: 'run-1',
      statGroup: 'benchmark.workspace.render',
      statName: 'elapsed_ms',
      unit: 'ms',
      numericValue: 100,
      metadata: { seriesId: 'default', runnerKey: 'playwright' },
    },
  ];

  const calls = {
    runs: 0,
    stats: 0,
  };
  const models = {
    Project: createFakeModel(projectRows),
    Run: createFakeModel(runRows, (options) => {
      calls.runs += 1;
      assert.ok(Array.isArray(options.attributes));
      assert.equal(options.attributes.includes('rawReport'), false);
      return runRows;
    }),
    ProjectVersion: createFakeModel(projectVersionRows),
    PerformanceStat: createFakeModel(statRows, (options) => {
      calls.stats += 1;
      assert.ok(Array.isArray(options.attributes));
      assert.deepEqual(options.attributes, ['id', 'runId', 'statGroup', 'statName', 'unit', 'numericValue', 'metadata']);
      return statRows;
    }),
  };
  const accessService = {
    async filterProjects({ projects }) {
      return projects;
    },
  };
  const benchmarkQueryCache = createBenchmarkQueryCache({ ttlMs: 60000 });
  const queryService = createGraphqlQueryService({ models, accessService, benchmarkQueryCache });
  const actor = { id: 'actor-1', role: 'admin', isAdmin: true };

  const summaryFirst = await queryService.getBenchmarkSummary({ actor, projectKey: 'workspace' });
  const summarySecond = await queryService.getBenchmarkSummary({ actor, projectKey: 'workspace' });
  const catalogFirst = await queryService.listBenchmarkCatalog({ actor, projectKey: 'workspace' });
  const catalogSecond = await queryService.listBenchmarkCatalog({ actor, projectKey: 'workspace' });

  assert.equal(summaryFirst.projectKey, 'workspace');
  assert.equal(summarySecond.projectKey, 'workspace');
  assert.equal(catalogFirst.length, 1);
  assert.equal(catalogSecond.length, 1);
  assert.equal(calls.runs, 2);
  assert.equal(calls.stats, 2);

  benchmarkQueryCache.invalidateProject({ projectKey: 'workspace' });
  await queryService.getBenchmarkSummary({ actor, projectKey: 'workspace' });
  await queryService.listBenchmarkCatalog({ actor, projectKey: 'workspace' });

  assert.equal(calls.runs, 4);
  assert.equal(calls.stats, 4);
});

function createFakeModel(rows, findAllOverride = null) {
  return {
    async findAll(options = {}) {
      if (typeof findAllOverride === 'function') {
        return findAllOverride(options);
      }

      const where = options.where || {};
      return rows.filter((row) => matchesWhere(row, where));
    },
  };
}

function matchesWhere(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (Array.isArray(value)) {
      return value.includes(row[key]);
    }
    return row[key] === value;
  });
}
