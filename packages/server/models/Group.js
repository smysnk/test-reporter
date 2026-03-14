import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
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
    { unique: true, fields: ['key'] },
  ],
});

export default Group;
