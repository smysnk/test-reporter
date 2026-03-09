import sequelize from '../db.js';
import { runMigrations } from '../migrations/runMigrations.js';

async function main() {
  await runMigrations(sequelize);
  process.stdout.write('[db] migrations complete\n');
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (error) {
      process.stderr.write(`[db] failed to close sequelize connection: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  });
