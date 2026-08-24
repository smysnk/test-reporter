#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import sequelize, { dbReady } from '../packages/server/db.js';
import { BOUNDED_TRENDS_SQL } from '../packages/server/graphql/repositories/benchmarkRepository.js';

async function main() {
  const projectKey = process.env.TEST_STATION_PLAN_PROJECT_KEY || 'test-station-performance-fixture';
  const output = path.resolve(process.env.TEST_STATION_PLAN_OUTPUT || 'benchmarks/plans/bounded-trends-postgres16.json');
  await dbReady({ skipMigrations: true });
  const [[project]] = await sequelize.query('SELECT id FROM projects WHERE key = :projectKey', { replacements: { projectKey } });
  if (!project) throw new Error(`Project ${projectKey} not found`);
  const [metrics] = await sequelize.query(`SELECT DISTINCT stat_group AS "statGroup", stat_name AS "statName" FROM performance_stats ORDER BY stat_group, stat_name LIMIT 139`);
  const [rows] = await sequelize.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${BOUNDED_TRENDS_SQL}`, {
    replacements: {
      projectIds: JSON.stringify([project.id]),
      metrics: JSON.stringify(metrics.map((entry) => ({ stat_group: entry.statGroup, stat_name: entry.statName }))),
      pointLimit: 125,
      runnerKey: null,
    },
  });
  const artifact = { schemaVersion: '1', capturedAt: new Date().toISOString(), postgres: '16', projectKey, requestedMetricCount: metrics.length, pointLimit: 125, plan: rows[0]?.['QUERY PLAN'] || rows };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
  await sequelize.close();
}

main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
