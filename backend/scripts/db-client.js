// Shared helper for the database scripts (migrate, seed, reset).
// Picks the dev database by default, or the test database when the command
// is run with --test (e.g. `npm run migrate -- --test`).

const path = require('node:path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function getTarget(argv = process.argv) {
  const key = argv.includes('--test') ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  const url = process.env[key];
  if (!url) {
    throw new Error(`${key} is not set. Copy backend/.env.example to backend/.env.`);
  }
  return { key, url };
}

// Opens a connection, runs fn(client), and always closes the connection.
async function withClient(fn, argv = process.argv) {
  const { key, url } = getTarget(argv);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client, key);
  } finally {
    await client.end();
  }
}

// Wraps a script's main function: prints a clean error and exits with 1.
function runScript(main) {
  main().catch((err) => {
    console.error(`\n✖ ${err.message}`);
    process.exit(1);
  });
}

module.exports = { getTarget, withClient, runScript };
