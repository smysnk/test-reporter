export const id = '20260825_unified_explorer_indexes';
export const noTransaction = true;

export async function up({ sequelize }) {
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS suite_runs_active_run_id_idx
    ON suite_runs (run_id, report_submission_id, id)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS test_executions_full_name_trgm_idx
    ON test_executions USING GIN (full_name gin_trgm_ops)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS coverage_files_snapshot_lines_id_idx
    ON coverage_files (coverage_snapshot_id, lines_pct, id)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS coverage_files_snapshot_path_id_idx
    ON coverage_files (coverage_snapshot_id, path, id)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS coverage_files_path_trgm_idx
    ON coverage_files USING GIN (path gin_trgm_ops)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS artifacts_run_kind_id_idx
    ON artifacts (run_id, kind, id)
  `);
  await sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS error_occurrences_run_test_submission_idx
    ON error_occurrences (run_id, test_execution_id, report_submission_id, first_seen_at DESC, id DESC)
  `);
}

export async function down({ sequelize }) {
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS error_occurrences_run_test_submission_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS artifacts_run_kind_id_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS coverage_files_path_trgm_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS coverage_files_snapshot_path_id_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS coverage_files_snapshot_lines_id_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS test_executions_full_name_trgm_idx');
  await sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS suite_runs_active_run_id_idx');
}
