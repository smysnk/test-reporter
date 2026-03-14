import { GraphQLError } from 'graphql';
import {
  Group,
  Project,
  ProjectGroupAccess,
  ProjectRoleAccess,
  Role,
  User,
  UserGroup,
  UserRole,
} from '../models/index.js';

export function createGraphqlAdminService(options = {}) {
  const models = options.models || {
    Group,
    Project,
    ProjectGroupAccess,
    ProjectRoleAccess,
    Role,
    User,
    UserGroup,
    UserRole,
  };

  return {
    async listProjectAccesses() {
      const [projects, roles, groups, projectRoleAccess, projectGroupAccess, userRoles, userGroups] = await Promise.all([
        loadAll(models.Project),
        loadAll(models.Role),
        loadAll(models.Group),
        loadAll(models.ProjectRoleAccess),
        loadAll(models.ProjectGroupAccess),
        loadAll(models.UserRole),
        loadAll(models.UserGroup),
      ]);

      const roleMap = mapBy(roles, 'id');
      const groupMap = mapBy(groups, 'id');

      return projects
        .map((project) => decorateProjectAccess(project, {
          roleMap,
          groupMap,
          projectRoleAccess,
          projectGroupAccess,
          userRoles,
          userGroups,
        }))
        .sort((left, right) => compareKeyedRecords(left.project, right.project));
    },

    async listUsers() {
      const [users, roles, groups, userRoles, userGroups] = await Promise.all([
        loadAll(models.User),
        loadAll(models.Role),
        loadAll(models.Group),
        loadAll(models.UserRole),
        loadAll(models.UserGroup),
      ]);
      const roleMap = mapBy(roles, 'id');
      const groupMap = mapBy(groups, 'id');

      return users
        .map((user) => decorateAdminUser(user, {
          roleMap,
          groupMap,
          userRoles,
          userGroups,
        }))
        .sort(compareUsers);
    },

    async findUser({ id = null, email = null }) {
      if (!id && !email) {
        return null;
      }

      const users = await this.listUsers();
      const normalizedEmail = normalizeEmail(email);
      return users.find((user) => (
        (id && user.id === id)
        || (normalizedEmail && user.normalizedEmail === normalizedEmail)
      )) || null;
    },

    async listRoles() {
      const [roles, userRoles, projectRoleAccess] = await Promise.all([
        loadAll(models.Role),
        loadAll(models.UserRole),
        loadAll(models.ProjectRoleAccess),
      ]);

      return roles
        .map((role) => decorateAdminRole(role, {
          userRoles,
          projectRoleAccess,
        }))
        .sort(compareKeyedRecords);
    },

    async listGroups() {
      const [groups, userGroups, projectGroupAccess] = await Promise.all([
        loadAll(models.Group),
        loadAll(models.UserGroup),
        loadAll(models.ProjectGroupAccess),
      ]);

      return groups
        .map((group) => decorateAdminGroup(group, {
          userGroups,
          projectGroupAccess,
        }))
        .sort(compareKeyedRecords);
    },

    async getProjectAccess({ projectId = null, key = null, slug = null }) {
      const project = await findProject(models.Project, { projectId, key, slug });
      if (!project) {
        return null;
      }

      const [roles, groups, projectRoleAccess, projectGroupAccess, userRoles, userGroups] = await Promise.all([
        loadAll(models.Role),
        loadAll(models.Group),
        loadAll(models.ProjectRoleAccess),
        loadAll(models.ProjectGroupAccess),
        loadAll(models.UserRole),
        loadAll(models.UserGroup),
      ]);

      return decorateProjectAccess(project, {
        roleMap: mapBy(roles, 'id'),
        groupMap: mapBy(groups, 'id'),
        projectRoleAccess,
        projectGroupAccess,
        userRoles,
        userGroups,
      });
    },

    async createRole({ input }) {
      const payload = normalizeRoleInput(input);
      const record = await createRecord(models.Role, payload);
      return this.findRoleById(record.id);
    },

    async updateRole({ id, input }) {
      const record = await requireRecord(models.Role, { id }, 'Role');
      const patch = normalizeRolePatch(input);
      await updateRecord(record, patch);
      return this.findRoleById(id);
    },

    async deleteRole({ id }) {
      const role = await this.findRoleById(id);
      if (!role) {
        throw createAdminInputError(`Role ${String(id)} was not found.`);
      }

      await destroyWhere(models.UserRole, { roleId: id });
      await destroyWhere(models.ProjectRoleAccess, { roleId: id });

      const record = await requireRecord(models.Role, { id }, 'Role');
      await destroyRecord(record);
      return role;
    },

    async createGroup({ input }) {
      const payload = normalizeGroupInput(input);
      const record = await createRecord(models.Group, payload);
      return this.findGroupById(record.id);
    },

    async updateGroup({ id, input }) {
      const record = await requireRecord(models.Group, { id }, 'Group');
      const patch = normalizeGroupPatch(input);
      await updateRecord(record, patch);
      return this.findGroupById(id);
    },

    async deleteGroup({ id }) {
      const group = await this.findGroupById(id);
      if (!group) {
        throw createAdminInputError(`Group ${String(id)} was not found.`);
      }

      await destroyWhere(models.UserGroup, { groupId: id });
      await destroyWhere(models.ProjectGroupAccess, { groupId: id });

      const record = await requireRecord(models.Group, { id }, 'Group');
      await destroyRecord(record);
      return group;
    },

    async setUserAdmin({ userId, isAdmin }) {
      const record = await requireRecord(models.User, { id: userId }, 'User');
      await updateRecord(record, {
        isAdmin: isAdmin === true,
      });
      return this.findUser({ id: userId });
    },

    async addUserRole({ userId, roleId }) {
      await requireRecord(models.User, { id: userId }, 'User');
      await requireRecord(models.Role, { id: roleId }, 'Role');
      await ensureJoinRecord(models.UserRole, {
        userId,
        roleId,
        metadata: {},
      });
      return this.findUser({ id: userId });
    },

    async removeUserRole({ userId, roleId }) {
      await destroyWhere(models.UserRole, { userId, roleId });
      return this.findUser({ id: userId });
    },

    async addUserGroup({ userId, groupId }) {
      await requireRecord(models.User, { id: userId }, 'User');
      await requireRecord(models.Group, { id: groupId }, 'Group');
      await ensureJoinRecord(models.UserGroup, {
        userId,
        groupId,
        metadata: {},
      });
      return this.findUser({ id: userId });
    },

    async removeUserGroup({ userId, groupId }) {
      await destroyWhere(models.UserGroup, { userId, groupId });
      return this.findUser({ id: userId });
    },

    async setProjectPublic({ projectId, isPublic }) {
      const record = await requireRecord(models.Project, { id: projectId }, 'Project');
      await updateRecord(record, {
        isPublic: isPublic === true,
      });
      return this.getProjectAccess({ projectId });
    },

    async addProjectRoleAccess({ projectId, roleId }) {
      await requireRecord(models.Project, { id: projectId }, 'Project');
      await requireRecord(models.Role, { id: roleId }, 'Role');
      await ensureJoinRecord(models.ProjectRoleAccess, {
        projectId,
        roleId,
        metadata: {},
      });
      return this.getProjectAccess({ projectId });
    },

    async removeProjectRoleAccess({ projectId, roleId }) {
      await destroyWhere(models.ProjectRoleAccess, { projectId, roleId });
      return this.getProjectAccess({ projectId });
    },

    async addProjectGroupAccess({ projectId, groupId }) {
      await requireRecord(models.Project, { id: projectId }, 'Project');
      await requireRecord(models.Group, { id: groupId }, 'Group');
      await ensureJoinRecord(models.ProjectGroupAccess, {
        projectId,
        groupId,
        metadata: {},
      });
      return this.getProjectAccess({ projectId });
    },

    async removeProjectGroupAccess({ projectId, groupId }) {
      await destroyWhere(models.ProjectGroupAccess, { projectId, groupId });
      return this.getProjectAccess({ projectId });
    },

    async findRoleById(id) {
      const [roles, userRoles, projectRoleAccess] = await Promise.all([
        loadAll(models.Role),
        loadAll(models.UserRole),
        loadAll(models.ProjectRoleAccess),
      ]);
      const role = roles.find((entry) => entry.id === id) || null;
      return role ? decorateAdminRole(role, { userRoles, projectRoleAccess }) : null;
    },

    async findGroupById(id) {
      const [groups, userGroups, projectGroupAccess] = await Promise.all([
        loadAll(models.Group),
        loadAll(models.UserGroup),
        loadAll(models.ProjectGroupAccess),
      ]);
      const group = groups.find((entry) => entry.id === id) || null;
      return group ? decorateAdminGroup(group, { userGroups, projectGroupAccess }) : null;
    },
  };
}

function decorateProjectAccess(project, related) {
  const selectedRoles = related.projectRoleAccess
    .filter((entry) => entry.projectId === project.id)
    .map((entry) => related.roleMap.get(entry.roleId))
    .filter(Boolean)
    .map((role) => decorateAdminRole(role, {
      userRoles: related.userRoles,
      projectRoleAccess: related.projectRoleAccess,
    }))
    .sort(compareKeyedRecords);
  const selectedGroups = related.projectGroupAccess
    .filter((entry) => entry.projectId === project.id)
    .map((entry) => related.groupMap.get(entry.groupId))
    .filter(Boolean)
    .map((group) => decorateAdminGroup(group, {
      userGroups: related.userGroups,
      projectGroupAccess: related.projectGroupAccess,
    }))
    .sort(compareKeyedRecords);

  return {
    project,
    isPublic: project.isPublic === true,
    roleKeys: selectedRoles.map((role) => role.key),
    groupKeys: selectedGroups.map((group) => group.key),
    roles: selectedRoles,
    groups: selectedGroups,
  };
}

function decorateAdminUser(user, related) {
  const roleKeys = related.userRoles
    .filter((entry) => entry.userId === user.id)
    .map((entry) => related.roleMap.get(entry.roleId)?.key)
    .filter(Boolean)
    .sort();
  const groupKeys = related.userGroups
    .filter((entry) => entry.userId === user.id)
    .map((entry) => related.groupMap.get(entry.groupId)?.key)
    .filter(Boolean)
    .sort();

  return {
    id: user.id,
    email: user.email,
    normalizedEmail: user.normalizedEmail,
    name: user.name || null,
    avatarUrl: user.avatarUrl || null,
    isAdmin: user.isAdmin === true,
    roleKeys,
    groupKeys,
  };
}

function decorateAdminRole(role, related) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description || null,
    userCount: related.userRoles.filter((entry) => entry.roleId === role.id).length,
    projectCount: related.projectRoleAccess.filter((entry) => entry.roleId === role.id).length,
  };
}

function decorateAdminGroup(group, related) {
  return {
    id: group.id,
    key: group.key,
    name: group.name,
    description: group.description || null,
    userCount: related.userGroups.filter((entry) => entry.groupId === group.id).length,
    projectCount: related.projectGroupAccess.filter((entry) => entry.groupId === group.id).length,
  };
}

async function findProject(model, { projectId = null, key = null, slug = null }) {
  const projects = await loadAll(model);
  return projects.find((project) => (
    (projectId && project.id === projectId)
    || (key && project.key === key)
    || (slug && project.slug === slug)
  )) || null;
}

function normalizeRoleInput(input) {
  return {
    key: normalizeKey(input?.key, 'Role key is required.'),
    name: normalizeName(input?.name, 'Role name is required.'),
    description: normalizeOptionalText(input?.description),
    metadata: normalizeMetadata(input?.metadata),
  };
}

function normalizeGroupInput(input) {
  return {
    key: normalizeKey(input?.key, 'Group key is required.'),
    name: normalizeName(input?.name, 'Group name is required.'),
    description: normalizeOptionalText(input?.description),
    metadata: normalizeMetadata(input?.metadata),
  };
}

function normalizeRolePatch(input) {
  return normalizePatch(input, {
    key: (value) => normalizeKey(value, 'Role key is required.'),
    name: (value) => normalizeName(value, 'Role name is required.'),
    description: normalizeOptionalText,
    metadata: normalizeMetadata,
  });
}

function normalizeGroupPatch(input) {
  return normalizePatch(input, {
    key: (value) => normalizeKey(value, 'Group key is required.'),
    name: (value) => normalizeName(value, 'Group name is required.'),
    description: normalizeOptionalText,
    metadata: normalizeMetadata,
  });
}

function normalizePatch(input, handlers) {
  const source = input && typeof input === 'object' ? input : {};
  const patch = {};

  for (const [key, handler] of Object.entries(handlers)) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      patch[key] = handler(source[key]);
    }
  }

  return patch;
}

function normalizeKey(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createAdminInputError(message);
  }

  return value.trim().toLowerCase();
}

function normalizeName(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createAdminInputError(message);
  }

  return value.trim();
}

function normalizeOptionalText(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function normalizeMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

async function ensureJoinRecord(model, values) {
  const where = Object.fromEntries(
    Object.entries(values).filter(([key]) => key !== 'metadata'),
  );
  const existing = await findRecord(model, where);
  if (existing) {
    return existing;
  }

  return createRecord(model, values);
}

async function requireRecord(model, where, label) {
  const record = await findRecord(model, where);
  if (!record) {
    throw createAdminInputError(`${label} was not found.`);
  }
  return record;
}

async function findRecord(model, where = {}) {
  if (!model) {
    return null;
  }

  if (typeof model.findOne === 'function') {
    const record = await model.findOne({ where });
    return record || null;
  }

  if (typeof model.findAll !== 'function') {
    return null;
  }

  const rows = await model.findAll();
  return rows.find((row) => matchesWhere(toPlainRecord(row), where)) || null;
}

async function destroyWhere(model, where = {}) {
  if (!model) {
    return 0;
  }

  if (typeof model.destroy === 'function') {
    return model.destroy({ where });
  }

  if (typeof model.findAll !== 'function') {
    return 0;
  }

  const rows = await model.findAll();
  let count = 0;
  for (const row of rows) {
    if (!matchesWhere(toPlainRecord(row), where)) {
      continue;
    }
    if (typeof row.destroy === 'function') {
      await row.destroy();
      count += 1;
    }
  }

  return count;
}

async function loadAll(model) {
  if (!model || typeof model.findAll !== 'function') {
    return [];
  }

  const rows = await model.findAll();
  return rows.map((row) => toPlainRecord(row));
}

async function createRecord(model, values) {
  if (!model || typeof model.create !== 'function') {
    throw new Error('Model does not support create().');
  }

  const record = await model.create(values);
  return toPlainRecord(record);
}

async function updateRecord(record, values) {
  if (!record) {
    throw new Error('Record does not exist.');
  }

  if (typeof record.update === 'function') {
    await record.update(values);
    return;
  }

  Object.assign(record, values);
}

async function destroyRecord(record) {
  if (!record) {
    return;
  }

  if (typeof record.destroy === 'function') {
    await record.destroy();
  }
}

function toPlainRecord(row) {
  if (!row) {
    return null;
  }

  if (typeof row.toJSON === 'function') {
    return row.toJSON();
  }

  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => typeof value !== 'function'),
  );
}

function matchesWhere(row, where) {
  return Object.entries(where).every(([key, value]) => row?.[key] === value);
}

function mapBy(values, key) {
  const map = new Map();
  for (const value of values || []) {
    if (value && value[key] != null) {
      map.set(value[key], value);
    }
  }
  return map;
}

function compareUsers(left, right) {
  const leftKey = left.normalizedEmail || left.email || left.id;
  const rightKey = right.normalizedEmail || right.email || right.id;
  return String(leftKey).localeCompare(String(rightKey));
}

function compareKeyedRecords(left, right) {
  return String(left.key || left.name || left.id).localeCompare(String(right.key || right.name || right.id));
}

function normalizeEmail(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : '';
}

function createAdminInputError(message) {
  return new GraphQLError(message, {
    extensions: {
      code: 'BAD_USER_INPUT',
      http: {
        status: 400,
      },
    },
  });
}
