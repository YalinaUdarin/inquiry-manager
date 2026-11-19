// Applies SQL files from backend/migrations in filename order.
// Each file runs once: applied files are recorded in schema_migrations.
// Each file runs inside its own transaction, so a failing file leaves
// nothing half-applied.
//
// Usage:  npm run migrate            (dev database)
//         npm run migrate -- --test  (test database)

const fs = require('node:fs');
const path = require('node:path');
const { withClient, runScript } = require('./db-client');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations(client, { log = console.log } = {}) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const ran = [];
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
    ran.push(file);
    log(`  applied ${file}`);
  }

  return ran;
}

module.exports = { runMigrations };

if (require.main === module) {
  runScript(() =>
    withClient(async (client, key) => {
      console.log(`Migrating (${key})…`);
      const ran = await runMigrations(client);
      console.log(ran.length ? `✔ ${ran.length} migration(s) applied.` : '✔ Already up to date.');
    }),
  );
}
