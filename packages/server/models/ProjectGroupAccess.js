import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const ProjectGroupAccess = sequelize.define('ProjectGroupAccess', {
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
  groupId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'project_group_access',
  indexes: [
    { unique: true, fields: ['project_id', 'group_id'] },
    { fields: ['group_id'] },
  ],
});

export default ProjectGroupAccess;
