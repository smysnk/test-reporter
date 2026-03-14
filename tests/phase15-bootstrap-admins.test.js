import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBootstrapAdminSummary,
  resolveBootstrapAdminEmails,
  synchronizeBootstrapAdminUsers,
} from '../packages/server/bootstrapAdminUsers.js';

test('bootstrap admin sync creates missing users and elevates existing ones', async () => {
  const userModel = createMutableUserModel([
    {
      id: 'user-1',
      email: 'member@example.com',
      normalizedEmail: 'member@example.com',
      name: 'Member User',
      avatarUrl: null,
      isAdmin: false,
      metadata: {},
    },
    {
      id: 'user-2',
      email: 'admin@example.com',
      normalizedEmail: 'admin@example.com',
      name: 'Existing Admin',
      avatarUrl: null,
      isAdmin: true,
      metadata: {},
    },
  ]);

  const summary = await synchronizeBootstrapAdminUsers({
    userModel,
    adminEmails: ['member@example.com', 'new-admin@example.com', 'admin@example.com'],
  });

  assert.deepEqual(summary, {
    configured: 3,
    processed: 3,
    created: 1,
    updated: 1,
    skipped: 0,
  });
  assert.equal(userModel.rows.length, 3);
  assert.equal(userModel.rows.find((row) => row.normalizedEmail === 'member@example.com').isAdmin, true);
  assert.deepEqual(userModel.rows.find((row) => row.normalizedEmail === 'new-admin@example.com').toJSON(), {
    id: 'user-3',
    email: 'new-admin@example.com',
    normalizedEmail: 'new-admin@example.com',
    name: 'new-admin@example.com',
    avatarUrl: null,
    isAdmin: true,
    metadata: {
      bootstrapAdmin: true,
      source: 'WEB_ADMIN_EMAILS',
    },
  });
});

test('bootstrap admin sync skips cleanly when the users table is unavailable during startup fallback', async () => {
  const summary = await synchronizeBootstrapAdminUsers({
    adminEmails: ['admin@example.com'],
    allowMissingTable: true,
    userModel: {
      async findAll() {
        throw new Error('relation "users" does not exist');
      },
    },
  });

  assert.deepEqual(summary, {
    configured: 1,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 1,
  });
});

test('bootstrap admin email resolution normalizes configured values', () => {
  const originalAdminEmails = process.env.WEB_ADMIN_EMAILS;

  try {
    process.env.WEB_ADMIN_EMAILS = ' Admin@Example.com, second@example.com ,,ADMIN@example.com ';
    assert.deepEqual(resolveBootstrapAdminEmails(), ['admin@example.com', 'second@example.com']);
  } finally {
    if (originalAdminEmails === undefined) {
      delete process.env.WEB_ADMIN_EMAILS;
    } else {
      process.env.WEB_ADMIN_EMAILS = originalAdminEmails;
    }
  }
});

test('bootstrap admin summary formatter reports the startup outcome clearly', () => {
  assert.equal(
    formatBootstrapAdminSummary({
      configured: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    }),
    '[db] bootstrap admin sync skipped (no configured bootstrap admins)',
  );

  assert.equal(
    formatBootstrapAdminSummary({
      configured: 2,
      processed: 2,
      created: 1,
      updated: 1,
      skipped: 0,
    }),
    '[db] bootstrap admin sync complete (1 created, 1 updated, 0 skipped)',
  );
});

function createMutableUserModel(initialRows = []) {
  const rows = initialRows.map((row) => createUserRecord(row));

  return {
    rows,
    async findAll({ where } = {}) {
      const normalizedEmails = Array.isArray(where?.normalizedEmail) ? where.normalizedEmail : null;
      if (!normalizedEmails) {
        return rows;
      }

      return rows.filter((row) => normalizedEmails.includes(row.normalizedEmail));
    },
    async create(input) {
      const row = createUserRecord({
        id: `user-${rows.length + 1}`,
        ...input,
      });
      rows.push(row);
      return row;
    },
  };
}

function createUserRecord(values) {
  return {
    ...values,
    async update(patch) {
      Object.assign(this, patch);
      return this;
    },
    toJSON() {
      return {
        id: this.id,
        email: this.email,
        normalizedEmail: this.normalizedEmail,
        name: this.name,
        avatarUrl: this.avatarUrl,
        isAdmin: this.isAdmin,
        metadata: this.metadata,
      };
    },
  };
}
