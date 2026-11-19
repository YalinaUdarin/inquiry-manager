// PostgreSQL connection pool, shared by the whole app.
// A pool keeps a few connections open and reuses them, instead of opening a
// new connection for every request.

const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl });

// An idle connection can fail (e.g. the database restarts). Log it instead of
// letting it crash the process; the pool replaces the broken connection.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Runs a single query on any free connection.
function query(text, params) {
  return pool.query(text, params);
}

// Runs fn(client) inside a transaction on one dedicated connection.
// If fn throws, everything it did is rolled back; otherwise it is committed.
// All queries inside fn must use the given client, not query() above,
// so they share the same transaction.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
