import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const ProjectOverview = sequelize.define('ProjectOverview', {
  projectId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  runCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  latestRunId: { type: DataTypes.UUID, allowNull: true },
  latestStatus: { type: DataTypes.STRING, allowNull: true },
  latestCompletedAt: { type: DataTypes.DATE, allowNull: true },
  latestLinesPct: { type: DataTypes.FLOAT, allowNull: true },
  totalTests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  passedTests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  failedTests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  projectedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  indexes: [
    { fields: ['latest_completed_at'] },
    { fields: ['latest_status'] },
  ],
});

export default ProjectOverview;
