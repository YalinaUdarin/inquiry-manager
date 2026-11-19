// Phase 3 tests: sign-in, sessions and sign-out.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import config from '../src/config.js';
import { resetDatabase, loginAs, DEMO_PASSWORD } from './helpers.js';

const app = createApp();
let users;

beforeAll(async () => {
  users = await resetDatabase();
});
afterAll(() => pool.end());

function sessionCookie(res) {
  return (res.headers['set-cookie'] || []).find((c) => c.startsWith('session='));
}

describe('POST /api/auth/login', () => {
  it('signs in with correct credentials and sets a secure session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.test', password: DEMO_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: users.alice,
      email: 'alice@example.test',
      name: 'Alice Perera',
      role: 'staff',
    });
    // The password hash must never leave the server.
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);

    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('ignores upper/lower case and spaces around the email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  ALICE@Example.TEST ', password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.test', password: 'nope' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'nope' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(sessionCookie(res)).toBeUndefined();
    }
    // Identical messages, so the response doesn't reveal which emails exist.
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('rejects missing or malformed fields with 400 and per-field messages', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({
      email: 'Enter a valid email address.',
      password: 'Password is required.',
    });
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the signed-in user with a valid session', async () => {
    const agent = await loginAs(app, 'sam@example.test');
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: users.sam, role: 'supervisor' });
  });

  it('rejects a token signed with the wrong secret (forged)', async () => {
    const forged = jwt.sign({ role: 'supervisor' }, 'attacker-secret', { subject: users.bob });
    const res = await request(app).get('/api/auth/me').set('Cookie', `session=${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token with a clear message', async () => {
    const expired = jwt.sign(
      { role: 'staff', exp: Math.floor(Date.now() / 1000) - 60 },
      config.jwtSecret,
      { subject: users.alice },
    );
    const res = await request(app).get('/api/auth/me').set('Cookie', `session=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/i);
  });

  it('rejects a valid token for a user that no longer exists', async () => {
    const ghost = jwt.sign({ role: 'staff' }, config.jwtSecret, {
      subject: '00000000-0000-4000-8000-000000000000',
    });
    const res = await request(app).get('/api/auth/me').set('Cookie', `session=${ghost}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session so later requests are rejected', async () => {
    const agent = await loginAs(app, 'bob@example.test');
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
