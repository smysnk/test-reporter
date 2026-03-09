import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const TestExecution = sequelize.define('TestExecution', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  suiteRunId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  projectModuleId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  projectFileId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fullName: {
    type: DataTypes.TEXT,
    allowNull: false,
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
  filePath: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  line: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  column: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  classificationSource: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  moduleName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  themeName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  assertions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  setup: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  mocks: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  failureMessages: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  rawDetails: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  sourceSnippet: {
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
    { fields: ['suite_run_id', 'status'] },
    { fields: ['project_module_id'] },
    { fields: ['project_file_id'] },
  ],
});

export default TestExecution;
