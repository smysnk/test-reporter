import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const ReportSubmission = sequelize.define('ReportSubmission', {
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
    defaultValue: 'combined',
  },
  producerKey: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'default',
  },
  submissionKey: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'default',
  },
  contentHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  revision: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  schemaVersion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'active',
  },
  receivedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  rawReport: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  summary: {
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
    { unique: true, fields: ['run_id', 'kind', 'producer_key', 'submission_key', 'content_hash'] },
    { unique: true, fields: ['run_id', 'kind', 'producer_key', 'submission_key', 'revision'] },
    { unique: true, fields: ['run_id', 'kind', 'producer_key', 'submission_key'], where: { status: 'active' } },
    { fields: ['run_id', 'kind', 'status', 'received_at'] },
  ],
});

export default ReportSubmission;
