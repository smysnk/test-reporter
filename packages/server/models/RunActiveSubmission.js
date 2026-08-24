import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const RunActiveSubmission = sequelize.define('RunActiveSubmission', {
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
  kind: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  reportSubmissionId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  selectedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  indexes: [
    { unique: true, fields: ['run_id', 'kind'] },
    { fields: ['report_submission_id'] },
  ],
});

export default RunActiveSubmission;
