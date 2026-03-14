import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const UserRole = sequelize.define('UserRole', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  roleId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  indexes: [
    { unique: true, fields: ['user_id', 'role_id'] },
    { fields: ['role_id'] },
  ],
});

export default UserRole;
