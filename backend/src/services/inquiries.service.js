// Inquiry business logic and SQL.
//
// ACCESS RULE (applied in every query, not just in the UI):
//   - staff:      only inquiries assigned to them
//   - supervisor: all inquiries
// Records a user may not see are treated exactly like records that don't
// exist (404), so the API never reveals that someone else's inquiry exists.

const db = require('../db');
const { AppError } = require('../errors');
const { STATUSES, STATUS_LABELS, allowedNextStatuses, canTransition } = require('../domain/status');

// How long a matching open inquiry counts as a duplicate submission.
const DUPLICATE_WINDOW_MINUTES = 10;

const notFound = () => new AppError(404, 'NOT_FOUND', 'Inquiry not found.');

// One canonical form of a contact, used to spot duplicate submissions:
// lowercase, no spaces or dashes, and a local phone number (0 + 9 digits)
// rewritten as +94 + 9 digits. So "077 123 4567", "077-123-4567" and
// "+94 77 123 4567" all become "+94771234567".
// CONTACT_KEY_SQL does exactly the same in SQL, for the stored rows.
function contactKey(contact) {
  return contact
    .toLowerCase()
    .replace(/[\s-]/g, '')
    .replace(/^0(\d{9})$/, '+94$1');
}
const CONTACT_KEY_SQL = String.raw`regexp_replace(lower(regexp_replace(contact, '[\s-]', '', 'g')), '^0(\d{9})$', '+94\1')`;

// Adds the access rule to a query. Pushes any needed value onto `params`
// and returns the SQL condition, e.g. "i.assigned_to = $1".
function accessCondition(user, params) {
  if (user.role === 'supervisor') return 'TRUE';
  params.push(user.id);
  return `i.assigned_to = $${params.length}`;
}

// Escapes %, _ and \ so a search for "50%" matches the text "50%",
// instead of treating % as a wildcard.
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

const INQUIRY_COLUMNS = `
  i.id, i.customer_name, i.contact, i.subject, i.description, i.status,
  i.version, i.created_at, i.updated_at,
  i.assigned_to, assignee.name AS assignee_name
`;

// Database row (snake_case) → API object (camelCase).
function toInquiry(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    contact: row.contact,
    subject: row.subject,
    description: row.description,
    status: row.status,
    version: row.version,
    assignedTo: { id: row.assigned_to, name: row.assignee_name },
    // Sent so the UI shows exactly the buttons the server will accept.
    allowedTransitions: allowedNextStatuses(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

// filters: { status?, q?, page, pageSize } (already validated)
// Returns { items, page, pageSize, total, totalPages, counts }.
// counts = how many inquiries per status match the search, ignoring the status
// filter, so the UI can show "New (3) · In Progress (1) · …" on its tabs.
async function list(user, { status, q, page, pageSize }) {
  const params = [];
  const conditions = [accessCondition(user, params)];

  if (q) {
    params.push(`%${escapeLike(q)}%`);
    const p = `$${params.length}`;
    conditions.push(`(i.customer_name ILIKE ${p} OR i.subject ILIKE ${p} OR i.contact ILIKE ${p})`);
  }

  const countResult = await db.query(
    `SELECT i.status, count(*)::int AS n
       FROM inquiries i
      WHERE ${conditions.join(' AND ')}
      GROUP BY i.status`,
    params,
  );
  const counts = { ALL: 0 };
  for (const s of STATUSES) counts[s] = 0;
  for (const row of countResult.rows) {
    counts[row.status] = row.n;
    counts.ALL += row.n;
  }

  if (status) {
    params.push(status);
    conditions.push(`i.status = $${params.length}`);
  }

  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await db.query(
    `SELECT ${INQUIRY_COLUMNS}
       FROM inquiries i
       JOIN users assignee ON assignee.id = i.assigned_to
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.updated_at DESC, i.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = status ? counts[status] : counts.ALL;
  return {
    items: rows.map(toInquiry),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts,
  };
}

// ---------------------------------------------------------------------------
// Get one
// ---------------------------------------------------------------------------

// Returns the inquiry with its status history (newest first), or throws 404.
// `client` lets callers run this inside their own transaction.
async function getById(user, id, client = db) {
  const params = [id];
  const access = accessCondition(user, params);
  const { rows } = await client.query(
    `SELECT ${INQUIRY_COLUMNS}
       FROM inquiries i
       JOIN users assignee ON assignee.id = i.assigned_to
      WHERE i.id = $1 AND ${access}`,
    params,
  );
  if (!rows[0]) throw notFound();

  const history = await client.query(
    `SELECT e.id, e.from_status, e.to_status, e.created_at, u.id AS actor_id, u.name AS actor_name
       FROM inquiry_events e
       JOIN users u ON u.id = e.actor_id
      WHERE e.inquiry_id = $1
      ORDER BY e.created_at DESC, e.id DESC`,
    [id],
  );

  return {
    ...toInquiry(rows[0]),
    history: history.rows.map((e) => ({
      id: e.id,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      actor: { id: e.actor_id, name: e.actor_name },
      at: e.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

// data: { customerName, contact, subject, description } (already validated)
// The new inquiry is assigned to the person who records it.
async function create(user, data) {
  return db.withTransaction(async (client) => {
    // Normalised forms used to compare submissions (see contactKey above).
    const newContactKey = contactKey(data.contact);
    const subjectKey = data.subject.toLowerCase();

    // Lock on this contact+subject pair until the transaction ends, so two
    // identical requests arriving at the same moment can't both slip past
    // the duplicate check below. Different pairs don't block each other.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${newContactKey}|${subjectKey}`]);

    // Duplicate check covers ALL open inquiries, not just the user's own, so
    // two colleagues don't both pick up the same customer request.
    const dup = await client.query(
      `SELECT id, assigned_to
         FROM inquiries
        WHERE ${CONTACT_KEY_SQL} = $1
          AND lower(subject) = $2
          AND status <> 'RESOLVED'
          AND created_at > now() - make_interval(mins => $3)
        LIMIT 1`,
      [newContactKey, subjectKey, DUPLICATE_WINDOW_MINUTES],
    );
    if (dup.rows[0]) {
      const existing = dup.rows[0];
      const canSee = user.role === 'supervisor' || existing.assigned_to === user.id;
      // Only share the existing inquiry's id with someone allowed to open it.
      throw new AppError(
        409,
        'DUPLICATE_INQUIRY',
        canSee
          ? 'This inquiry was already recorded a few minutes ago.'
          : 'A colleague already recorded this inquiry a few minutes ago.',
        canSee ? { existingId: existing.id } : undefined,
      );
    }

    const inserted = await client.query(
      `INSERT INTO inquiries (customer_name, contact, subject, description, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id`,
      [data.customerName, data.contact, data.subject, data.description, user.id],
    );
    const id = inserted.rows[0].id;

    await client.query(
      `INSERT INTO inquiry_events (inquiry_id, actor_id, from_status, to_status)
       VALUES ($1, $2, NULL, 'NEW')`,
      [id, user.id],
    );

    return getById(user, id, client);
  });
}

// ---------------------------------------------------------------------------
// Change status
// ---------------------------------------------------------------------------

// change: { status, version } (already validated)
// Order of checks matters:
//   1. visible?        no → 404
//   2. version current? no → 409 STALE_RECORD (sends back the latest data)
//   3. move allowed?   no → 422 INVALID_TRANSITION
// The version is checked before the rule, so a stale tab is told "this
// changed, here's the latest" rather than a confusing "not allowed".
async function changeStatus(user, id, { status, version }) {
  return db.withTransaction(async (client) => {
    const params = [id];
    const access = accessCondition(user, params);
    // FOR UPDATE locks the row until this transaction ends, so two changes
    // to the same inquiry are handled one after the other, never interleaved.
    const { rows } = await client.query(
      `SELECT i.status, i.version FROM inquiries i
        WHERE i.id = $1 AND ${access}
        FOR UPDATE`,
      params,
    );
    const current = rows[0];
    if (!current) throw notFound();

    if (current.version !== version) {
      throw new AppError(
        409,
        'STALE_RECORD',
        'This inquiry was updated by someone else after you opened it. The latest version is shown below.',
        { current: await getById(user, id, client) },
      );
    }

    if (!canTransition(current.status, status)) {
      const from = STATUS_LABELS[current.status];
      const allowed = allowedNextStatuses(current.status);
      throw new AppError(
        422,
        'INVALID_TRANSITION',
        current.status === status
          ? `This inquiry is already ${from}.`
          : `An inquiry can't go from ${from} to ${STATUS_LABELS[status]}. ` +
            `Allowed: ${allowed.map((s) => STATUS_LABELS[s]).join(', ')}.`,
        { from: current.status, to: status, allowed },
      );
    }

    await client.query(
      `UPDATE inquiries
          SET status = $2, version = version + 1, updated_at = now()
        WHERE id = $1`,
      [id, status],
    );
    await client.query(
      `INSERT INTO inquiry_events (inquiry_id, actor_id, from_status, to_status)
       VALUES ($1, $2, $3, $4)`,
      [id, user.id, current.status, status],
    );

    return getById(user, id, client);
  });
}

module.exports = { list, getById, create, changeStatus, DUPLICATE_WINDOW_MINUTES };
