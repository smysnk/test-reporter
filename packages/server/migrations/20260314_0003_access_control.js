export const id = '20260314_access_control';

export async function up({ queryInterface, Sequelize, transaction }) {
  const options = { transaction };

  await queryInterface.addColumn('projects', 'is_public', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  }, options);

  await queryInterface.createTable('users', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    email: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    normalized_email: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    avatar_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    is_admin: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('users', ['normalized_email'], {
    ...options,
    unique: true,
    name: 'users_normalized_email_unique',
  });

  await queryInterface.createTable('roles', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    key: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('roles', ['key'], {
    ...options,
    unique: true,
    name: 'roles_key_unique',
  });

  await queryInterface.createTable('groups', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    key: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('groups', ['key'], {
    ...options,
    unique: true,
    name: 'groups_key_unique',
  });

  await queryInterface.createTable('user_roles', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    user_id: foreignKey(Sequelize, 'users', { allowNull: false }),
    role_id: foreignKey(Sequelize, 'roles', { allowNull: false }),
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('user_roles', ['user_id', 'role_id'], {
    ...options,
    unique: true,
    name: 'user_roles_user_id_role_id_unique',
  });
  await queryInterface.addIndex('user_roles', ['role_id'], {
    ...options,
    name: 'user_roles_role_id_idx',
  });

  await queryInterface.createTable('user_groups', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    user_id: foreignKey(Sequelize, 'users', { allowNull: false }),
    group_id: foreignKey(Sequelize, 'groups', { allowNull: false }),
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('user_groups', ['user_id', 'group_id'], {
    ...options,
    unique: true,
    name: 'user_groups_user_id_group_id_unique',
  });
  await queryInterface.addIndex('user_groups', ['group_id'], {
    ...options,
    name: 'user_groups_group_id_idx',
  });

  await queryInterface.createTable('project_role_access', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    role_id: foreignKey(Sequelize, 'roles', { allowNull: false }),
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('project_role_access', ['project_id', 'role_id'], {
    ...options,
    unique: true,
    name: 'project_role_access_project_id_role_id_unique',
  });
  await queryInterface.addIndex('project_role_access', ['role_id'], {
    ...options,
    name: 'project_role_access_role_id_idx',
  });

  await queryInterface.createTable('project_group_access', withTimestamps(Sequelize, {
    id: uuidPrimaryKey(Sequelize),
    project_id: foreignKey(Sequelize, 'projects', { allowNull: false }),
    group_id: foreignKey(Sequelize, 'groups', { allowNull: false }),
    metadata: jsonbColumn(Sequelize, {}),
  }), options);
  await queryInterface.addIndex('project_group_access', ['project_id', 'group_id'], {
    ...options,
    unique: true,
    name: 'project_group_access_project_id_group_id_unique',
  });
  await queryInterface.addIndex('project_group_access', ['group_id'], {
    ...options,
    name: 'project_group_access_group_id_idx',
  });
}

export async function down({ queryInterface, transaction }) {
  const options = { transaction };

  await queryInterface.dropTable('project_group_access', options);
  await queryInterface.dropTable('project_role_access', options);
  await queryInterface.dropTable('user_groups', options);
  await queryInterface.dropTable('user_roles', options);
  await queryInterface.dropTable('groups', options);
  await queryInterface.dropTable('roles', options);
  await queryInterface.dropTable('users', options);
  await queryInterface.removeColumn('projects', 'is_public', options);
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

function jsonbColumn(Sequelize, defaultValue) {
  return {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue,
  };
}
