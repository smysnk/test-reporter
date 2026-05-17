#!/usr/bin/env node

import { QueryTypes } from 'sequelize';
import sequelize from '../packages/server/db.js';
import { createBenchmarkQueryCache } from '../packages/server/benchmark-query-cache.js';
import { createGraphqlQueryService } from '../packages/server/graphql/query-service.js';

const args = parseArgs(process.argv.slice(2));
const projectKeys = args.projectKeys;
const limit = args.limit ?? 5;
const cacheEnabled = !args.noCache;
const actor = {
  id: 'benchmark-summary-profiler',
  email: 'benchmark-summary-profiler@test-station.local',
  role: 'admin',
  isAdmin: true,
};

await sequelize.authenticate();

const scopedProjects = projectKeys.length > 0
  ? await loadScopedProjectRows(projectKeys)
  : await loadLargestBenchmarkProjects(limit);

if (scopedProjects.length === 0) {
  process.stdout.write('[benchmark:profile] no benchmark-bearing projects found\n');
  await sequelize.close();
  process.exit(0);
}

for (const project of scopedProjects) {
  const benchmarkQueryCache = cacheEnabled ? createBenchmarkQueryCache({ ttlMs: 300000 }) : false;
  const queryService = createGraphqlQueryService({ benchmarkQueryCache });

  if (benchmarkQueryCache && typeof benchmarkQueryCache.clear === 'function') {
    benchmarkQueryCache.clear();
  }
  const summaryCold = await timeAsync(() => queryService.getBenchmarkSummary({ actor, projectKey: project.projectKey }));
  const summaryWarm = await timeAsync(() => queryService.getBenchmarkSummary({ actor, projectKey: project.projectKey }));

  if (benchmarkQueryCache && typeof benchmarkQueryCache.clear === 'function') {
    benchmarkQueryCache.clear();
  }
  const catalogCold = await timeAsync(() => queryService.listBenchmarkCatalog({ actor, projectKey: project.projectKey }));
  const catalogWarm = await timeAsync(() => queryService.listBenchmarkCatalog({ actor, projectKey: project.projectKey }));

  process.stdout.write(`${JSON.stringify({
    projectKey: project.projectKey,
    runCount: project.runCount,
    statCount: project.statCount,
    cacheEnabled,
    summary: {
      coldMs: summaryCold.elapsedMs,
      warmMs: summaryWarm.elapsedMs,
      namespaceCount: summaryCold.value.namespaceCount,
      metricCount: summaryCold.value.metricCount,
      seriesCount: summaryCold.value.seriesCount,
      topChanges: summaryCold.value.topChanges.length,
    },
    catalog: {
      coldMs: catalogCold.elapsedMs,
      warmMs: catalogWarm.elapsedMs,
      namespaceCount: catalogCold.value.length,
    },
  })}\n`);
}

await sequelize.close();

async function loadLargestBenchmarkProjects(limitValue) {
  return sequelize.query(`
    select p.key as "projectKey",
           count(distinct r.id)::int as "runCount",
           count(ps.id)::int as "statCount"
    from projects p
    join runs r on r.project_id = p.id
    join performance_stats ps on ps.run_id = r.id
    group by p.id, p.key
    order by count(ps.id) desc
    limit :limit
  `, {
    replacements: { limit: limitValue },
    type: QueryTypes.SELECT,
  });
}

async function loadScopedProjectRows(projectKeyList) {
  return sequelize.query(`
    select p.key as "projectKey",
           count(distinct r.id)::int as "runCount",
           count(ps.id)::int as "statCount"
    from projects p
    join runs r on r.project_id = p.id
    join performance_stats ps on ps.run_id = r.id
    where p.key in (:projectKeys)
    group by p.id, p.key
    order by count(ps.id) desc
  `, {
    replacements: { projectKeys: projectKeyList },
    type: QueryTypes.SELECT,
  });
}

async function timeAsync(fn) {
  const startedAt = process.hrtime.bigint();
  const value = await fn();
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  return {
    elapsedMs: Number(elapsedMs.toFixed(2)),
    value,
  };
}

function parseArgs(argv) {
  const parsed = {
    limit: null,
    noCache: false,
    projectKeys: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--no-cache') {
      parsed.noCache = true;
      continue;
    }
    if (arg === '--limit') {
      parsed.limit = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === '--project-key') {
      const projectKey = String(argv[index + 1] || '').trim();
      if (projectKey) {
        parsed.projectKeys.push(projectKey);
      }
      index += 1;
    }
  }

  return parsed;
}
