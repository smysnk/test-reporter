export const id = '20260722_report_submissions_and_read_indexes';

const FACT_TABLES = [
  'suite_runs',
  'coverage_snapshots',
  'coverage_trend_points',
  'error_occurrences',
  'performance_stats',
  'artifacts',
];

export async function up({ sequelize, queryInterface, Sequelize, transaction }) {
  const options = { transaction };
  await queryInterface.createTable('report_submissions', {
    id: uuidPrimaryKey(Sequelize),
    run_id: foreignKey(Sequelize, 'runs', false),
    kind: { type: Sequelize.STRING, allowNull: false, defaultValue: 'combined' },
    producer_key: { type: Sequelize.STRING, allowNull: false, defaultValue: 'legacy' },
    submission_key: { type: Sequelize.STRING, allowNull: false, defaultValue: 'legacy' },
    content_hash: { type: Sequelize.STRING, allowNull: false },
    revision: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    schema_version: { type: Sequelize.STRING, allowNull: true },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
    received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    raw_report: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
    summary: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  }, options);

  await queryInterface.addIndex('report_submissions', ['run_id', 'kind', 'producer_key', 'submission_key', 'content_hash'], {
    ...options,
    unique: true,
    name: 'report_submissions_identity_content_unique',
  });
  await queryInterface.addIndex('report_submissions', ['run_id', 'kind', 'producer_key', 'submission_key', 'revision'], {
    ...options,
    unique: true,
    name: 'report_submissions_identity_revision_unique',
  });
  await queryInterface.addIndex('report_submissions', ['run_id', 'kind', 'producer_key', 'submission_key'], {
    ...options,
    unique: true,
    where: { status: 'active' },
    name: 'report_submissions_active_identity_unique',
  });
  await queryInterface.addIndex('report_submissions', ['run_id', 'kind', 'status', 'received_at'], {
    ...options,
    name: 'report_submissions_run_kind_status_received_idx',
  });

  await queryInterface.createTable('run_active_submissions', {
    id: uuidPrimaryKey(Sequelize),
    run_id: foreignKey(Sequelize, 'runs', false),
    kind: { type: Sequelize.STRING, allowNull: false },
    report_submission_id: foreignKey(Sequelize, 'report_submissions', false),
    selected_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  }, options);
  await queryInterface.addIndex('run_active_submissions', ['run_id', 'kind'], {
    ...options,
    unique: true,
    name: 'run_active_submissions_run_kind_unique',
  });
  await queryInterface.addIndex('run_active_submissions', ['report_submission_id'], {
    ...options,
    name: 'run_active_submissions_submission_idx',
  });

  await queryInterface.createTable('run_overviews', {
    run_id: foreignKey(Sequelize, 'runs', false, true),
    project_id: foreignKey(Sequelize, 'projects', false),
    project_version_id: foreignKey(Sequelize, 'project_versions', true),
    external_key: { type: Sequelize.STRING, allowNull: false },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'unknown' },
    branch: { type: Sequelize.STRING, allowNull: true },
    commit_sha: { type: Sequelize.STRING, allowNull: true },
    source_run_id: { type: Sequelize.STRING, allowNull: true },
    source_url: { type: Sequelize.TEXT, allowNull: true },
    completed_at: { type: Sequelize.DATE, allowNull: true },
    duration_ms: { type: Sequelize.INTEGER, allowNull: true },
    build_number: { type: Sequelize.INTEGER, allowNull: true },
    lines_pct: { type: Sequelize.FLOAT, allowNull: true },
    total_tests: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    passed_tests: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    failed_tests: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    skipped_tests: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    has_report_artifact: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    projected_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  }, options);
  await queryInterface.addIndex('run_overviews', ['project_id', 'completed_at', 'run_id'], {
    ...options,
    name: 'run_overviews_project_completed_run_idx',
  });
  await queryInterface.addIndex('run_overviews', ['completed_at', 'run_id'], {
    ...options,
    name: 'run_overviews_completed_run_idx',
  });
  await queryInterface.addIndex('run_overviews', ['project_id', 'status', 'completed_at'], {
    ...options,
    name: 'run_overviews_project_status_completed_idx',
  });

  await queryInterface.createTable('project_overviews', {
    project_id: foreignKey(Sequelize, 'projects', false, true),
    run_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    latest_run_id: foreignKey(Sequelize, 'runs', true),
    latest_status: { type: Sequelize.STRING, allowNull: true },
    latest_completed_at: { type: Sequelize.DATE, allowNull: true },
    latest_lines_pct: { type: Sequelize.FLOAT, allowNull: true },
    total_tests: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    passed_tests: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    failed_tests: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    projected_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  }, options);
  await queryInterface.addIndex('project_overviews', ['latest_completed_at'], {
    ...options,
    name: 'project_overviews_latest_completed_idx',
  });

  await queryInterface.createTable('backfill_checkpoints', {
    job_key: { type: Sequelize.STRING, allowNull: false, primaryKey: true },
    cursor: { type: Sequelize.STRING, allowNull: true },
    processed_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'running' },
    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  }, options);

  for (const table of FACT_TABLES) {
    await queryInterface.addColumn(table, 'report_submission_id', foreignKey(Sequelize, 'report_submissions', true), options);
  }

  await queryInterface.removeIndex('suite_runs', 'suite_runs_run_id_suite_identifier_unique', options);
  await queryInterface.addIndex('suite_runs', ['run_id', 'suite_identifier'], {
    ...options,
    name: 'suite_runs_run_id_suite_identifier_idx',
  });
  await queryInterface.addIndex('suite_runs', ['report_submission_id', 'suite_identifier'], {
    ...options,
    unique: true,
    name: 'suite_runs_submission_suite_identifier_unique',
  });

  await queryInterface.removeIndex('coverage_snapshots', 'coverage_snapshots_run_id_unique', options);
  await queryInterface.addIndex('coverage_snapshots', ['run_id'], {
    ...options,
    name: 'coverage_snapshots_run_id_idx',
  });
  await queryInterface.addIndex('coverage_snapshots', ['report_submission_id'], {
    ...options,
    unique: true,
    name: 'coverage_snapshots_submission_unique',
  });

  await queryInterface.removeIndex('coverage_trend_points', 'coverage_trend_points_run_scope_unique', options);
  await queryInterface.addIndex('coverage_trend_points', ['report_submission_id', 'scope_type', 'scope_hash'], {
    ...options,
    unique: true,
    name: 'coverage_trend_points_submission_scope_unique',
  });

  for (const table of FACT_TABLES) {
    await queryInterface.addIndex(table, ['report_submission_id'], {
      ...options,
      name: `${table}_report_submission_id_idx`,
    }).catch((error) => {
      if (!/already exists/i.test(String(error?.message))) throw error;
    });
  }

  await queryInterface.addIndex('runs', ['project_id', 'completed_at', 'id'], {
    ...options,
    name: 'runs_project_completed_id_idx',
  });
  await queryInterface.addIndex('runs', ['completed_at', 'id'], {
    ...options,
    name: 'runs_completed_id_idx',
  });
}

export async function down({ queryInterface, transaction }) {
  const options = { transaction };
  await queryInterface.dropTable('backfill_checkpoints', options);
  await queryInterface.dropTable('project_overviews', options);
  await queryInterface.dropTable('run_overviews', options);
  await queryInterface.removeIndex('runs', 'runs_completed_id_idx', options);
  await queryInterface.removeIndex('runs', 'runs_project_completed_id_idx', options);
  await queryInterface.removeIndex('coverage_trend_points', 'coverage_trend_points_submission_scope_unique', options);
  await queryInterface.addIndex('coverage_trend_points', ['run_id', 'scope_type', 'scope_hash'], {
    ...options,
    unique: true,
    name: 'coverage_trend_points_run_scope_unique',
  });
  await queryInterface.removeIndex('coverage_snapshots', 'coverage_snapshots_submission_unique', options);
  await queryInterface.removeIndex('coverage_snapshots', 'coverage_snapshots_run_id_idx', options);
  await queryInterface.addIndex('coverage_snapshots', ['run_id'], {
    ...options,
    unique: true,
    name: 'coverage_snapshots_run_id_unique',
  });
  await queryInterface.removeIndex('suite_runs', 'suite_runs_submission_suite_identifier_unique', options);
  await queryInterface.removeIndex('suite_runs', 'suite_runs_run_id_suite_identifier_idx', options);
  await queryInterface.addIndex('suite_runs', ['run_id', 'suite_identifier'], {
    ...options,
    unique: true,
    name: 'suite_runs_run_id_suite_identifier_unique',
  });
  for (const table of FACT_TABLES) {
    await queryInterface.removeIndex(table, `${table}_report_submission_id_idx`, options).catch(() => {});
    await queryInterface.removeColumn(table, 'report_submission_id', options);
  }
  await queryInterface.dropTable('run_active_submissions', options);
  await queryInterface.dropTable('report_submissions', options);
}

function uuidPrimaryKey(Sequelize) {
  return { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.UUIDV4, primaryKey: true };
}

function foreignKey(Sequelize, table, allowNull, primaryKey = false) {
  return {
    type: Sequelize.UUID,
    allowNull,
    ...(primaryKey ? { primaryKey: true } : {}),
    references: { model: table, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  };
}
