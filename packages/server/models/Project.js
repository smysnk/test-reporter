import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  repositoryUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  defaultBranch: {
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
    { unique: true, fields: ['key'] },
    { unique: true, fields: ['slug'] },
  ],
});

export default Project;
