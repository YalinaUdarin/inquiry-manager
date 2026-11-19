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

export { DEMO_PASSWORD };
