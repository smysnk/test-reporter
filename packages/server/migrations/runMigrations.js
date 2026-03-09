import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Sequelize } from 'sequelize';

const migrationsDir = path.dirname(fileURLToPath(import.meta.url));

export const MIGRATION_TABLE = 'schema_migrations';

export async function loadMigrations(options = {}) {
  const directory = path.resolve(options.directory || migrationsDir);
  const entries = fs.readdirSync(directory)
    .filter((entry) => /^\d+.*\.js$/.test(entry))
    .sort((left, right) => left.localeCompare(right));

  const migrations = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry);
    const mod = await import(pathToFileURL(absolutePath).href);
    migrations.push({
      id: mod.id || entry.replace(/\.js$/, ''),
      up: mod.up,
      down: mod.down,
      noTransaction: mod.noTransaction === true,
    });
  }

  return migrations;
}

export async function runMigrations(sequelize, options = {}) {
  const migrations = Array.isArray(options.migrations)
    ? options.migrations
    : await loadMigrations(options);

  await ensureMigrationTable(sequelize);
  const applied = await loadAppliedMigrations(sequelize);
  const queryInterface = sequelize.getQueryInterface();
  let appliedCount = 0;

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    process.stdout.write(`[db] applying migration ${migration.id}\n`);
    if (migration.noTransaction) {
      await migration.up({
        sequelize,
        queryInterface,
        Sequelize,
      });
      await recordAppliedMigration(sequelize, migration.id);
      appliedCount += 1;
      process.stdout.write(`[db] applied migration ${migration.id}\n`);
      continue;
    }

    const transaction = await sequelize.transaction();
    try {
      await migration.up({
        sequelize,
        queryInterface,
        Sequelize,
        transaction,
      });
      await recordAppliedMigration(sequelize, migration.id, transaction);
      await transaction.commit();
      appliedCount += 1;
      process.stdout.write(`[db] applied migration ${migration.id}\n`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  if (!appliedCount) {
    process.stdout.write('[db] no pending migrations\n');
  }
}

async function ensureMigrationTable(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATION_TABLE}" (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function loadAppliedMigrations(sequelize) {
  const [rows] = await sequelize.query(`SELECT id FROM "${MIGRATION_TABLE}" ORDER BY id ASC`);
  return new Set(rows.map((row) => String(row.id)));
}

async function recordAppliedMigration(sequelize, id, transaction) {
  await sequelize.query(
    `INSERT INTO "${MIGRATION_TABLE}" (id) VALUES (:id)`,
    {
      replacements: { id },
      transaction,
    },
  );
}
