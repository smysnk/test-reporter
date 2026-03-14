import env from '../../config/env.mjs';

export async function synchronizeBootstrapAdminUsers(options = {}) {
  const adminEmails = resolveBootstrapAdminEmails(options);
  const summary = {
    configured: adminEmails.length,
    processed: adminEmails.length,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  if (adminEmails.length === 0 || !options.userModel || typeof options.userModel.findAll !== 'function') {
    return summary;
  }

  let existingUsers;
  try {
    existingUsers = await loadUsers(options.userModel, adminEmails);
  } catch (error) {
    if (options.allowMissingTable === true && isMissingUserTableError(error)) {
      summary.skipped = adminEmails.length;
      summary.processed = 0;
      return summary;
    }
    throw error;
  }

  const existingByEmail = new Map(existingUsers.map((user) => [normalizeEmail(user.normalizedEmail || user.email), user]));

  for (const email of adminEmails) {
    const existing = existingByEmail.get(email) || null;
    if (!existing) {
      await options.userModel.create({
        email,
        normalizedEmail: email,
        name: email,
        avatarUrl: null,
        isAdmin: true,
        metadata: {
          bootstrapAdmin: true,
          source: 'WEB_ADMIN_EMAILS',
        },
      });
      summary.created += 1;
      continue;
    }

    const patch = {};
    if (existing.isAdmin !== true) {
      patch.isAdmin = true;
    }
    if (!existing.normalizedEmail || normalizeEmail(existing.normalizedEmail) !== email) {
      patch.normalizedEmail = email;
    }
    if (!existing.email) {
      patch.email = email;
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    await updateUserRecord(existing, patch);
    summary.updated += 1;
  }

  return summary;
}

export function resolveBootstrapAdminEmails(options = {}) {
  if (Array.isArray(options.adminEmails)) {
    return normalizeEmailList(options.adminEmails);
  }

  return normalizeEmailList(splitConfiguredValues(env.get('WEB_ADMIN_EMAILS').default('').asString()));
}

export function formatBootstrapAdminSummary(summary) {
  if (!summary || summary.configured === 0) {
    return '[db] bootstrap admin sync skipped (no configured bootstrap admins)';
  }

  return `[db] bootstrap admin sync complete (${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped)`;
}

async function loadUsers(userModel, adminEmails) {
  const rows = await userModel.findAll({
    where: {
      normalizedEmail: adminEmails,
    },
  });

  return (Array.isArray(rows) ? rows : []).map((row) => toPlainRecord(row));
}

async function updateUserRecord(user, patch) {
  if (user && typeof user.update === 'function') {
    await user.update(patch);
    return;
  }

  Object.assign(user, patch);
}

function toPlainRecord(row) {
  if (!row) {
    return null;
  }

  return typeof row.toJSON === 'function'
    ? row
    : row;
}

function normalizeEmailList(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeEmail(value))
      .filter(Boolean),
  ));
}

function normalizeEmail(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : '';
}

function splitConfiguredValues(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isMissingUserTableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /relation ["']?users["']? does not exist/i.test(message)
    || /no such table: users/i.test(message);
}
