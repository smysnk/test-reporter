import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const RunOverview = sequelize.define('RunOverview', {
  runId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  projectId: { type: DataTypes.UUID, allowNull: false },
  projectVersionId: { type: DataTypes.UUID, allowNull: true },
  externalKey: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'unknown' },
  branch: { type: DataTypes.STRING, allowNull: true },
  commitSha: { type: DataTypes.STRING, allowNull: true },
  sourceRunId: { type: DataTypes.STRING, allowNull: true },
  sourceUrl: { type: DataTypes.TEXT, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  durationMs: { type: DataTypes.INTEGER, allowNull: true },
  buildNumber: { type: DataTypes.INTEGER, allowNull: true },
  linesPct: { type: DataTypes.FLOAT, allowNull: true },
  totalTests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  passedTests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  failedTests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  skippedTests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  hasReportArtifact: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  projectedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  indexes: [
    { fields: ['project_id', 'completed_at', 'run_id'] },
    { fields: ['completed_at', 'run_id'] },
    { fields: ['project_id', 'status', 'completed_at'] },
  ],
});

export default RunOverview;
