import env from '../../../config/env.mjs';
import { authenticateSharedKeyRequest } from '../ingest/auth.js';
import { Group, Role, User, UserGroup, UserRole } from '../models/index.js';

export async function createGraphqlContext({ req, options = {}, queryService, ingestionService, accessService, adminService }) {
  const actor = await resolveActorFromRequest(req, options);
  const auth = authenticateSharedKeyRequest(req, options, {
    allowMissing: true,
    allowInvalid: true,
    ignoreMissingConfig: true,
  });

  return {
    requestId: req.headers['x-request-id'] || null,
    actor,
    auth,
    accessService,
    adminService,
    queryService,
    ingestionService,
  };
}

export async function resolveActorFromRequest(req, options = {}) {
  if (typeof options.resolveActor === 'function') {
    const resolved = await options.resolveActor(req);
    return normalizeActor(resolved) || createGuestActor();
  }

  const identity = readIdentityFromRequest(req);
  if (!identity.id && !identity.email) {
    return createGuestActor();
  }

  const persistedActor = await resolvePersistedActor(identity, {
    models: resolveAccessModels(options),
    adminEmails: resolveBootstrapAdminEmails(options),
  });

  if (persistedActor) {
    return normalizeActor(persistedActor);
  }

  return normalizeActor({
    id: identity.id || identity.email,
    userId: identity.id || null,
    email: identity.email,
    name: identity.name || identity.email || identity.id,
    role: readHeader(req, 'x-test-station-actor-role') || 'member',
    isAdmin: readHeader(req, 'x-test-station-actor-role') === 'admin',
    isGuest: false,
    roleKeys: [],
    groupKeys: [],
  });
}

function readIdentityFromRequest(req) {
  const id = readHeader(req, 'x-test-station-actor-id');
  const email = readHeader(req, 'x-test-station-actor-email');
  const name = readHeader(req, 'x-test-station-actor-name');

  return {
    id: id || email || null,
    email: email || null,
    name: name || null,
  };
}

async function resolvePersistedActor(identity, options = {}) {
  if (!identity || typeof identity !== 'object') {
    return null;
  }

  const normalizedEmail = normalizeEmail(identity.email);
  if (!normalizedEmail) {
    return null;
  }

  const adminEmails = Array.isArray(options.adminEmails) ? options.adminEmails : [];
  const models = options.models || {};
  const persistedUser = await findOrCreateUserRecord(models.User, {
    email: identity.email,
    normalizedEmail,
    name: identity.name || null,
    avatarUrl: null,
    isAdmin: adminEmails.includes(normalizedEmail),
  });

  if (!persistedUser) {
    return null;
  }

  const userId = persistedUser.id || identity.id || normalizedEmail;
  const roleKeys = await loadMembershipKeys(models.UserRole, models.Role, 'roleId', userId);
  const groupKeys = await loadMembershipKeys(models.UserGroup, models.Group, 'groupId', userId);
  const isAdmin = normalizeBooleanFlag(persistedUser.isAdmin) || adminEmails.includes(normalizedEmail);

  return {
    id: userId,
    userId,
    email: persistedUser.email || identity.email,
    name: persistedUser.name || identity.name || persistedUser.email || userId,
    role: isAdmin ? 'admin' : 'member',
    isAdmin,
    isGuest: false,
    roleKeys,
    groupKeys,
  };
}

async function findOrCreateUserRecord(model, input) {
  if (!model) {
    return null;
  }

  const existingRecord = await findRecord(model, {
    normalizedEmail: input.normalizedEmail,
  });

  if (existingRecord) {
    const current = toPlainRecord(existingRecord);
    const patch = {};
    const nextIsAdmin = normalizeBooleanFlag(current.isAdmin) || normalizeBooleanFlag(input.isAdmin);

    if (input.email && input.email !== current.email) {
      patch.email = input.email;
    }
    if (input.name && input.name !== current.name) {
      patch.name = input.name;
    }
    if (input.avatarUrl !== current.avatarUrl) {
      patch.avatarUrl = input.avatarUrl;
    }
    if (normalizeBooleanFlag(current.isAdmin) !== nextIsAdmin) {
      patch.isAdmin = nextIsAdmin;
    }

    if (Object.keys(patch).length > 0) {
      await updateRecord(existingRecord, patch);
    }

    return {
      ...current,
      ...patch,
      normalizedEmail: current.normalizedEmail || input.normalizedEmail,
    };
  }

  if (typeof model.create === 'function') {
    const created = await model.create({
      email: input.email || input.normalizedEmail,
      normalizedEmail: input.normalizedEmail,
      name: input.name || input.email || input.normalizedEmail,
      avatarUrl: input.avatarUrl || null,
      isAdmin: normalizeBooleanFlag(input.isAdmin),
      metadata: {},
    });
    return toPlainRecord(created);
  }

  return {
    id: input.normalizedEmail,
    email: input.email || input.normalizedEmail,
    normalizedEmail: input.normalizedEmail,
    name: input.name || input.email || input.normalizedEmail,
    avatarUrl: input.avatarUrl || null,
    isAdmin: normalizeBooleanFlag(input.isAdmin),
    metadata: {},
  };
}

async function loadMembershipKeys(joinModel, targetModel, targetForeignKey, userId) {
  const joinRows = await loadAll(joinModel);
  const targetRows = await loadAll(targetModel);
  const targetMap = new Map(targetRows.map((row) => [row.id, row]));

  return Array.from(new Set(
    joinRows
      .filter((row) => row.userId === userId)
      .map((row) => targetMap.get(row[targetForeignKey])?.key)
      .filter((key) => typeof key === 'string' && key.trim()),
  ));
}

function resolveAccessModels(options = {}) {
  const models = options.models || {};

  if (options.models) {
    return {
      User: models.User || null,
      Role: models.Role || null,
      Group: models.Group || null,
      UserRole: models.UserRole || null,
      UserGroup: models.UserGroup || null,
    };
  }

  return {
    User,
    Role,
    Group,
    UserRole,
    UserGroup,
  };
}

function resolveBootstrapAdminEmails(options = {}) {
  if (Array.isArray(options.adminEmails)) {
    return normalizeStringArray(options.adminEmails).map((entry) => normalizeEmail(entry)).filter(Boolean);
  }

  return splitHeaderValues(env.get('WEB_ADMIN_EMAILS').default('').asString())
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

function normalizeActor(actor) {
  if (!actor || typeof actor !== 'object') {
    return null;
  }

  const id = typeof actor.id === 'string' && actor.id.trim() ? actor.id.trim() : null;
  const userId = typeof actor.userId === 'string' && actor.userId.trim() ? actor.userId.trim() : null;
  const email = typeof actor.email === 'string' && actor.email.trim() ? actor.email.trim() : null;
  const isGuest = normalizeBooleanFlag(actor.isGuest);
  if (!isGuest && !id && !email) {
    return null;
  }

  const isAdmin = normalizeBooleanFlag(actor.isAdmin)
    || (typeof actor.role === 'string' && actor.role.trim().toLowerCase() === 'admin');
  const normalizedId = id || userId || email || 'guest';

  return {
    id: normalizedId,
    userId: userId || (isGuest ? null : normalizedId),
    email,
    name: typeof actor.name === 'string' && actor.name.trim() ? actor.name.trim() : (email || normalizedId),
    role: isGuest ? 'guest' : (isAdmin ? 'admin' : 'member'),
    isAdmin,
    isGuest,
    roleKeys: normalizeStringArray(actor.roleKeys),
    groupKeys: normalizeStringArray(actor.groupKeys),
  };
}

function createGuestActor() {
  return normalizeActor({
    id: 'guest',
    userId: null,
    email: null,
    name: 'Guest',
    role: 'guest',
    isAdmin: false,
    isGuest: true,
    roleKeys: [],
    groupKeys: [],
  });
}

function readHeader(req, headerName) {
  const value = req.headers[headerName];
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return typeof value === 'string' ? value : '';
}

function splitHeaderValues(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeStringArray(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean),
  ));
}

function normalizeEmail(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : '';
}

function normalizeBooleanFlag(value) {
  return value === true;
}

async function findRecord(model, where = {}) {
  if (!model) {
    return null;
  }

  if (typeof model.findOne === 'function') {
    const record = await model.findOne({ where });
    return record || null;
  }

  const rows = typeof model.findAll === 'function' ? await model.findAll() : [];
  return rows.find((row) => matchesWhere(toPlainRecord(row), where)) || null;
}

async function loadAll(model) {
  if (!model || typeof model.findAll !== 'function') {
    return [];
  }

  const rows = await model.findAll();
  return rows.map((row) => toPlainRecord(row));
}

async function updateRecord(record, patch) {
  if (!record || !patch || Object.keys(patch).length === 0) {
    return record;
  }

  if (typeof record.update === 'function') {
    await record.update(patch);
    return record;
  }

  Object.assign(record, patch);
  return record;
}

function matchesWhere(row, where) {
  return Object.entries(where || {}).every(([key, value]) => row?.[key] === value);
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
