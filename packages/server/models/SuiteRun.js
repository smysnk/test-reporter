import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const SuiteRun = sequelize.define('SuiteRun', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  runId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  projectPackageId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  packageName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  suiteIdentifier: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  runtime: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  command: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  cwd: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'unknown',
  },
  durationMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  summary: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  warnings: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  rawArtifacts: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  output: {
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
    { unique: true, fields: ['run_id', 'suite_identifier'] },
  ],
});

export default SuiteRun;
