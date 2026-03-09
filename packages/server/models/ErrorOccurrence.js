import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const ErrorOccurrence = sequelize.define('ErrorOccurrence', {
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
  level: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'error',
  },
  code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  fingerprint: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  stack: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  firstSeenAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  indexes: [
    { fields: ['run_id'] },
    { fields: ['suite_run_id'] },
    { fields: ['test_execution_id'] },
  ],
});

export default ErrorOccurrence;
