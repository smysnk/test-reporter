export const id = '20260309_initial_reporting_schema';

export async function up({ queryInterface, Sequelize, transaction }) {
  const options = { transaction };

  await queryInterface.createTable('projects', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    key: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    slug: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    repository_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    default_branch: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('projects', ['key'], {
    ...options,
    unique: true,
    name: 'projects_key_unique',
  });
  await queryInterface.addIndex('projects', ['slug'], {
    ...options,
    unique: true,
    name: 'projects_slug_unique',
  });

  await queryInterface.createTable('project_versions', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    version_key: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    version_kind: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'commit',
    },
    branch: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    tag: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    commit_sha: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    semantic_version: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    build_number: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    release_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    released_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('project_versions', ['project_id', 'version_key'], {
    ...options,
    unique: true,
    name: 'project_versions_project_id_version_key_unique',
  });

  await queryInterface.createTable('project_packages', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    slug: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    path: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('project_packages', ['project_id', 'name'], {
    ...options,
    unique: true,
    name: 'project_packages_project_id_name_unique',
  });

  await queryInterface.createTable('project_modules', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    project_package_id: foreignKey(Sequelize, 'project_packages'),
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    slug: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    owner: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('project_modules', ['project_id', 'project_package_id', 'name'], {
    ...options,
    unique: true,
    name: 'project_modules_project_id_package_id_name_unique',
  });

  await queryInterface.createTable('project_files', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    project_package_id: foreignKey(Sequelize, 'project_packages'),
    project_module_id: foreignKey(Sequelize, 'project_modules'),
    path: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    language: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('project_files', ['project_id', 'path'], {
    ...options,
    unique: true,
    name: 'project_files_project_id_path_unique',
  });

  await queryInterface.createTable('release_notes', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    project_version_id: foreignKey(Sequelize, 'project_versions'),
    title: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    body: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    source_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    published_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('release_notes', ['project_id', 'published_at'], {
    ...options,
    name: 'release_notes_project_id_published_at_idx',
  });

  await queryInterface.createTable('runs', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    project_version_id: foreignKey(Sequelize, 'project_versions'),
    external_key: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    source_provider: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    source_run_id: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    source_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    triggered_by: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    branch: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    commit_sha: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    started_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    completed_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    duration_ms: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    status: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'unknown',
    },
    report_schema_version: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    raw_report: jsonbColumn(Sequelize, {}),
    summary: jsonbColumn(Sequelize, {}),
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('runs', ['project_id', 'external_key'], {
    ...options,
    unique: true,
    name: 'runs_project_id_external_key_unique',
  });
  await queryInterface.addIndex('runs', ['project_id', 'status'], {
    ...options,
    name: 'runs_project_id_status_idx',
  });

  await queryInterface.createTable('suite_runs', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    run_id: foreignKey(Sequelize, 'runs', { allowNull: false }),
    project_package_id: foreignKey(Sequelize, 'project_packages'),
    package_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    suite_identifier: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    label: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    runtime: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    command: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    cwd: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    status: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'unknown',
    },
    duration_ms: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    summary: jsonbColumn(Sequelize, {}),
    warnings: jsonbColumn(Sequelize, []),
    raw_artifacts: jsonbColumn(Sequelize, []),
    output: jsonbColumn(Sequelize, {}),
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('suite_runs', ['run_id', 'suite_identifier'], {
    ...options,
    unique: true,
    name: 'suite_runs_run_id_suite_identifier_unique',
  });

  await queryInterface.createTable('test_executions', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    suite_run_id: foreignKey(Sequelize, 'suite_runs', { allowNull: false }),
    project_module_id: foreignKey(Sequelize, 'project_modules'),
    project_file_id: foreignKey(Sequelize, 'project_files'),
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    full_name: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    status: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'unknown',
    },
    duration_ms: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    file_path: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    line: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    column: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    classification_source: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    module_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    theme_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    assertions: jsonbColumn(Sequelize, []),
    setup: jsonbColumn(Sequelize, []),
    mocks: jsonbColumn(Sequelize, []),
    failure_messages: jsonbColumn(Sequelize, []),
    raw_details: jsonbColumn(Sequelize, {}),
    source_snippet: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('test_executions', ['suite_run_id', 'status'], {
    ...options,
    name: 'test_executions_suite_run_id_status_idx',
  });
  await queryInterface.addIndex('test_executions', ['project_module_id'], {
    ...options,
    name: 'test_executions_project_module_id_idx',
  });
  await queryInterface.addIndex('test_executions', ['project_file_id'], {
    ...options,
    name: 'test_executions_project_file_id_idx',
  });

  await queryInterface.createTable('coverage_snapshots', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    run_id: foreignKey(Sequelize, 'runs', { allowNull: false }),
    lines_covered: integerColumn(Sequelize),
    lines_total: integerColumn(Sequelize),
    lines_pct: numericColumn(Sequelize),
    branches_covered: integerColumn(Sequelize),
    branches_total: integerColumn(Sequelize),
    branches_pct: numericColumn(Sequelize),
    functions_covered: integerColumn(Sequelize),
    functions_total: integerColumn(Sequelize),
    functions_pct: numericColumn(Sequelize),
    statements_covered: integerColumn(Sequelize),
    statements_total: integerColumn(Sequelize),
    statements_pct: numericColumn(Sequelize),
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('coverage_snapshots', ['run_id'], {
    ...options,
    unique: true,
    name: 'coverage_snapshots_run_id_unique',
  });

  await queryInterface.createTable('coverage_files', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    coverage_snapshot_id: foreignKey(Sequelize, 'coverage_snapshots', { allowNull: false }),
    project_file_id: foreignKey(Sequelize, 'project_files'),
    project_package_id: foreignKey(Sequelize, 'project_packages'),
    project_module_id: foreignKey(Sequelize, 'project_modules'),
    path: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    lines_covered: integerColumn(Sequelize),
    lines_total: integerColumn(Sequelize),
    lines_pct: numericColumn(Sequelize),
    branches_covered: integerColumn(Sequelize),
    branches_total: integerColumn(Sequelize),
    branches_pct: numericColumn(Sequelize),
    functions_covered: integerColumn(Sequelize),
    functions_total: integerColumn(Sequelize),
    functions_pct: numericColumn(Sequelize),
    statements_covered: integerColumn(Sequelize),
    statements_total: integerColumn(Sequelize),
    statements_pct: numericColumn(Sequelize),
    shared: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    attribution_source: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    attribution_reason: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    attribution_weight: {
      type: Sequelize.DOUBLE,
      allowNull: false,
      defaultValue: 1,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('coverage_files', ['coverage_snapshot_id', 'path'], {
    ...options,
    unique: true,
    name: 'coverage_files_snapshot_id_path_unique',
  });

  await queryInterface.createTable('error_occurrences', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    run_id: foreignKey(Sequelize, 'runs'),
    suite_run_id: foreignKey(Sequelize, 'suite_runs'),
    test_execution_id: foreignKey(Sequelize, 'test_executions'),
    level: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'error',
    },
    code: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    message: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    fingerprint: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    stack: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    details: jsonbColumn(Sequelize, {}),
    first_seen_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  }), options);
  await queryInterface.addIndex('error_occurrences', ['run_id'], {
    ...options,
    name: 'error_occurrences_run_id_idx',
  });
  await queryInterface.addIndex('error_occurrences', ['suite_run_id'], {
    ...options,
    name: 'error_occurrences_suite_run_id_idx',
  });
  await queryInterface.addIndex('error_occurrences', ['test_execution_id'], {
    ...options,
    name: 'error_occurrences_test_execution_id_idx',
  });

  await queryInterface.createTable('performance_stats', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    run_id: foreignKey(Sequelize, 'runs'),
    suite_run_id: foreignKey(Sequelize, 'suite_runs'),
    test_execution_id: foreignKey(Sequelize, 'test_executions'),
    stat_group: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    stat_name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    unit: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    numeric_value: {
      type: Sequelize.DOUBLE,
      allowNull: true,
    },
    text_value: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('performance_stats', ['run_id'], {
    ...options,
    name: 'performance_stats_run_id_idx',
  });
  await queryInterface.addIndex('performance_stats', ['suite_run_id'], {
    ...options,
    name: 'performance_stats_suite_run_id_idx',
  });
  await queryInterface.addIndex('performance_stats', ['test_execution_id'], {
    ...options,
    name: 'performance_stats_test_execution_id_idx',
  });

  await queryInterface.createTable('artifacts', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    run_id: foreignKey(Sequelize, 'runs'),
    suite_run_id: foreignKey(Sequelize, 'suite_runs'),
    test_execution_id: foreignKey(Sequelize, 'test_executions'),
    label: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    relative_path: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    href: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    kind: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'file',
    },
    media_type: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    storage_key: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    source_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('artifacts', ['run_id'], {
    ...options,
    name: 'artifacts_run_id_idx',
  });
  await queryInterface.addIndex('artifacts', ['suite_run_id'], {
    ...options,
    name: 'artifacts_suite_run_id_idx',
  });
  await queryInterface.addIndex('artifacts', ['test_execution_id'], {
    ...options,
    name: 'artifacts_test_execution_id_idx',
  });
}

export async function down({ queryInterface, transaction }) {
  const options = { transaction };
  const tables = [
    'artifacts',
    'performance_stats',
    'error_occurrences',
    'coverage_files',
    'coverage_snapshots',
    'test_executions',
    'suite_runs',
    'runs',
    'release_notes',
    'project_files',
    'project_modules',
    'project_packages',
    'project_versions',
    'projects',
  ];

  for (const tableName of tables) {
    await queryInterface.dropTable(tableName, options);
  }
}

function uuidPrimaryKey(Sequelize) {
  return {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4,
  };
}

function foreignKey(Sequelize, tableName, options = {}) {
  return {
    type: Sequelize.UUID,
    allowNull: options.allowNull !== false,
    references: {
      model: tableName,
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: options.allowNull === false ? 'CASCADE' : 'SET NULL',
  };
}

function jsonbColumn(Sequelize, defaultValue) {
  return {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue,
  };
}

function integerColumn(Sequelize) {
  return {
    type: Sequelize.INTEGER,
    allowNull: true,
  };
}

function numericColumn(Sequelize) {
  return {
    type: Sequelize.DOUBLE,
    allowNull: true,
  };
}

function withTimestamps(Sequelize, columns) {
  return {
    ...columns,
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  };
}
