// Shared test helpers.

import request from 'supertest';
import { pool } from '../src/db.js';
import { runMigrations } from '../scripts/migrate.js';
import { seed, DEMO_PASSWORD } from '../scripts/seed.js';

const quiet = { log: () => {} };

// Puts the test database into the known seeded state: schema up to date,
// then all data replaced with the demo users and inquiries.
// Returns { alice, bob, sam } user ids.
export async function resetDatabase() {
  const client = await pool.connect();
  try {
    await runMigrations(client, quiet);
    return await seed(client, quiet);
  } finally {
    client.release();
  }
}

// Returns a supertest "agent" that is signed in as the given user. An agent
// keeps cookies between requests, like a browser does.
export async function loginAs(app, email, password = DEMO_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`loginAs(${email}) failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return agent;
}

// Reads an inquiry straight from the database (bypassing the API), to check
// what was really stored. Returns the row, or undefined.
export async function dbInquiryBySubject(subject) {
  const { rows } = await pool.query(
    'SELECT id, status, version, assigned_to FROM inquiries WHERE subject = $1',
    [subject],
  );
  return rows[0];
}

export async function dbCount(table) {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

export { DEMO_PASSWORD };
