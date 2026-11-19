// Wipes the database completely, then re-runs all migrations and the seed.
// Handy after changing a migration during development.
//
// Usage:  npm run db:reset            (dev database)
//         npm run db:reset -- --test  (test database)

const { getTarget, withClient, runScript } = require('./db-client');
const { runMigrations } = require('./migrate');
const { seed } = require('./seed');

// Safety check: only ever reset a database on this machine.
function assertLocal(url) {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(`Refusing to reset a non-local database (host: ${host}).`);
  }
}

runScript(async () => {
  assertLocal(getTarget().url);

  await withClient(async (client, key) => {
    console.log(`Resetting (${key})…`);
    // Dropping the schema removes every table, index and the migrations log.
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await runMigrations(client);
    await seed(client);
    console.log('✔ Database reset.');
  });
});
