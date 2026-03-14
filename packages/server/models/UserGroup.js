import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const UserGroup = sequelize.define('UserGroup', {
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
  groupId: {
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
    { unique: true, fields: ['user_id', 'group_id'] },
    { fields: ['group_id'] },
  ],
});

export default UserGroup;
