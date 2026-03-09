export const id = '20260309_coverage_trend_points';

export async function up({ queryInterface, Sequelize, transaction }) {
  await queryInterface.createTable('coverage_trend_points', {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    project_version_id: foreignKey(Sequelize, 'project_versions'),
    run_id: foreignKey(Sequelize, 'runs', { allowNull: false }),
    project_package_id: foreignKey(Sequelize, 'project_packages'),
    project_module_id: foreignKey(Sequelize, 'project_modules'),
    project_file_id: foreignKey(Sequelize, 'project_files'),
    scope_type: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    scope_hash: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    scope_key: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    label: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    package_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    module_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    file_path: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    recorded_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    lines_covered: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    lines_total: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    lines_pct: {
      type: Sequelize.DOUBLE,
      allowNull: true,
    },
    branches_covered: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    branches_total: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    branches_pct: {
      type: Sequelize.DOUBLE,
      allowNull: true,
    },
    functions_covered: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    functions_total: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    functions_pct: {
      type: Sequelize.DOUBLE,
      allowNull: true,
    },
    statements_covered: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    statements_total: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    statements_pct: {
      type: Sequelize.DOUBLE,
      allowNull: true,
    },
    metadata: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    },
  }, { transaction });

  await queryInterface.addIndex('coverage_trend_points', ['run_id', 'scope_type', 'scope_hash'], {
    name: 'coverage_trend_points_run_scope_unique',
    unique: true,
    transaction,
  });
  await queryInterface.addIndex('coverage_trend_points', ['project_id', 'scope_type', 'recorded_at'], {
    name: 'coverage_trend_points_project_scope_recorded_at_idx',
    transaction,
  });
  await queryInterface.addIndex('coverage_trend_points', ['project_id', 'package_name', 'scope_type', 'recorded_at'], {
    name: 'coverage_trend_points_project_package_scope_recorded_at_idx',
    transaction,
  });
  await queryInterface.addIndex('coverage_trend_points', ['project_id', 'module_name', 'scope_type', 'recorded_at'], {
    name: 'coverage_trend_points_project_module_scope_recorded_at_idx',
    transaction,
  });
  await queryInterface.addIndex('coverage_trend_points', ['project_id', 'file_path', 'scope_type', 'recorded_at'], {
    name: 'coverage_trend_points_project_file_scope_recorded_at_idx',
    transaction,
  });
  await queryInterface.addIndex('coverage_trend_points', ['run_id'], {
    name: 'coverage_trend_points_run_id_idx',
    transaction,
  });
}

export async function down({ queryInterface, transaction }) {
  await queryInterface.dropTable('coverage_trend_points', { transaction });
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
