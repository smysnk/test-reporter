import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const ProjectVersion = sequelize.define('ProjectVersion', {
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
  versionKey: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  versionKind: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'commit',
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tag: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  commitSha: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  semanticVersion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  buildNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  releaseName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  releasedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  indexes: [
    { unique: true, fields: ['project_id', 'version_key'] },
  ],
});

export default ProjectVersion;
