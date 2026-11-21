# Project Plan: Customer Inquiry Management System

*Coffee Ninja: Fullstack Development Technical Assessment*

> **Note:** This is the original plan, written before any code. It's kept to show how the work was planned and split into phases (one commit per phase). The finished app differs in places. For what was actually built and why, see the [README](../README.md) and [DECISIONS.md](../DECISIONS.md). The main differences:
>
> - Pagination, status counts and URL filters were all **built**, not cut.
> - The UI has **no copy of the transition table**. The API sends `allowedTransitions` with each inquiry.
> - Validation is stricter than planned:
>   - Names: letters, digits and `' - . , & ( )`.
>   - Phone numbers: Sri Lankan only.
>   - Duplicate matching: treats `077…` and `+94 77…` as the same number.
> - Next.js 16's Cache Components feature is turned off, and `bcryptjs` is used instead of `bcrypt`.

| | |
|---|---|
| **Stack** | Next.js (React) · Node.js + Express · PostgreSQL |
| **Time budget** | About 10 to 12 hours of work, aiming to finish well before the 7-day deadline (see §11 for the phases) |
| **Grading** | 50% backend, 50% frontend |
| **Deliverables** | GitHub repo · README.md · DECISIONS.md · at least 2 tests · 3 to 5 minute screen recording |

---

## 1. Context

A service business tracks customer inquiries in chat messages and spreadsheets. Staff lose track of who is handling a request, whether it has been addressed, and what happened last.

The goal is **one complete workflow**: a staff member signs in, records an inquiry, finds it later, and moves it through New → In Progress → Resolved.

The workflow has to work properly at every layer, from the UI down to the database. Business rules are enforced in the API, not just in the UI. Every judgement call is written down in DECISIONS.md.

The brief says a small, well-reasoned app beats a feature-rich one. That's why the stack is deliberately simple (raw SQL, no ORM): every line has to be explainable in the follow-up interview.

---

## 2. Minimum working scope coverage

| # | Brief requirement | How the plan meets it |
|---|---|---|
| 1 | **Sign-in.** Seeded accounts are fine. The backend must enforce authentication. | Seeded users with bcrypt-hashed passwords and no registration page. Login puts a JWT in an **httpOnly cookie**. A `requireAuth` middleware protects every `/api/inquiries*` route and returns 401 without a valid cookie. The frontend sends you to `/login` on any 401, but the server is what actually blocks access. |
| 2 | **Inquiry capture.** Customer name, contact, subject, description. | `POST /api/inquiries` and a "New inquiry" form with exactly those 4 fields. |
| 3 | **Inquiry overview.** Status visible at a glance, plus at least one way to narrow down. | List page with a coloured status badge on each row, a **status filter**, and a **text search** (name / subject / contact). |
| 4 | **Inquiry lifecycle.** Change status among New, In Progress and Resolved. | Detail page with status action buttons that call `PATCH /api/inquiries/:id/status`. |
| 5 | **Persistence.** PostgreSQL through your own Node API. No mocks. | Postgres in Docker, SQL migrations and seed data, and an Express API using the plain `pg` driver. |

---

## 3. Scope beyond the minimum

The brief allows **one** extra field or interaction, and only if it clearly improves the workflow.

### The chosen extra: status history

- A small `inquiry_events` table records `(actor, from_status, to_status, timestamp)`.
- The detail page shows "Last changed by Bob · 2h ago" and a short timeline.
- **Why this one:** the brief's problem statement says staff lose track of *"what happened last"*. This answers that directly.

### Other items past the bare minimum

**Decision: all of these are kept.**

| Item | Why it's in the plan |
|---|---|
| `assigned_to` column and `staff` / `supervisor` roles | This is how the access rule works (§4.1), so it's needed, not a feature. |
| `version` column (optimistic locking) | This is how stale data is handled (§5, situation 2). |
| Duplicate check (same contact + subject within 10 minutes) | Answers the "submitted twice" question in the brief. |
| Both search **and** a status filter | Two complementary ways to find an inquiry. |
| Pagination | Keeps the list usable as data grows. |
| Status counts on filter tabs | Shows the workload at a glance. |
| Filters saved in the URL | Filtered views can be shared and survive a refresh. |

---

## 4. Engineering judgement decisions

### 4.1 Ownership and access

- **Should every signed-in employee see every inquiry?** No.
- **The rule:**
  - A `staff` user sees and edits only inquiries **assigned to them**.
  - A new inquiry is assigned to whoever created it.
  - A `supervisor` sees all inquiries.
- **Where it's enforced:** in the SQL query itself:
  `WHERE id = $1 AND ($role = 'supervisor' OR assigned_to = $userId)`
- **What a blocked user gets:** **404 Not Found**, not 403. This avoids revealing that the record exists.
- **Left out on purpose:** reassigning inquiries. The brief says "no complex permissions". This is listed under "what I'd improve next".

### 4.2 Status changes

| From | Allowed to | Not allowed |
|---|---|---|
| New | In Progress | Resolved (it has to be worked on first) |
| In Progress | Resolved, New (put it back) | |
| Resolved | In Progress (**reopen**: customers do come back) | New |

- Setting the status the inquiry already has is rejected.
- **Invalid change:** the API returns **422 `INVALID_TRANSITION`** with the list of allowed next statuses.
- **UI:** only buttons for valid next steps are shown, but the API remains the source of truth.
- Each successful change writes the status update and the history row in **one database transaction**.
- All the rules live in one place: `backend/src/domain/status.js`.

### 4.3 Customer input

**Missing or invalid data**
- The server validates every request with zod:
  - required fields
  - trimmed values
  - length limits
  - contact must be a valid email **or** phone number
- Bad data gets **400 `VALIDATION_ERROR`** with a message for each field.
- The client applies the same rules first, so users are guided before they submit.

**Submitted twice**
- The submit button is disabled while saving, which stops double-clicks.
- The server rejects a new inquiry if an **open** (not Resolved) inquiry with the same contact and subject (normalised) was created in the last **10 minutes**.
- That returns **409 `DUPLICATE_INQUIRY`** with a link to the existing inquiry.
- There's no fuzzy matching or deduplication engine, as the brief asks.

### 4.4 Usability states

| State | What the user sees |
|---|---|
| Loading | Skeleton placeholders on the list and detail pages. |
| No inquiries at all | "No inquiries yet." with a **Create one** button. |
| Filter matches nothing | "No inquiries match this filter." with a **Clear filters** button. |
| Fetch failed | Error box with a **Retry** button. |
| Save failed | Inline error message. **The form keeps what the user typed.** Server field errors appear next to the matching fields. |
| Saving | Button shows "Saving…" and is disabled. |

### 4.5 Trustworthiness

| Case | Response | UI |
|---|---|---|
| Invalid ID (e.g. `/inquiries/abc`) | **400 `INVALID_ID`** | "That link isn't valid" |
| Record doesn't exist, or isn't yours | **404 `NOT_FOUND`** | "Inquiry not found" page with a link back to the list |
| No or expired login | **401 `UNAUTHENTICATED`** | Redirect to `/login` |
| Unexpected server error | **500 `INTERNAL_ERROR`**, no stack trace exposed | Generic "Something went wrong" message with **Retry** |

Every error uses the same shape, produced by one central Express error handler:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "contact": "…" } } }
```

---

## 5. The three real-world situations

### Situation 1: Submitting missing or invalid information

- **Does the UI guide them?** Yes. Clicking Submit with an empty subject or a contact like "abc" shows red messages under those fields, and **no request is sent**. The frontend test covers this.
- **Does the API reject bad data on its own?** Yes. The same payload sent with curl or Postman returns **400** with field errors, and nothing is written to the database. A backend test covers this.
- **Demo:** show the form errors, then send the same payload to the API directly and show the 400.

### Situation 2: Two tabs, one updates, the other shows stale data

Handled with **optimistic concurrency**:

1. Each inquiry has a `version` number that goes up by one on every change.
2. A status change sends `{ status, version }`.
3. The update runs `UPDATE … WHERE id = $1 AND version = $2 RETURNING *`.
4. If no row is updated, the API returns **409 `STALE_RECORD`** with the current record.

**Example**

| Step | Tab A | Tab B |
|---|---|---|
| 1 | Shows In Progress (v3) | Shows In Progress (v3) |
| 2 | Clicks **Resolve**. Succeeds, now v4. | Still shows In Progress (stale) |
| 3 | | Clicks **Back to New** (sends v3). Gets **409**. |
| 4 | | Banner: *"This inquiry was updated elsewhere. Now showing the latest version."* Refreshes to Resolved. User decides again. |

- **Also:** data is fetched again when the window regains focus (TanStack Query), so stale screens usually correct themselves before anyone clicks.
- **The trade-off (for DECISIONS.md):** there's no real-time push (no websockets), so tab B can show old data until it's refocused or tries to write. I accepted this because conflicts are caught **before any harm is done**, and real-time updates would add a lot of complexity for little gain at this size.

### Situation 3: A direct link to an inquiry the user shouldn't see

1. Alice (staff) creates an inquiry.
2. Bob (staff) opens `/inquiries/<alice-id>`.
3. The frontend calls `GET /api/inquiries/<alice-id>` with Bob's cookie.
4. The access check in SQL finds no row Bob is allowed to see, returns **404**, and the UI shows "Inquiry not found".

- **Bypassing the UI:** Bob calling the API with curl, including `PATCH`, gets the same 404, because the check is in the query and not the page. A backend test covers this.
- **Supervisor case:** Sam (supervisor) opening the same link sees the inquiry, which shows the rule is role-based and not just broken.
- **Demo:** Bob and Alice logged in, in two browser profiles, pasting the link across.

---

## 6. Architecture

### Repository layout

```
inquiry-manager/
  docker-compose.yml          # postgres:16 (dev + test databases)
  README.md
  DECISIONS.md
  backend/                    # Express API
    src/
      app.js, server.js, db.js, config.js
      middleware/  auth.js, errorHandler.js, validateUuid.js
      routes/      auth.routes.js, inquiries.routes.js
      services/    inquiries.service.js    # SQL + business rules
      domain/      status.js               # transition table
      validation/  schemas.js              # zod schemas
    migrations/    001_init.sql, 002_seed.sql, migrate.js
    tests/         inquiries.test.js       # Vitest + supertest
  frontend/                   # Next.js (App Router)
    app/           login/, inquiries/, inquiries/new/, inquiries/[id]/
    lib/           api.js                  # fetch wrapper, error normalisation
    components/    InquiryForm, InquiryTable, StatusBadge, StatusActions,
                   Filters, LoadingState, EmptyState, ErrorState
    __tests__/     InquiryForm.test.jsx    # Vitest + React Testing Library
```

### Library choices (to explain in DECISIONS.md)

| Choice | Reason |
|---|---|
| `pg` (raw SQL) instead of an ORM | Every query is visible and easy to explain. The access rule and the version check live directly in the SQL. |
| `zod` | One readable schema per request, with field-level error messages. |
| JWT in an **httpOnly cookie** | JavaScript can't read the token. Next.js `rewrites` proxy `/api/*` to Express, so the cookie is same-origin and no CORS setup is needed. |
| TanStack Query | Handles loading, error, refetch-on-focus and cache invalidation, which keeps component state simple. |
| Tailwind | Fast, minimal styling. Visual design isn't graded. |
| Vitest | One test runner for both apps. |

---

## 7. Data model (`001_init.sql`)

```sql
users (
  id            uuid primary key,
  email         citext unique not null,
  name          text not null,
  password_hash text not null,
  role          text not null check (role in ('staff','supervisor')),
  created_at    timestamptz default now()
)

inquiries (
  id            uuid primary key,
  customer_name text not null,
  contact       text not null,
  subject       text not null,
  description   text not null,
  status        text not null default 'NEW'
                check (status in ('NEW','IN_PROGRESS','RESOLVED')),
  assigned_to   uuid not null references users(id),
  created_by    uuid not null references users(id),
  version       int  not null default 1,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
)

inquiry_events (
  id            uuid primary key,
  inquiry_id    uuid not null references inquiries(id) on delete cascade,
  actor_id      uuid not null references users(id),
  from_status   text,
  to_status     text not null,
  created_at    timestamptz default now()
)

-- indexes
create index on inquiries (assigned_to, updated_at desc);
create index on inquiries (status);
```

### Seed accounts

All three share one demo password, which is documented in the README.

| Email | Role |
|---|---|
| alice@example.test | staff |
| bob@example.test | staff |
| sam@example.test | supervisor |

Each staff user gets a few sample inquiries.

---

## 8. API

| Method | Path | Behaviour |
|---|---|---|
| POST | `/api/auth/login` | Checks credentials and sets the cookie. Wrong credentials return 401. |
| POST | `/api/auth/logout` | Clears the cookie. |
| GET | `/api/auth/me` | Returns the current user, or 401. |
| GET | `/api/inquiries?status=&q=` | Only inquiries the user may see, newest updated first. |
| POST | `/api/inquiries` | Validate → duplicate check → insert (assigned to the current user) → **201** |
| GET | `/api/inquiries/:id` | The inquiry plus its history. Can return 400 or 404 (see §4.5). |
| PATCH | `/api/inquiries/:id/status` | Body `{ status, version }`. Checks the transition, then the version. Can return 409 or 422. |

---

## 9. Frontend pages

1. **Login**
   - Email and password fields.
   - Inline error on bad credentials.
2. **Inquiries list**
   - Status badges (colour plus text label).
   - Status filter and search box.
   - Loading, empty and error states.
3. **New inquiry**
   - Form with field-level validation.
   - Server errors mapped to the matching fields.
   - Submit button disabled while saving.
   - On success, goes to the new inquiry's detail page.
4. **Inquiry detail**
   - All fields and the assignee.
   - Buttons for valid status changes only.
   - Status history timeline.
   - Stale-data (409) banner.
   - Not-found page.

---

## 10. Tests

**Backend** (Vitest + supertest, against a real test Postgres database)

1. Request without a cookie → **401**
2. Bob requests Alice's inquiry → **404**
3. New → Resolved → **422**
4. Stale version → **409**
5. Missing or invalid fields → **400** with field errors

**Frontend** (Vitest + React Testing Library)

1. Submitting an empty form shows field errors and does **not** call the API.
2. `StatusActions` shows only valid next steps, and shows the banner on a 409.

**Gaps to document:** no end-to-end browser tests (e.g. Playwright), no load or concurrency stress tests, and no tests for the login page.

---

## 11. Implementation phases

Work through these in order, one after another, with no fixed days. Each phase ends with a **"Done when"** check: don't start the next phase until it passes. Commit at the end of every phase so the git history tells the story.

### Phase 0: Project setup
- Create `inquiry-manager/` with `backend/` and `frontend/` folders, run `git init`, add `.gitignore`.
- Add `docker-compose.yml` with Postgres 16 and two databases: `inquiries` (dev) and `inquiries_test`.
- Add `backend/.env.example` (`DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, `PORT`).
- Initialise backend `package.json` with these dependencies:
  - express, pg, zod, bcrypt, jsonwebtoken, cookie-parser
  - dev: vitest, supertest, nodemon

**Done when:** `docker compose up -d` runs and you can connect to both databases.

### Phase 1: Database (migrations and seed)
- `migrations/001_init.sql`:
  - turn on the `pgcrypto` and `citext` extensions
  - create the 3 tables and indexes from §7, with `gen_random_uuid()` defaults
- `migrate.js`: runs the SQL files in order and records them in a `schema_migrations` table so each runs only once.
- `seed.js`: hashes the demo password with bcrypt, inserts Alice, Bob and Sam, and adds a few inquiries for Alice and Bob with matching history rows.
- npm scripts: `migrate`, `seed`, `db:reset`.

**Done when:** `npm run migrate && npm run seed` works on a fresh database, and `psql` shows the users and inquiries.

### Phase 2: Backend foundation
- `config.js`: loads env vars and refuses to start if any are missing.
- `db.js`: a `pg` Pool, plus a `withTransaction(fn)` helper.
- `errors.js`: an `AppError(status, code, message, details)` class.
- `middleware/errorHandler.js`: turns `AppError` and zod errors into the standard error shape. Anything else becomes a 500 with no stack trace.
- `middleware/validateUuid.js`: returns 400 `INVALID_ID` for a malformed `:id`.
- `app.js`: sets up json and cookie-parser, the routes, a 404 for unknown routes, and the error handler.
  - Exported **without** calling `listen`, so tests can import it.
  - `server.js` starts listening.
- `GET /api/health`.

**Done when:** `/api/health` returns 200, an unknown route returns a JSON 404, and a thrown error returns a clean 500.

### Phase 3: Authentication
- `POST /api/auth/login`:
  1. validate the body
  2. look up the user and compare with bcrypt
  3. sign a JWT (`sub`, `role`, 8-hour expiry)
  4. set it as an `httpOnly`, `SameSite=Lax` cookie
  - Wrong email or password gives the **same** 401 message either way, so attackers can't tell which was wrong.
- `POST /api/auth/logout`: clears the cookie.
- `GET /api/auth/me`.
- `middleware/requireAuth.js`: verifies the cookie and sets `req.user = { id, role, name }`, or returns 401 `UNAUTHENTICATED`.

**Done when:** you can log in with curl (keeping cookies in a jar), `/me` works with the cookie, and returns 401 without it.

### Phase 4: Inquiry API (core business rules)
- `validation/schemas.js`:
  - `createInquirySchema`: trimmed fields, length limits, contact must be an email or phone number
  - `listQuerySchema`: `status`, `q`, `page`, `pageSize` (maximum 50)
  - `statusChangeSchema`: `{ status, version }`
- `domain/status.js`: the `ALLOWED` transition map and `canTransition(from, to)`.
- `services/inquiries.service.js`. Every query includes the access condition (supervisor sees everything, staff only their own):
  - **`list(user, filters)`**: returns `{ items, total, page, pageSize, counts }`.
    - `counts` is the number per status within the user's visible inquiries and the current search, which feeds the counts on the filter tabs.
    - Uses ILIKE search and `ORDER BY updated_at DESC`, with LIMIT/OFFSET.
  - **`create(user, data)`**, in one transaction:
    - checks for an open duplicate created in the last 10 minutes (contact and subject compared in lowercase), returning 409 `DUPLICATE_INQUIRY` with `details.existingId`
    - otherwise inserts with `assigned_to = created_by = user`, plus an initial history row (`null → NEW`)
  - **`getById(user, id)`**: the inquiry, the assignee's name, and its history (newest first). 404 if not found or not visible.
  - **`changeStatus(user, id, { status, version })`**, in one transaction:
    1. `SELECT … FOR UPDATE` with the access condition. Nothing found → **404**.
    2. Version doesn't match → **409 `STALE_RECORD`**, with the current record.
    3. Transition not allowed → **422 `INVALID_TRANSITION`**, with the allowed list.
    4. `UPDATE` the status, `version = version + 1`, `updated_at = now()`, then insert the history row.

    The version is checked **before** the transition, so a stale tab always gets "refresh" rather than a confusing "not allowed".
- `routes/inquiries.routes.js`: all routes go through `requireAuth`, and `:id` routes also go through `validateUuid`.

**Done when:** every row of the API table (§8) and every error case (§4.5) can be shown with curl.

### Phase 5: Backend tests
- Test setup:
  - points at `TEST_DATABASE_URL`
  - runs the migrations
  - truncates the tables and seeds before each test file
  - has a helper `loginAs(email)` that returns a supertest agent holding the cookie
- Tests:
  1. no cookie → 401
  2. Bob requesting Alice's inquiry → 404, for both GET and PATCH
  3. New → Resolved → 422
  4. stale version → 409, and the status in the database hasn't changed
  5. invalid POST body → 400 with field details
  6. the same POST twice → 409 duplicate
  7. supervisor can see Alice's inquiry → 200

**Done when:** `npm test` in `backend/` passes.

### Phase 6: Frontend foundation
- `create-next-app` (App Router, JavaScript, Tailwind).
- Dependencies: `@tanstack/react-query` and `zod`. Dev: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`.
- `next.config.js`: `rewrites` send `/api/:path*` to `http://localhost:4000/api/:path*`.
- `lib/api.js`: a `request()` wrapper that:
  - always sends cookies (`credentials: 'include'`)
  - parses the error shape into an `ApiError(status, code, message, details)`
  - on 401, sends the user to `/login`
- `lib/validation.js`: the same field rules as the backend schema. The duplication is deliberate and documented.
- `lib/status.js`: status labels, colours and the transition map, mirroring the backend.
- `app/providers.jsx`: QueryClient with `refetchOnWindowFocus: true`.
- A protected layout:
  - `useMe()` query
  - redirects to `/login` if there's no session
  - header showing the user's name and role, with a Logout button
- Shared components: `LoadingState`, `EmptyState`, `ErrorState` (with Retry), `StatusBadge`.

**Done when:** the app runs, and visiting `/inquiries` while logged out sends you to `/login`.

### Phase 7: Login page
- Email and password form.
- Submit button disabled while waiting.
- Inline error on a 401.
- On success, goes to `/inquiries`.
- Shows the demo accounts in a small hint box. Fine for a take-home.

**Done when:** you can log in as all 3 users and log out again.

### Phase 8: Inquiries list page
- Filter, search and page are read from and written to the **URL query string** (`useSearchParams` and `router.replace`).
- `Filters` component:
  - status tabs (All / New / In Progress / Resolved), each with its **count**
  - search box with a 300 ms delay before searching
- `InquiryTable`:
  - columns: customer, subject, contact, status badge, assignee (shown to supervisors only), last updated
  - clicking a row opens the detail page
- Pagination: Previous/Next buttons and "Page X of Y".
- The four states:
  - loading skeleton
  - error with Retry
  - "No inquiries yet" with Create
  - "No matches" with Clear filters
- "New inquiry" button.

**Done when:** filtering, searching and paging all work, survive a refresh, and give the same results as the API.

### Phase 9: Create inquiry form
- `InquiryForm` component:
  - checks fields when you leave them and on submit, using `lib/validation.js`
  - shows error text under each field
  - doesn't call the API while the form is invalid
- Submit uses a `useMutation`. The button shows "Saving…" and is disabled.
- Server error handling:
  - 400 → field errors shown on the matching fields
  - 409 duplicate → a message with a link to the existing inquiry
  - anything else → a general error banner
  - in every case, the typed input is kept
- On success, the list's cached data is refreshed and you go to the new inquiry's detail page.

**Done when:** the empty-form, invalid-contact and duplicate cases each show the right message, and a valid submit lands on the detail page.

### Phase 10: Inquiry detail and lifecycle
- Shows all fields, the assignee, and created/updated times.
- History timeline at the top: "Last changed by X, time ago", then the full list.
- `StatusActions`:
  - only shows buttons for transitions that are allowed
  - sends `{ status, version }`
  - disabled while saving
- Error handling:
  - **409 `STALE_RECORD`** → put the returned current record into the cache and show the "updated elsewhere" banner
  - 422 → show the API's message
- Error pages:
  - 404 → "Inquiry not found" with a link back
  - 400 → "That link isn't valid"
- After any change, the list's cached data is refreshed.

**Done when:** the two-tab conflict shows the banner, and Bob opening Alice's URL shows "not found".

### Phase 11: Frontend tests
- `InquiryForm.test.jsx`: submitting the empty form shows the field errors, and the API mock is **not** called.
- `StatusActions.test.jsx`:
  - for status NEW, only "Start progress" is shown
  - a mocked 409 shows the stale banner

**Done when:** `npm test` in `frontend/` passes.

### Phase 12: Documentation
- **README.md:**
  - prerequisites (Node 20, Docker)
  - setup commands
  - environment variables
  - test accounts
  - how to run the apps and tests
  - API summary
  - testing gaps
- **DECISIONS.md** (about 1 page), with the contents listed in §12, including the AI-usage section.

**Done when:** a fresh clone can be set up by following only the README.

### Phase 13: Final check and recording
- Run the full verification list (§13) on a fresh clone and freshly reset database.
- Clean up code (no stray `console.log`), go through the final commit history, and push to GitHub.
- Record the 3 to 5 minute video following the script in §12.

---

## 12. Submission checklist

- [ ] GitHub repo containing frontend, backend and migrations
- [ ] **README.md:** prerequisites, `docker compose up -d`, migrate and seed, run both apps, test accounts, how to run tests, known testing gaps
- [ ] **DECISIONS.md** (about 1 page):
  - assumptions
  - 2 to 3 design choices (access rule and 404s, optimistic locking, transition table)
  - one accepted trade-off (no real-time updates)
  - what I'd improve next (reassignment, audit of field edits, E2E tests)
  - **AI usage:** where AI helped, plus at least one suggestion accepted, changed or rejected (e.g. rejected an ORM and websockets, accepted optimistic locking)
- [ ] At least 2 tests passing (backend and frontend)
- [ ] **3 to 5 minute recording:**
  1. Log in → create an inquiry → find it → move it through statuses
  2. Failure case: invalid form, then the same data sent straight to the API (400)
  3. Bob opening Alice's link (404)
  4. Two-tab stale conflict (409)
  5. Walkthrough of the part I'm most confident explaining (access rule SQL and the version check)

---

## 13. Verification

1. Run `docker compose up -d`, then `npm run migrate && npm run seed`, then `npm run dev` in `backend/` and `frontend/`.
2. Walk through the full workflow in the browser.
3. Check with curl:
   - No cookie → 401
   - Bob requesting Alice's ID → 404
   - `/api/inquiries/not-a-uuid` → 400
   - Invalid POST body → 400
4. Open two tabs, resolve the inquiry in tab A, then act in tab B → 409 banner and refreshed status.
5. Run `npm test` in both apps and confirm everything passes.

---

## 14. Ownership of work

The interviewers may ask you to explain or change the code live. The build will go in small, reviewable steps, with each piece explained as it's written. That way you can adjust parts yourself and the reasoning in DECISIONS.md is genuinely yours.
