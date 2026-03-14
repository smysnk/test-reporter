import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  normalizedEmail: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  avatarUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  indexes: [
    { unique: true, fields: ['normalized_email'] },
  ],
});

export default User;
