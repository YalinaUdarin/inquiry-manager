// Loads demo accounts and sample inquiries.
// WARNING: it first deletes all existing users, inquiries and history, so the
// result is always the same known state. Use it for local dev and tests only.
//
// Usage:  npm run seed            (dev database)
//         npm run seed -- --test  (test database)

const bcrypt = require('bcryptjs');
const { withClient, runScript } = require('./db-client');

// Demo password shared by all seeded accounts (documented in the README).
const DEMO_PASSWORD = 'Password123!';

const USERS = [
  { key: 'alice', email: 'alice@example.test', name: 'Alice Perera', role: 'staff' },
  { key: 'bob', email: 'bob@example.test', name: 'Bob Silva', role: 'staff' },
  { key: 'sam', email: 'sam@example.test', name: 'Sam Fernando', role: 'supervisor' },
];

// hoursAgo = when the inquiry was created, relative to now.
const INQUIRIES = [
  {
    owner: 'alice', status: 'NEW', hoursAgo: 3,
    customer_name: 'Nimal Jayasinghe', contact: 'nimal.j@example.com',
    subject: 'Order #1042 arrived damaged',
    description: 'The outer box was crushed and two mugs were broken. Customer wants a replacement.',
  },
  {
    owner: 'alice', status: 'IN_PROGRESS', hoursAgo: 26,
    customer_name: 'Kavya Rao', contact: '+94 77 123 4567',
    subject: 'Request to reschedule delivery',
    description: 'Customer is travelling until Friday and asked to move the delivery to next week.',
  },
  {
    owner: 'alice', status: 'RESOLVED', hoursAgo: 72,
    customer_name: 'Daniel Brooks', contact: 'daniel.brooks@example.com',
    subject: 'Invoice shows wrong VAT amount',
    description: 'VAT was calculated on the pre-discount total. Corrected invoice sent.',
  },
  {
    owner: 'alice', status: 'NEW', hoursAgo: 1,
    customer_name: 'Priya Nadarajah', contact: 'priya.n@example.com',
    subject: 'Bulk order pricing for 200 units',
    description: 'Asking whether there is a volume discount for an office order of 200 units.',
  },
  {
    owner: 'bob', status: 'IN_PROGRESS', hoursAgo: 8,
    customer_name: 'Tharindu Wickrama', contact: '+94 71 555 0199',
    subject: 'Cannot log in to customer portal',
    description: 'Password reset email never arrives. Checked spam folder already.',
  },
  {
    owner: 'bob', status: 'NEW', hoursAgo: 30,
    customer_name: 'Emma Clarke', contact: 'emma.clarke@example.com',
    subject: 'Refund not received after 14 days',
    description: 'Return was accepted on the 2nd but no refund has appeared on her card yet.',
  },
  {
    owner: 'bob', status: 'RESOLVED', hoursAgo: 120,
    customer_name: 'Ruwan Dias', contact: 'ruwan.dias@example.com',
    subject: 'Question about warranty coverage',
    description: 'Wanted to know if accidental damage is covered. Explained the warranty terms.',
  },
];

// The status steps each seeded inquiry went through, following the allowed
// transitions (New → In Progress → Resolved).
const STATUS_PATH = {
  NEW: ['NEW'],
  IN_PROGRESS: ['NEW', 'IN_PROGRESS'],
  RESOLVED: ['NEW', 'IN_PROGRESS', 'RESOLVED'],
};

const HOUR = 60 * 60 * 1000;

async function seed(client, { log = console.log } = {}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await client.query('BEGIN');
  try {
    await client.query('TRUNCATE inquiry_events, inquiries, users CASCADE');

    const userIds = {};
    for (const u of USERS) {
      const { rows } = await client.query(
        `INSERT INTO users (email, name, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [u.email, u.name, passwordHash, u.role],
      );
      userIds[u.key] = rows[0].id;
    }

    const now = Date.now();
    for (const inq of INQUIRIES) {
      const ownerId = userIds[inq.owner];
      const steps = STATUS_PATH[inq.status];
      const createdAt = new Date(now - inq.hoursAgo * HOUR);
      // Each later status change happened 20% of the inquiry's age apart.
      const stepTimes = steps.map((_, i) => new Date(createdAt.getTime() + i * inq.hoursAgo * 0.2 * HOUR));
      const updatedAt = stepTimes[stepTimes.length - 1];

      const { rows } = await client.query(
        `INSERT INTO inquiries
           (customer_name, contact, subject, description, status,
            assigned_to, created_by, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9)
         RETURNING id`,
        // version = number of status steps (1 for created, +1 per change)
        [inq.customer_name, inq.contact, inq.subject, inq.description,
         inq.status, ownerId, steps.length, createdAt, updatedAt],
      );
      const inquiryId = rows[0].id;

      for (let i = 0; i < steps.length; i++) {
        await client.query(
          `INSERT INTO inquiry_events (inquiry_id, actor_id, from_status, to_status, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [inquiryId, ownerId, i === 0 ? null : steps[i - 1], steps[i], stepTimes[i]],
        );
      }
    }

    await client.query('COMMIT');
    log(`  ${USERS.length} users, ${INQUIRIES.length} inquiries`);
    return userIds;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

module.exports = { seed, DEMO_PASSWORD, USERS };

if (require.main === module) {
  runScript(() =>
    withClient(async (client, key) => {
      console.log(`Seeding (${key})…`);
      await seed(client);
      console.log(`✔ Done. Log in with any of: ${USERS.map((u) => u.email).join(', ')}`);
      console.log(`  Password: ${DEMO_PASSWORD}`);
    }),
  );
}
