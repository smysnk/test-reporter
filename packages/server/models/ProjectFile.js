import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const ProjectFile = sequelize.define('ProjectFile', {
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
  projectPackageId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  projectModuleId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  path: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  language: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  indexes: [
    { unique: true, fields: ['project_id', 'path'] },
  ],
});

export default ProjectFile;
