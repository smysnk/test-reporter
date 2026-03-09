import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Artifact = sequelize.define('Artifact', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  runId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  suiteRunId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  testExecutionId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  relativePath: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  href: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  kind: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'file',
  },
  mediaType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  storageKey: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sourceUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  indexes: [
    { fields: ['run_id'] },
    { fields: ['suite_run_id'] },
    { fields: ['test_execution_id'] },
  ],
});

export default Artifact;
