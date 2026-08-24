import { measureProfileStage } from '../../profiling/requestProfile.js';

export const BOUNDED_TRENDS_SQL = `
      WITH project_scope AS (
        SELECT value::uuid AS project_id
        FROM jsonb_array_elements_text(CAST(:projectIds AS jsonb))
      ), requested_metrics AS (
        SELECT stat_group, stat_name
        FROM jsonb_to_recordset(CAST(:metrics AS jsonb)) AS requested(stat_group text, stat_name text)
      ), ranked AS (
        SELECT
          ps.id,
          ps.run_id AS "runId",
          ps.report_submission_id AS "reportSubmissionId",
          ps.stat_group AS "statGroup",
          ps.stat_name AS "statName",
          ps.unit,
          ps.numeric_value AS "numericValue",
          ps.text_value AS "textValue",
          ps.metadata,
          ps.created_at AS "createdAt",
          ro.project_id AS "projectId",
          p.key AS "projectKey",
          ro.external_key AS "externalKey",
          ro.completed_at AS "completedAt",
          ro.branch,
          ro.commit_sha AS "commitSha",
          pv.version_key AS "versionKey",
          pv.build_number AS "buildNumber",
          ROW_NUMBER() OVER (
            PARTITION BY ps.stat_group, ps.stat_name,
              COALESCE(ps.metadata->>'seriesId', ''),
              COALESCE(ps.metadata->>'runnerKey', ''),
              COALESCE(ro.branch, '')
            ORDER BY ro.completed_at DESC NULLS LAST, ps.created_at DESC, ps.id DESC
          ) AS series_rank,
          ROW_NUMBER() OVER (
            PARTITION BY ps.stat_group, ps.stat_name,
              COALESCE(ps.metadata->>'seriesId', ''),
              COALESCE(ps.metadata->>'runnerKey', ''),
              COALESCE(ro.branch, ''),
              COALESCE(ps.metadata->>'baselineId', '')
            ORDER BY ro.completed_at DESC NULLS LAST, ps.created_at DESC, ps.id DESC
          ) AS baseline_rank
        FROM requested_metrics requested
        JOIN performance_stats ps
          ON ps.stat_group = requested.stat_group
         AND ps.stat_name = requested.stat_name
        JOIN run_active_submissions selected
          ON selected.run_id = ps.run_id
         AND selected.kind = 'performance'
         AND selected.report_submission_id = ps.report_submission_id
        JOIN run_overviews ro ON ro.run_id = ps.run_id
        JOIN project_scope scope ON scope.project_id = ro.project_id
        JOIN projects p ON p.id = ro.project_id
        LEFT JOIN project_versions pv ON pv.id = ro.project_version_id
        WHERE ro.completed_at IS NOT NULL
          AND (:runnerKey IS NULL OR ps.metadata->>'runnerKey' = :runnerKey)
      )
      SELECT *
      FROM ranked
      WHERE series_rank <= :pointLimit
         OR (metadata->>'refactorPhase' = 'phase-0' AND baseline_rank = 1)
      ORDER BY "statGroup", "statName", "completedAt" DESC, "createdAt" DESC, id DESC
    `;

export function canUsePostgresBenchmarkRepository(models) {
  return models?.PerformanceStat?.sequelize?.getDialect?.() === 'postgres'
    && typeof models.PerformanceStat.sequelize.query === 'function';
}

export async function listBoundedPerformanceTrends(models, input) {
  const database = models.PerformanceStat.sequelize;
  const metrics = Array.from(new Map(
    (input.metrics || [])
      .filter((entry) => entry?.statGroup && entry?.statName)
      .map((entry) => [`${entry.statGroup}\0${entry.statName}`, {
        statGroup: entry.statGroup,
        statName: entry.statName,
      }]),
  ).values());
  if (metrics.length === 0 || input.projectIds.length === 0) return [];

  return measureProfileStage('benchmark_trends_repository', async () => {
    const [rows] = await database.query(BOUNDED_TRENDS_SQL, {
      replacements: {
        projectIds: JSON.stringify(input.projectIds),
        metrics: JSON.stringify(metrics.map((entry) => ({
          stat_group: entry.statGroup,
          stat_name: entry.statName,
        }))),
        pointLimit: normalizeLimit(input.limit),
        runnerKey: input.runnerKey || null,
      },
    });

    return rows.map(normalizePerformanceRow);
  }, {
    metricCount: metrics.length,
    projectCount: input.projectIds.length,
    pointLimit: normalizeLimit(input.limit),
  });
}

export async function listBoundedBenchmarkCatalog(models, input) {
  if (!Array.isArray(input.projectIds) || input.projectIds.length === 0) return [];
  const database = models.PerformanceStat.sequelize;
  return measureProfileStage('benchmark_catalog_repository', async () => {
    const [rows] = await database.query(`
      WITH project_scope AS (
        SELECT value::uuid AS project_id
        FROM jsonb_array_elements_text(CAST(:projectIds AS jsonb))
      )
      SELECT
        ro.project_id AS "projectId",
        p.key AS "projectKey",
        ps.stat_group AS "statGroup",
        ARRAY_AGG(DISTINCT ps.stat_name ORDER BY ps.stat_name) AS "statNames",
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT ps.unit ORDER BY ps.unit), NULL) AS units,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT ps.metadata->>'seriesId' ORDER BY ps.metadata->>'seriesId'), NULL) AS "seriesIds",
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT ps.metadata->>'runnerKey' ORDER BY ps.metadata->>'runnerKey'), NULL) AS "runnerKeys",
        MAX(ro.completed_at) AS "latestCompletedAt",
        COUNT(*)::integer AS "pointCount"
      FROM performance_stats ps
      JOIN run_active_submissions selected
        ON selected.run_id = ps.run_id
       AND selected.kind = 'performance'
       AND selected.report_submission_id = ps.report_submission_id
      JOIN run_overviews ro ON ro.run_id = ps.run_id
      JOIN project_scope scope ON scope.project_id = ro.project_id
      JOIN projects p ON p.id = ro.project_id
      GROUP BY ro.project_id, p.key, ps.stat_group
      ORDER BY p.key, ps.stat_group
    `, {
      replacements: { projectIds: JSON.stringify(input.projectIds) },
    });
    return rows.map((row) => ({
      ...row,
      statNames: arrayValue(row.statNames),
      units: arrayValue(row.units),
      seriesIds: arrayValue(row.seriesIds),
      runnerKeys: arrayValue(row.runnerKeys),
      pointCount: Number(row.pointCount) || 0,
    }));
  }, { projectCount: input.projectIds.length });
}

function normalizePerformanceRow(row) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    ...row,
    numericValue: Number.isFinite(Number(row.numericValue)) ? Number(row.numericValue) : null,
    metadata,
    seriesId: metadata.seriesId || null,
    runnerKey: metadata.runnerKey || null,
    buildNumber: Number.isFinite(Number(row.buildNumber)) ? Number(row.buildNumber) : null,
  };
}

function arrayValue(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 1000)) : 125;
}
