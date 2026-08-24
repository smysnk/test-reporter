export const id = '20260824_bounded_read_indexes';
export const noTransaction = true;

export async function up({ sequelize }) {
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS performance_stats_bounded_series_idx
    ON performance_stats (stat_group, stat_name, report_submission_id, created_at DESC, id DESC)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS test_executions_suite_status_id_idx
    ON test_executions (suite_run_id, status, id)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS test_executions_full_name_search_idx
    ON test_executions USING GIN (to_tsvector('simple', full_name))
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS run_active_submissions_kind_run_idx
    ON run_active_submissions (kind, run_id, report_submission_id)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS coverage_trend_points_submission_scope_recorded_idx
    ON coverage_trend_points (report_submission_id, scope_type, recorded_at DESC)
  `);
}

export async function down({ sequelize }) {
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS coverage_trend_points_submission_scope_recorded_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS run_active_submissions_kind_run_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS test_executions_full_name_search_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS test_executions_suite_status_id_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS performance_stats_bounded_series_idx');
}
