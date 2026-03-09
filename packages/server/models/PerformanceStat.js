import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const PerformanceStat = sequelize.define('PerformanceStat', {
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
  statGroup: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  statName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  numericValue: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  textValue: {
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

export default PerformanceStat;
