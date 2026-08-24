#!/usr/bin/env node

import crypto from 'node:crypto';
import sequelize from '../packages/server/db.js';
import {
  Artifact, CoverageSnapshot, CoverageTrendPoint, ErrorOccurrence, PerformanceStat,
  ReportSubmission, RunActiveSubmission, RunOverview, SuiteRun,
} from '../packages/server/models/index.js';

const FACT_MODELS = [SuiteRun, CoverageSnapshot, CoverageTrendPoint, ErrorOccurrence, PerformanceStat, Artifact];

export async function backfillReportSubmissions({ database = sequelize, batchSize = 100, maxBatches = Number.POSITIVE_INFINITY, dryRun = false } = {}) {
  let batches = 0;
  let runsProcessed = 0;
  let factsUpdated = 0;
  while (batches < maxBatches) {
    const [runs] = await database.query(`
      SELECT r.id, r.project_id, r.project_version_id, r.external_key, r.status, r.branch,
             r.commit_sha, r.source_run_id, r.source_url, r.completed_at, r.duration_ms,
             r.report_schema_version, r.raw_report, r.summary, r.metadata, r.created_at, r.updated_at
      FROM runs r
      WHERE NOT EXISTS (SELECT 1 FROM report_submissions rs WHERE rs.run_id = r.id)
         OR NOT EXISTS (SELECT 1 FROM run_overviews ro WHERE ro.run_id = r.id)
      ORDER BY r.created_at ASC, r.id ASC LIMIT :batchSize
    `, { replacements: { batchSize } });
    if (runs.length === 0) break;
    batches += 1;
    for (const run of runs) {
      if (dryRun) { runsProcessed += 1; continue; }
      await database.transaction(async (transaction) => {
        const rawReport = run.raw_report || {};
        const [submission] = await ReportSubmission.findOrCreate({
          where: { runId: run.id, kind: 'combined', producerKey: 'legacy-backfill', submissionKey: 'legacy', contentHash: hashJson(rawReport) },
          defaults: { revision: 1, schemaVersion: run.report_schema_version, status: 'active', receivedAt: run.updated_at || run.created_at || new Date(), rawReport, summary: run.summary || {}, metadata: { migratedFromRun: true, backfillVersion: 1 } },
          transaction,
        });
        for (const model of FACT_MODELS) {
          const [updated] = await model.update({ reportSubmissionId: submission.id }, { where: { runId: run.id, reportSubmissionId: null }, transaction });
          factsUpdated += Number(updated) || 0;
        }
        for (const kind of ['tests', 'coverage', 'performance']) {
          const [pointer] = await RunActiveSubmission.findOrCreate({ where: { runId: run.id, kind }, defaults: { reportSubmissionId: submission.id, selectedAt: run.updated_at || run.created_at || new Date() }, transaction });
          if (pointer.reportSubmissionId !== submission.id) await pointer.update({ reportSubmissionId: submission.id }, { transaction });
        }
        const summary = run.summary || {};
        await RunOverview.upsert({
          runId: run.id, projectId: run.project_id, projectVersionId: run.project_version_id,
          externalKey: run.external_key, status: run.status, branch: run.branch, commitSha: run.commit_sha,
          sourceRunId: run.source_run_id, sourceUrl: run.source_url, completedAt: run.completed_at,
          durationMs: run.duration_ms, buildNumber: resolveBuildNumber(run.metadata),
          linesPct: numberOrNull(summary?.coverage?.lines?.pct ?? summary?.coverage?.linesPct),
          totalTests: integerOrZero(summary.totalTests ?? summary.total), passedTests: integerOrZero(summary.passedTests ?? summary.passed),
          failedTests: integerOrZero(summary.failedTests ?? summary.failed), skippedTests: integerOrZero(summary.skippedTests ?? summary.skipped),
          hasReportArtifact: false, projectedAt: run.updated_at || new Date(),
        }, { transaction });
        await database.query(`
          INSERT INTO backfill_checkpoints (job_key, cursor, processed_count, status, metadata, created_at, updated_at)
          VALUES ('report-submissions-v1', :cursor, 1, 'running', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (job_key) DO UPDATE SET cursor = EXCLUDED.cursor,
            processed_count = backfill_checkpoints.processed_count + 1, status = 'running', updated_at = CURRENT_TIMESTAMP
        `, { replacements: { cursor: run.id }, transaction });
      });
      runsProcessed += 1;
    }
  }
  if (!dryRun) {
    await rebuildProjectOverviews(database);
    await database.query(`UPDATE backfill_checkpoints SET status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE job_key = 'report-submissions-v1'`);
  }
  return { batches, runsProcessed, factsUpdated, dryRun };
}

async function rebuildProjectOverviews(database) {
  await database.query(`
    INSERT INTO project_overviews (project_id, run_count, latest_run_id, latest_status, latest_completed_at, latest_lines_pct, total_tests, passed_tests, failed_tests, projected_at, created_at, updated_at)
    SELECT DISTINCT ON (project_id) project_id, COUNT(*) OVER (PARTITION BY project_id), run_id, status, completed_at, lines_pct, total_tests, passed_tests, failed_tests, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM run_overviews ORDER BY project_id, completed_at DESC NULLS LAST, run_id DESC
    ON CONFLICT (project_id) DO UPDATE SET run_count = EXCLUDED.run_count, latest_run_id = EXCLUDED.latest_run_id,
      latest_status = EXCLUDED.latest_status, latest_completed_at = EXCLUDED.latest_completed_at,
      latest_lines_pct = EXCLUDED.latest_lines_pct, total_tests = EXCLUDED.total_tests,
      passed_tests = EXCLUDED.passed_tests, failed_tests = EXCLUDED.failed_tests,
      projected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
  `);
}

function hashJson(value) { return crypto.createHash('sha256').update(stableStringify(value)).digest('hex'); }
function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`; return JSON.stringify(value); }
function resolveBuildNumber(metadata) { for (const candidate of [metadata?.source?.buildNumber, metadata?.source?.environment?.GITHUB_RUN_NUMBER, metadata?.source?.ci?.environment?.GITHUB_RUN_NUMBER]) { const value = Number.parseInt(candidate, 10); if (Number.isFinite(value)) return value; } return null; }
function integerOrZero(value) { const number = Number.parseInt(value, 10); return Number.isFinite(number) ? number : 0; }
function numberOrNull(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }

function parseArgs(argv) { const options = {}; for (let index = 0; index < argv.length; index += 1) { if (argv[index] === '--batch-size') options.batchSize = Number(argv[++index]); else if (argv[index] === '--max-batches') options.maxBatches = Number(argv[++index]); else if (argv[index] === '--dry-run') options.dryRun = true; else throw new Error(`Unknown argument: ${argv[index]}`); } if (options.batchSize !== undefined && (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 1_000)) throw new Error('--batch-size must be an integer from 1 to 1000'); if (options.maxBatches !== undefined && (!Number.isInteger(options.maxBatches) || options.maxBatches < 1)) throw new Error('--max-batches must be a positive integer'); return options; }

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) backfillReportSubmissions(parseArgs(process.argv.slice(2))).then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).finally(() => sequelize.close());
