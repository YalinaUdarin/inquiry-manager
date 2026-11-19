// Phase 2 tests: the app's shared plumbing (health check, unknown routes,
// bad JSON, error formatting, ID validation). Runs against the test database
// (NODE_ENV=test is set by Vitest, so config.js picks TEST_DATABASE_URL).

import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { AppError } from '../src/errors.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { validateUuid } from '../src/middleware/validateUuid.js';

const app = createApp();

afterAll(() => pool.end());

describe('app basics', () => {
  it('GET /api/health reports the API and database as up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 INVALID_JSON for a malformed request body', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('does not reveal the framework in response headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// A tiny app with routes that throw on purpose, to check how each kind of
// error is turned into a response.
describe('error handler', () => {
  const testApp = express();
  testApp.get('/app-error', () => {
    throw new AppError(409, 'SOMETHING_CONFLICTED', 'Readable message', { hint: 'x' });
  });
  testApp.get('/zod-error', () => {
    z.object({ subject: z.string().min(1, 'Subject is required') }).parse({ subject: '' });
  });
  testApp.get('/crash', async () => {
    throw new Error('connection to db-internal:5432 failed, password=secret');
  });
  testApp.use(errorHandler);

  it('passes AppError status, code, message and details through', async () => {
    const res = await request(testApp).get('/app-error');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'SOMETHING_CONFLICTED', message: 'Readable message', details: { hint: 'x' } },
    });
  });

  it('turns zod errors into 400 with per-field messages', async () => {
    const res = await request(testApp).get('/zod-error');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({ subject: 'Subject is required' });
  });

  it('hides internal details of unexpected errors behind a generic 500', async () => {
    const res = await request(testApp).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/secret|db-internal|stack/);
  });
});

describe('validateUuid', () => {
  const testApp = express();
  testApp.get('/items/:id', validateUuid('id'), (req, res) => res.json({ ok: true }));
  testApp.use(errorHandler);

  it('rejects a malformed id with 400 INVALID_ID', async () => {
    const res = await request(testApp).get('/items/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  it('lets a well-formed id through', async () => {
    const res = await request(testApp).get('/items/3f2b8c1e-9a4d-4e5f-8b6a-1c2d3e4f5a6b');
    expect(res.status).toBe(200);
  });
});
