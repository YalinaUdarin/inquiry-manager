// Phase 5: the inquiry API's business, security and validation rules.
// Each test starts from the same seeded data:
//   Alice (staff):  4 inquiries (2 NEW, 1 IN_PROGRESS, 1 RESOLVED)
//   Bob (staff):    3 inquiries (1 NEW, 1 IN_PROGRESS, 1 RESOLVED)
//   Sam (supervisor): none of his own, sees all 7

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { resetDatabase, loginAs, dbInquiryBySubject, dbCount } from './helpers.js';

const app = createApp();

// Seeded inquiries used below (subject → starting state).
const ALICE_NEW = 'Order #1042 arrived damaged';          // NEW, v1
const ALICE_IN_PROGRESS = 'Request to reschedule delivery'; // IN_PROGRESS, v2
const ALICE_RESOLVED = 'Invoice shows wrong VAT amount';  // RESOLVED, v3

const VALID_INQUIRY = {
  customerName: 'Test Customer',
  contact: 'test.customer@example.com',
  subject: 'Kettle stopped working',
  description: 'Stopped heating after a week of use.',
};

let alice, bob, sam, users;

beforeEach(async () => {
  users = await resetDatabase();
  // Log in after each reset: the seed recreates users with new ids.
  [alice, bob, sam] = await Promise.all([
    loginAs(app, 'alice@example.test'),
    loginAs(app, 'bob@example.test'),
    loginAs(app, 'sam@example.test'),
  ]);
});

afterAll(() => pool.end());

// ---------------------------------------------------------------------------
describe('authentication is enforced on every inquiry route', () => {
  const someId = '00000000-0000-4000-8000-000000000000';
  const routes = [
    ['get', '/api/inquiries'],
    ['post', '/api/inquiries'],
    ['get', `/api/inquiries/${someId}`],
    ['patch', `/api/inquiries/${someId}/status`],
  ];

  for (const [method, path] of routes) {
    it(`${method.toUpperCase()} ${path} without a session → 401`, async () => {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  }

  it('does not create anything when an unauthenticated POST is sent', async () => {
    const before = await dbCount('inquiries');
    await request(app).post('/api/inquiries').send(VALID_INQUIRY);
    expect(await dbCount('inquiries')).toBe(before);
  });
});

// ---------------------------------------------------------------------------
describe('access rule: staff see only their own inquiries, supervisors see all', () => {
  it('lists only the signed-in staff member\'s inquiries', async () => {
    const res = await alice.get('/api/inquiries');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items.every((i) => i.assignedTo.id === users.alice)).toBe(true);
  });

  it('lets a supervisor list everyone\'s inquiries', async () => {
    const res = await sam.get('/api/inquiries');
    expect(res.body.total).toBe(7);
    const assignees = new Set(res.body.items.map((i) => i.assignedTo.id));
    expect(assignees).toEqual(new Set([users.alice, users.bob]));
  });

  it('returns 404 when staff open another person\'s inquiry by direct link', async () => {
    const { id } = await dbInquiryBySubject(ALICE_NEW);
    const res = await bob.get(`/api/inquiries/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    // Same response as an id that doesn't exist, so nothing is revealed.
    const missing = await bob.get('/api/inquiries/00000000-0000-4000-8000-000000000000');
    expect(res.body).toEqual(missing.body);
  });

  it('returns 404 and changes nothing when staff try to update another person\'s inquiry', async () => {
    const { id } = await dbInquiryBySubject(ALICE_NEW);
    const res = await bob.patch(`/api/inquiries/${id}/status`).send({ status: 'IN_PROGRESS', version: 1 });
    expect(res.status).toBe(404);
    expect(await dbInquiryBySubject(ALICE_NEW)).toMatchObject({ status: 'NEW', version: 1 });
  });

  it('lets a supervisor open any inquiry', async () => {
    const { id } = await dbInquiryBySubject(ALICE_NEW);
    const res = await sam.get(`/api/inquiries/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.inquiry.assignedTo.id).toBe(users.alice);
  });

  it('never includes other people\'s inquiries in search results', async () => {
    const res = await bob.get('/api/inquiries?q=invoice');
    expect(res.body.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('listing: filters, search, pagination and counts', () => {
  it('filters by status and reports counts per status', async () => {
    const res = await alice.get('/api/inquiries?status=NEW');
    expect(res.body.total).toBe(2);
    expect(res.body.items.every((i) => i.status === 'NEW')).toBe(true);
    // Counts ignore the status filter, so every tab can show its number.
    expect(res.body.counts).toEqual({ ALL: 4, NEW: 2, IN_PROGRESS: 1, RESOLVED: 1 });
  });

  it('searches customer name, subject and contact, ignoring case', async () => {
    const bySubject = await alice.get('/api/inquiries?q=INVOICE');
    expect(bySubject.body.items.map((i) => i.subject)).toEqual([ALICE_RESOLVED]);
    const byContact = await alice.get('/api/inquiries?q=%2B94%2077'); // "+94 77"
    expect(byContact.body.items.map((i) => i.subject)).toEqual([ALICE_IN_PROGRESS]);
  });

  it('treats % in a search as a normal character, not a wildcard', async () => {
    const res = await alice.get('/api/inquiries?q=%25');
    expect(res.body.total).toBe(0);
  });

  it('paginates, newest-updated first', async () => {
    const page1 = await alice.get('/api/inquiries?pageSize=3&page=1');
    const page2 = await alice.get('/api/inquiries?pageSize=3&page=2');
    expect(page1.body.items).toHaveLength(3);
    expect(page2.body.items).toHaveLength(1);
    expect(page1.body.totalPages).toBe(2);

    const all = [...page1.body.items, ...page2.body.items];
    const times = all.map((i) => new Date(i.updatedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('rejects invalid query parameters with 400', async () => {
    const res = await alice.get('/api/inquiries?status=CLOSED&pageSize=500');
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['pageSize', 'status']);
  });
});

// ---------------------------------------------------------------------------
describe('creating inquiries: validation', () => {
  it('rejects missing fields with 400, a message per field, and saves nothing', async () => {
    const before = await dbCount('inquiries');
    const res = await alice.post('/api/inquiries').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details).sort()).toEqual(
      ['contact', 'customerName', 'description', 'subject'],
    );
    expect(await dbCount('inquiries')).toBe(before);
  });

  it('rejects blank (spaces-only) text and an invalid contact', async () => {
    const res = await alice.post('/api/inquiries').send({ ...VALID_INQUIRY, customerName: '   ', contact: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({
      customerName: 'Customer name is required.',
      contact: 'Enter a valid email address or phone number.',
    });
  });

  it('rejects text over the length limit', async () => {
    const res = await alice.post('/api/inquiries').send({ ...VALID_INQUIRY, subject: 'x'.repeat(151) });
    expect(res.status).toBe(400);
    expect(res.body.error.details.subject).toMatch(/150 characters/);
  });

  it('accepts a phone number as the contact', async () => {
    const res = await alice.post('/api/inquiries').send({ ...VALID_INQUIRY, contact: '+94 (77) 123-4567' });
    expect(res.status).toBe(201);
  });

  it('creates a NEW inquiry assigned to its creator, ignoring fields the client may not set', async () => {
    const res = await alice.post('/api/inquiries').send({
      ...VALID_INQUIRY,
      customerName: '  Test Customer  ',
      status: 'RESOLVED',      // not allowed to set
      assignedTo: users.bob,   // not allowed to set
    });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/inquiries/${res.body.inquiry.id}`);
    expect(res.body.inquiry).toMatchObject({
      customerName: 'Test Customer', // trimmed
      status: 'NEW',
      version: 1,
      assignedTo: { id: users.alice },
      allowedTransitions: ['IN_PROGRESS'],
    });
    expect(res.body.inquiry.history).toHaveLength(1);
    expect(res.body.inquiry.history[0]).toMatchObject({ fromStatus: null, toStatus: 'NEW' });
  });
});

// ---------------------------------------------------------------------------
describe('creating inquiries: duplicate submissions', () => {
  it('rejects the same inquiry submitted twice, pointing to the original', async () => {
    const first = await alice.post('/api/inquiries').send(VALID_INQUIRY);
    // Same contact and subject, written slightly differently.
    const second = await alice.post('/api/inquiries').send({
      ...VALID_INQUIRY,
      contact: 'TEST.customer@example.com',
      subject: 'KETTLE STOPPED WORKING',
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_INQUIRY');
    expect(second.body.error.details).toEqual({ existingId: first.body.inquiry.id });
  });

  it('does not reveal the original\'s id to a colleague who cannot open it', async () => {
    await alice.post('/api/inquiries').send(VALID_INQUIRY);
    const res = await bob.post('/api/inquiries').send(VALID_INQUIRY);
    expect(res.status).toBe(409);
    expect(res.body.error.details).toBeUndefined();
    expect(res.body.error.message).toMatch(/colleague/i);
  });

  it('saves only one inquiry when identical requests arrive at the same moment', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => alice.post('/api/inquiries').send(VALID_INQUIRY)),
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes).toEqual([201, 409, 409, 409, 409]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM inquiries WHERE subject = $1', [VALID_INQUIRY.subject]);
    expect(rows[0].n).toBe(1);
  });

  it('allows the same request again once the original is resolved', async () => {
    const first = await alice.post('/api/inquiries').send(VALID_INQUIRY);
    await pool.query("UPDATE inquiries SET status = 'RESOLVED' WHERE id = $1", [first.body.inquiry.id]);
    const again = await alice.post('/api/inquiries').send(VALID_INQUIRY);
    expect(again.status).toBe(201);
  });

  it('allows the same request again after the 10-minute window', async () => {
    const first = await alice.post('/api/inquiries').send(VALID_INQUIRY);
    await pool.query("UPDATE inquiries SET created_at = now() - interval '11 minutes' WHERE id = $1", [first.body.inquiry.id]);
    const again = await alice.post('/api/inquiries').send(VALID_INQUIRY);
    expect(again.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
describe('status changes', () => {
  async function change(agent, subject, status, version) {
    const { id } = await dbInquiryBySubject(subject);
    return agent.patch(`/api/inquiries/${id}/status`).send({ status, version });
  }

  it('moves NEW → IN_PROGRESS, bumps the version and records who did it', async () => {
    const res = await change(alice, ALICE_NEW, 'IN_PROGRESS', 1);
    expect(res.status).toBe(200);
    expect(res.body.inquiry).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
    expect(res.body.inquiry.allowedTransitions.sort()).toEqual(['NEW', 'RESOLVED']);
    expect(res.body.inquiry.history[0]).toMatchObject({
      fromStatus: 'NEW',
      toStatus: 'IN_PROGRESS',
      actor: { id: users.alice, name: 'Alice Perera' },
    });
  });

  it('rejects NEW → RESOLVED with 422, lists the allowed moves, and changes nothing', async () => {
    const res = await change(alice, ALICE_NEW, 'RESOLVED', 1);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect(res.body.error.details).toEqual({ from: 'NEW', to: 'RESOLVED', allowed: ['IN_PROGRESS'] });
    expect(await dbInquiryBySubject(ALICE_NEW)).toMatchObject({ status: 'NEW', version: 1 });
  });

  it('rejects setting the status an inquiry already has', async () => {
    const res = await change(alice, ALICE_IN_PROGRESS, 'IN_PROGRESS', 2);
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/already In Progress/);
  });

  it('allows reopening a RESOLVED inquiry', async () => {
    const res = await change(alice, ALICE_RESOLVED, 'IN_PROGRESS', 3);
    expect(res.status).toBe(200);
    expect(res.body.inquiry).toMatchObject({ status: 'IN_PROGRESS', version: 4 });
  });

  it('rejects a change based on an old version with 409 and returns the latest record', async () => {
    // Tab A moves it on; tab B still has version 1.
    await change(alice, ALICE_NEW, 'IN_PROGRESS', 1);
    const stale = await change(alice, ALICE_NEW, 'IN_PROGRESS', 1);

    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_RECORD');
    expect(stale.body.error.details.current).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
    // The rejected change was not applied a second time.
    expect(await dbInquiryBySubject(ALICE_NEW)).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
  });

  it('reports a stale version (409) before an invalid move (422)', async () => {
    await change(alice, ALICE_NEW, 'IN_PROGRESS', 1);
    // Old version AND a move that is invalid from the current status.
    const res = await change(alice, ALICE_NEW, 'IN_PROGRESS', 1);
    expect(res.status).toBe(409);
  });

  it('applies only one of several simultaneous changes made from the same version', async () => {
    const { id } = await dbInquiryBySubject(ALICE_NEW);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        alice.patch(`/api/inquiries/${id}/status`).send({ status: 'IN_PROGRESS', version: 1 }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM inquiry_events WHERE inquiry_id = $1', [id]);
    expect(rows[0].n).toBe(2); // created + one change
  });

  it('rejects a malformed body with 400', async () => {
    const res = await change(alice, ALICE_NEW, 'DONE', undefined);
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['status', 'version']);
  });
});

// ---------------------------------------------------------------------------
describe('predictable failures for bad ids', () => {
  it('returns 400 INVALID_ID for a malformed id', async () => {
    const get = await alice.get('/api/inquiries/not-a-uuid');
    const patch = await alice.patch('/api/inquiries/not-a-uuid/status').send({ status: 'NEW', version: 1 });
    expect([get.status, patch.status]).toEqual([400, 400]);
    expect(get.body.error.code).toBe('INVALID_ID');
  });

  it('returns 404 for a well-formed id that does not exist', async () => {
    const res = await sam.get('/api/inquiries/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});
