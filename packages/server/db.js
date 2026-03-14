import { Sequelize } from 'sequelize';
import env from '../../config/env.mjs';
import { formatBootstrapAdminSummary, synchronizeBootstrapAdminUsers } from './bootstrapAdminUsers.js';
import { runMigrations } from './migrations/runMigrations.js';

const databaseUrl = env
  .get('DATABASE_URL')
  .default('postgres://postgres:postgres@127.0.0.1:5432/test_station')
  .asString();

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true,
  },
});

export async function dbReady(options = {}) {
  if (options.skipMigrations !== true) {
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

export default sequelize;
