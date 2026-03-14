import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const ProjectRoleAccess = sequelize.define('ProjectRoleAccess', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  roleId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'project_role_access',
  indexes: [
    { unique: true, fields: ['project_id', 'role_id'] },
    { fields: ['role_id'] },
  ],
});

export default ProjectRoleAccess;
