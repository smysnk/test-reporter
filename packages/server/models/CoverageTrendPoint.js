import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const CoverageTrendPoint = sequelize.define('CoverageTrendPoint', {
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
  runId: {
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
  projectFileId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  scopeType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  scopeHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  scopeKey: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  packageName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  moduleName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  filePath: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  recordedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  linesCovered: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  linesTotal: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  linesPct: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  branchesCovered: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  branchesTotal: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  branchesPct: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  functionsCovered: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  functionsTotal: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  functionsPct: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  statementsCovered: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  statementsTotal: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  statementsPct: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  indexes: [
    { unique: true, fields: ['run_id', 'scope_type', 'scope_hash'] },
    { fields: ['project_id', 'scope_type', 'recorded_at'] },
    { fields: ['project_id', 'package_name', 'scope_type', 'recorded_at'] },
    { fields: ['project_id', 'module_name', 'scope_type', 'recorded_at'] },
    { fields: ['project_id', 'file_path', 'scope_type', 'recorded_at'] },
    { fields: ['run_id'] },
  ],
});

export default CoverageTrendPoint;
