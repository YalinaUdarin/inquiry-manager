# Decisions

## Assumptions
- **Staff record inquiries for customers.** Customers never sign in; the "submitter" is always a staff member.
- **Two roles are enough.** *Staff* handle their own inquiries, and a *supervisor* oversees everyone's. Accounts are seeded; there's no registration.
- **Customers are people or businesses in Sri Lanka.** Names may include business punctuation ("A&B Traders (Pvt) Ltd"). Phone numbers must be Sri Lankan (`0`/`+94` + 9 digits); anyone else can be recorded with an email address.
- **A new inquiry belongs to whoever records it.** There's no reassignment yet.

## Design choices

**1. The access rule is enforced inside every SQL query, and hidden records return 404.**
- Staff see and change only inquiries assigned to them; supervisors see all.
- The rule is part of each `WHERE` clause (`services/inquiries.service.js`), not just a check in the UI, so a direct link or a curl request gets the same answer.
- Someone else's inquiry returns **404, not 403**. The response is identical to a missing ID, so the API never confirms that a record exists.

**2. Stale data is handled with optimistic locking.**
- Each inquiry has a `version` that goes up on every change. A status change sends the version the screen last saw.
- The server locks the row and checks, in this order:
  1. visible to you? Otherwise **404**
  2. version still current? Otherwise **409 `STALE_RECORD`**, with the latest record
  3. move allowed? Otherwise **422**
- The version is checked before the rule, so a stale tab is told "this changed, here's the latest" instead of a confusing "not allowed".
- The UI swaps in the returned record and explains that the change wasn't saved. Nothing is ever silently overwritten.

**3. One source of truth for rules, and the same rules on both sides.**
- **Status transitions** live in one table (`domain/status.js`):
  - New → Resolved is blocked, because someone must work on an inquiry first.
  - Resolved → In Progress (reopen) is allowed, because customers come back.
  - The API sends `allowedTransitions` with each inquiry, so the UI shows only valid buttons. The server still rejects anything else.
- **Input validation:** the form checks fields for instant guidance, the API independently rejects bad data (400 with a message per field, nothing saved), and database CHECK constraints are a last line of defence.
- **Duplicates:** an open inquiry with the same contact and subject from the last 10 minutes is refused (409), across all staff, with a link to the original.
  - Phone numbers and case are normalised, so `077 123 4567` matches `+94 77 123 4567`.
  - An advisory lock stops two simultaneous submits from both getting through.
  - The original's link is shown only to someone allowed to open it.

## Trade-off I accepted
**No real-time updates.** Two open tabs don't push changes to each other. Instead, a tab refetches when you return to it (and shows "updated elsewhere"), and any change made from an old version is refused with 409. This keeps the system simple (no websockets or extra infrastructure), and the conflict is caught *before* any harm is done. The cost is that a screen can be briefly out of date while it sits in the background.

## What I'd improve next
1. **Reassignment** by supervisors, with the reason recorded in the history.
2. **Internal notes** on an inquiry, so "what happened last" covers more than status changes.
3. **Stronger sessions.** Logout currently clears the cookie, but a copied token stays valid until it expires (8 h). I'd add server-side sessions or token revocation, plus rate limiting on login.
4. **End-to-end tests** (Playwright) for the two-tab and direct-link scenarios, which I checked by hand.
5. **Live updates** (server-sent events) if staff often work on the same inquiries at once.

## Use of AI
I built this with an AI coding assistant (Claude Code) as a pair programmer:
- It drafted the plan and wrote most of the code, one phase at a time.
- I made the product decisions, reviewed each phase, and ran and tested every phase before committing it (one commit per phase).

**Suggestions I accepted:**
- Optimistic locking with a `version` column, instead of last-write-wins.
- Returning 404 rather than 403 for other people's inquiries.

**Suggestions I changed:**
- **The customer name rule.** The first stricter version allowed letters only. I realised customers can be businesses ("A&B Traders", "7-Eleven") and changed it to also allow digits and `& , ( )`.
- **The phone rule.** It originally accepted any international number. I narrowed it to Sri Lankan numbers, but kept email so foreign customers can still be recorded.

**Suggestions I rejected:**
- The plan marked pagination, status counts and URL-based filters as optional, cut-if-short-on-time extras. I kept all of them.
- I chose Docker over a native PostgreSQL install, so reviewers get the same database with one command.

**Testing caught real bugs in the generated code.** All were fixed, and tests now cover them:
- **Lost focus after a server error.** A disabled input can't take focus. This affected both forms.
- **Back skipped pages** in the inquiry list, because filter changes replaced history entries.
- **Wrong data on a failure.** The list showed the *previous* filter's results when a new filter failed to load, even saying "No inquiries yet" while the server was down.
- **A failing error check under Vitest.** An `instanceof` check failed because the test tool loaded the error class twice.
