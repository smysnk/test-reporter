import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const CoverageFile = sequelize.define('CoverageFile', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  coverageSnapshotId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  projectFileId: {
    type: DataTypes.UUID,
    allowNull: true,
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
  shared: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  attributionSource: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  attributionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  attributionWeight: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 1,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  indexes: [
    { unique: true, fields: ['coverage_snapshot_id', 'path'] },
  ],
});

export default CoverageFile;
