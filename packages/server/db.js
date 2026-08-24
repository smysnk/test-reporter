import { Sequelize } from 'sequelize';
import env from '../../config/env.mjs';
import { formatBootstrapAdminSummary, synchronizeBootstrapAdminUsers } from './bootstrapAdminUsers.js';
import { loadMigrations, MIGRATION_TABLE, runMigrations } from './migrations/runMigrations.js';
import { performance } from 'node:perf_hooks';
import { recordDatabaseQuery, recordDatabaseTimeout, recordPoolWait } from './profiling/requestProfile.js';

const databaseUrl = env
  .get('DATABASE_URL')
  .default('postgres://postgres:postgres@127.0.0.1:5432/test_station')
  .asString();

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  benchmark: true,
  logging: (_sql, durationMs) => {
    recordDatabaseQuery(durationMs);
  },
  pool: {
    max: env.get('DATABASE_POOL_MAX').default(10).asIntPositive(),
    min: env.get('DATABASE_POOL_MIN').default(0).asInt(),
    acquire: env.get('DATABASE_POOL_ACQUIRE_MS').default(10_000).asIntPositive(),
    idle: env.get('DATABASE_POOL_IDLE_MS').default(10_000).asIntPositive(),
  },
  dialectOptions: {
    statement_timeout: env.get('DATABASE_STATEMENT_TIMEOUT_MS').default(15_000).asIntPositive(),
  },
  define: {
    underscored: true,
  },
});

const poolAcquireStartedAt = Symbol('testStationPoolAcquireStartedAt');

sequelize.addHook('beforePoolAcquire', (options = {}) => {
  options[poolAcquireStartedAt] = performance.now();
});

sequelize.addHook('afterPoolAcquire', (_connection, options = {}) => {
  if (Number.isFinite(options[poolAcquireStartedAt])) {
    recordPoolWait(performance.now() - options[poolAcquireStartedAt]);
  }
});

sequelize.addHook('afterQuery', (options = {}) => {
  if (options?.exception?.name === 'SequelizeDatabaseError' && options.exception?.parent?.code === '57014') {
    recordDatabaseTimeout();
  }
});

export async function dbReady(options = {}) {
  const shouldRunMigrations = options.runMigrations === true
    || (options.skipMigrations !== true && process.env.NODE_ENV !== 'production');
  if (shouldRunMigrations) {
    process.stdout.write('[db] running migrations\n');
    await runMigrations(sequelize);
    process.stdout.write('[db] migrations complete\n');
  }

  if (options.skipAuthenticate !== true) {
    process.stdout.write('[db] authenticating connection\n');
    await sequelize.authenticate();
    process.stdout.write('[db] connection authenticated\n');
  }

  if (options.skipBootstrapAdminBackfill !== true) {
    const { User } = await import('./models/index.js');
    const summary = await synchronizeBootstrapAdminUsers({
      userModel: options.userModel || User,
      adminEmails: options.adminEmails,
      allowMissingTable: options.skipMigrations === true,
    });
    if (summary.configured > 0 || summary.skipped > 0) {
      process.stdout.write(`${formatBootstrapAdminSummary(summary)}\n`);
    }
  }

  return sequelize;
}

export async function checkDatabaseReadiness(options = {}) {
  await sequelize.authenticate();
  if (options.verifySchema === false) {
    return { ready: true, schema: 'unchecked' };
  }

  const migrations = await loadMigrations();
  const expectedMigration = migrations.at(-1)?.id || null;
  const [rows] = await sequelize.query(
    `SELECT id FROM "${MIGRATION_TABLE}" ORDER BY applied_at DESC, id DESC LIMIT 1`,
    { raw: true },
  );
  const appliedMigration = rows[0]?.id || null;
  return {
    ready: Boolean(expectedMigration && appliedMigration === expectedMigration),
    expectedMigration,
    appliedMigration,
  };
}

export default sequelize;
