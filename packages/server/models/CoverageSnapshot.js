import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const CoverageSnapshot = sequelize.define('CoverageSnapshot', {
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
    { unique: true, fields: ['run_id'] },
  ],
});

export default CoverageSnapshot;
