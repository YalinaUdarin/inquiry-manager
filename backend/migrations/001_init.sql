-- 001_init.sql: initial schema for the Customer Inquiry Management System.
-- Runs once, inside a transaction, via scripts/migrate.js.

-- citext = case-insensitive text, so "Alice@Example.test" and
-- "alice@example.test" count as the same email.
-- (gen_random_uuid() is built into PostgreSQL 13+, so pgcrypto isn't needed.)
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Staff accounts (seeded; there is no registration).
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext      NOT NULL UNIQUE,
  name          text        NOT NULL,
  password_hash text        NOT NULL,
  -- staff: sees only inquiries assigned to them. supervisor: sees all.
  role          text        NOT NULL CHECK (role IN ('staff', 'supervisor')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Customer inquiries.
-- The length limits match the API's validation. They are a last line of
-- defence, so bad data can't get in even if the API check is skipped.
-- ---------------------------------------------------------------------------
CREATE TABLE inquiries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text        NOT NULL CHECK (char_length(btrim(customer_name)) BETWEEN 1 AND 100),
  contact       text        NOT NULL CHECK (char_length(btrim(contact))       BETWEEN 3 AND 120),
  subject       text        NOT NULL CHECK (char_length(btrim(subject))       BETWEEN 1 AND 150),
  description   text        NOT NULL CHECK (char_length(btrim(description))   BETWEEN 1 AND 2000),
  status        text        NOT NULL DEFAULT 'NEW'
                            CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  -- Who is handling it. Drives the access rule. Defaults to the creator.
  assigned_to   uuid        NOT NULL REFERENCES users(id),
  created_by    uuid        NOT NULL REFERENCES users(id),
  -- Optimistic locking: increases by 1 on every change. A change sent with
  -- an old version is rejected (409), which is how stale tabs are detected.
  version       integer     NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Supports the main list query: "my inquiries, most recently updated first".
CREATE INDEX inquiries_assigned_updated_idx ON inquiries (assigned_to, updated_at DESC);
-- Supports filtering by status (used by supervisors, who see everyone's).
CREATE INDEX inquiries_status_idx ON inquiries (status);

-- ---------------------------------------------------------------------------
-- Status history: who changed the status, from what, to what, and when.
-- from_status is NULL for the "created" event.
-- ---------------------------------------------------------------------------
CREATE TABLE inquiry_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  uuid        NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  actor_id    uuid        NOT NULL REFERENCES users(id),
  from_status text        CHECK (from_status IN ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  to_status   text        NOT NULL CHECK (to_status IN ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Supports loading one inquiry's history, newest first.
CREATE INDEX inquiry_events_inquiry_created_idx ON inquiry_events (inquiry_id, created_at DESC);
