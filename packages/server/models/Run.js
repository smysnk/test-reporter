import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Run = sequelize.define('Run', {
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
  projectVersionId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  externalKey: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sourceProvider: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sourceRunId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sourceUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  triggeredBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  commitSha: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  durationMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'unknown',
  },
  reportSchemaVersion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  rawReport: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  summary: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  indexes: [
    { unique: true, fields: ['project_id', 'external_key'] },
    { fields: ['project_id', 'status'] },
  ],
});

export default Run;
