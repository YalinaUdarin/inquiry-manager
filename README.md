# Inquiry Desk: Customer Inquiry Management System

A small full-stack app for recording customer inquiries, finding them later, and moving them through **New → In Progress → Resolved**.

- **Frontend:** Next.js 16 (React 19), TanStack Query, Tailwind CSS
- **Backend:** Node.js + Express 5, plain SQL with `pg`, zod validation
- **Database:** PostgreSQL 16 (Docker)

Design choices, assumptions and trade-offs are explained in **[DECISIONS.md](DECISIONS.md)**.

---

## Quick start

### Prerequisites
- **Node.js 20.9 or newer** (developed on Node 24)
- **Docker Desktop**, for PostgreSQL. If you'd rather use your own Postgres 16, see [Using your own PostgreSQL](#using-your-own-postgresql).

### 1. Start the database
From the project root:

```bash
docker compose up -d
```

This starts Postgres on port `5432` with two databases:
- `inquiries` for the app
- `inquiries_test`, used only by the automated tests

### 2. Set up and start the API (port 4000)

```bash
cd backend
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
npm install
npm run migrate           # creates the tables
npm run seed              # loads demo users and inquiries
npm run dev               # starts the API, restarts on file changes
```

Check it's up: <http://localhost:4000/api/health> should return `{"status":"ok","database":"up"}`.

### 3. Set up and start the web app (port 3000)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **<http://localhost:3000>**. The web app forwards `/api/*` requests to the API, so the two must both be running.

### Test accounts

All accounts use the password **`Password123!`**. The login page also has a "Demo accounts" box that fills these in.

| Email | Role | Can see |
|---|---|---|
| `alice@example.test` | staff | Only inquiries assigned to her (4 seeded) |
| `bob@example.test` | staff | Only inquiries assigned to him (3 seeded) |
| `sam@example.test` | supervisor | Every inquiry (7 seeded) |

**Try the brief's three situations:**
1. **Missing or invalid information:** submit the New inquiry form with empty fields or a contact like `abc`.
2. **Stale data:** open the same inquiry in two tabs, change its status in one, then change it in the other.
3. **Direct link to someone else's inquiry:** sign in as Bob and open the URL of one of Alice's inquiries.

---

## Running the tests

Docker must be running: the backend tests use the real `inquiries_test` database, and they create its tables themselves.

```bash
cd backend && npm test     # 105 tests: API rules, security, validation, concurrency
cd frontend && npm test    # 23 tests: form validation, status actions, list states
```

| Suite | What it covers |
|---|---|
| `backend/tests/inquiries.test.js` | Every route needs login (401). Staff can't read or update others' inquiries (404, same as a missing ID). Supervisors see everything. Validation messages per field, with nothing saved on failure. Duplicate submissions, including simultaneous ones. Status rules, including reopening. Stale versions (409) change nothing. Concurrent changes apply only once. |
| `backend/tests/auth.test.js` | Login, cookie flags, identical errors for a wrong email and a wrong password, forged and expired tokens, logout. |
| `backend/tests/status.test.js` / `validation.test.js` | Every status from→to pair, and the name and contact rules. |
| `frontend/__tests__/InquiryForm.test.jsx` | An invalid form never calls the API. Errors clear when fixed. The form is locked while saving. Server errors are shown and typed input is kept. |
| `frontend/__tests__/StatusActions.test.jsx` | Only allowed actions are shown. The stale-data warning appears and disappears correctly. Refused changes show the reason. |
| `frontend/__tests__/InquiriesView.test.jsx` | Loading, empty and error-with-retry states of the list. |

**Testing gaps:**
- **No end-to-end browser tests** (e.g. Playwright). The full flows, including two tabs, access by direct link and the API being down, were checked by hand in the browser.
- **The login page and the detail page** have no component tests of their own. Their key pieces are covered: `StatusActions` on the frontend, and auth on the backend.
- **No load or performance tests.** Concurrency is covered only by small "5 requests at once" tests.

---

## Useful commands

| Command (in `backend/`) | What it does |
|---|---|
| `npm run dev` / `npm start` | Start the API (`dev` restarts on file changes) |
| `npm run migrate` | Apply any new SQL migrations (each runs once) |
| `npm run seed` | **Replace all data** with the demo users and inquiries |
| `npm run db:reset` | Drop everything, then migrate and seed again (local databases only) |
| Add `-- --test` to any of the above | Run it against the test database, e.g. `npm run seed -- --test` |

To stop the database, run `docker compose down`. Your data is kept; `docker compose down -v` deletes it.

## Configuration

`backend/.env` (copied from `.env.example`):

| Variable | Purpose | Default in the example |
|---|---|---|
| `DATABASE_URL` | App database | `postgres://inquiry:inquiry@localhost:5432/inquiries` |
| `TEST_DATABASE_URL` | Database the tests wipe and reseed | `…/inquiries_test` |
| `JWT_SECRET` | Signs login tokens. **Change it to a long random string.** | placeholder |
| `PORT` | API port | `4000` |

The frontend needs no `.env`. If the API runs somewhere other than `http://localhost:4000`, set `API_URL` before `npm run dev`.

### Using your own PostgreSQL
Create two databases (one for the app, one for tests), point `DATABASE_URL` and `TEST_DATABASE_URL` at them, then run `npm run migrate` and `npm run seed`. The tests set up their own database's tables.

---

## API summary

All responses are JSON. Errors always have the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields are missing or invalid.", "details": { "contact": "…" } } }
```

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/login` | `{ email, password }` sets an httpOnly session cookie. Wrong credentials return 401. |
| `POST` | `/api/auth/logout` | Clears the cookie (204). |
| `GET` | `/api/auth/me` | The signed-in user, or 401. |
| `GET` | `/api/inquiries?status=&q=&page=&pageSize=` | Only inquiries the user may see. Returns `{ items, total, page, totalPages, counts }`. |
| `POST` | `/api/inquiries` | `{ customerName, contact, subject, description }`. Returns 201, 400 (invalid) or 409 `DUPLICATE_INQUIRY`. |
| `GET` | `/api/inquiries/:id` | The inquiry and its status history. Returns 400 `INVALID_ID` or 404 (missing **or** not yours). |
| `PATCH` | `/api/inquiries/:id/status` | `{ status, version }`. Returns 409 `STALE_RECORD` (with the latest record) or 422 `INVALID_TRANSITION`. |
| `GET` | `/api/health` | API and database status. |

Every `/api/inquiries` route returns **401** without a valid session.

## Project structure

```
backend/
  migrations/      SQL schema (001_init.sql)
  scripts/         migrate, seed, reset
  src/
    app.js         Express app (server.js starts it)
    routes/        HTTP layer: parse input, send responses
    services/      business rules and SQL (access rule lives here)
    domain/        status transition table
    validation/    zod request schemas
    middleware/    auth, error handler, ID check
  tests/
frontend/
  app/             Next.js pages: /login, /inquiries, /inquiries/new, /inquiries/[id]
  components/      UI pieces (inquiries/ holds the feature components)
  lib/             API client, data hooks, validation, formatting
  __tests__/
docker-compose.yml PostgreSQL for development and tests
```

## Troubleshooting

- **Port 5432 is already in use.** Another Postgres is running. Either stop it, or change the left-hand port in `docker-compose.yml` (e.g. `"5433:5432"`) and the two URLs in `backend/.env` to match.
- **"Can't load the app" or "The server is having trouble".** The API isn't running, or can't reach the database. Check <http://localhost:4000/api/health>.
- **Suddenly signed out after `npm run seed`.** Seeding recreates the users, so existing sessions end. Sign in again.
