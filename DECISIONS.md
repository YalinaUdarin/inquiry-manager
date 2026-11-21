# Decisions

## Assumptions
- **Staff record inquiries for customers**, who never sign in. Accounts are seeded; there's no registration.
- **Two roles:**
  - *staff* handle the inquiries assigned to them
  - a *supervisor* sees everyone's
- **A new inquiry is assigned to whoever records it.** There's no reassignment yet.
- **Customers are people or businesses in Sri Lanka.**
  - Names may include business punctuation ("A&B Traders (Pvt) Ltd").
  - Phone numbers must be Sri Lankan (`0` or `+94`, then 9 digits). Anyone else can be recorded by email.

The libraries used, and why, are listed under "Technology choices" in the README.

## Design choices

**1. The access rule lives inside every SQL query, and hidden records return 404.**
- The check is part of each `WHERE` clause, so a direct link or curl request is refused too, not just the UI.
- Someone else's inquiry returns 404, not 403: identical to a missing ID, so the API never confirms it exists.

**2. Stale data is handled with optimistic locking.**
- Every change increases the inquiry's `version`, and a status change sends the version the screen last saw.
- The server locks the row, then answers in this order:
  - **404** if you can't see it
  - **409** if the version is old, sending back the latest record
  - **422** if the move isn't allowed
- Checking the version first means a stale tab is told "this changed, here's the latest" rather than "not allowed".
- Nothing is ever silently overwritten.

**3. Each rule is written once on the server, and the UI follows it.**
- **Transitions:**
  - New → Resolved is blocked; someone must work on an inquiry first.
  - Resolved → In Progress (reopen) is allowed.
  - The API sends `allowedTransitions` with each inquiry, so the UI only shows valid buttons, while the server still refuses anything else.
- **Validation:** the form guides users. The API independently rejects bad data (400 with a message per field, nothing saved). Database constraints are a last safety net.
- **Duplicates:** the same contact and subject within 10 minutes, while still open, is refused with 409, across all staff.
  - Phone formats are normalised (`077…` = `+94 77…`).
  - A lock stops simultaneous submits from both getting through.
  - The link to the original is shown only to someone allowed to open it.

## Trade-off I accepted
**No real-time updates.** A background tab doesn't update until you return to it. It then refetches and says "updated elsewhere", and any change made from an old version is refused with 409. This avoids websockets and extra infrastructure, and conflicts are caught before any harm is done. The cost is that a screen can be briefly out of date.

## What I'd improve next
1. Reassignment by supervisors, and internal notes on an inquiry.
2. Token revocation and login rate limiting. Today a copied token stays valid until it expires (8 h).
3. End-to-end tests (Playwright) for the two-tab and direct-link scenarios, which were checked by hand.

## Use of AI
I used Claude Code as a pair programmer.
- It drafted the plan and wrote most of the code, one phase at a time.
- I made the product decisions, and ran and checked each phase before committing it.

**Accepted:**
- Optimistic locking with a `version` column, instead of last-write-wins.
- 404 rather than 403 for other people's inquiries.

**Changed:**
- **Name rule.** The first version allowed letters only. I widened it to allow digits and `& , ( )`, because customers can be businesses.
- **Phone rule.** It originally accepted any international number. I limited it to Sri Lankan numbers, but kept email for foreign customers.

**Rejected:** cutting pagination, status counts and URL filters, which the plan marked optional. I kept all three.

**Testing caught bugs in the generated code**, all now fixed and covered:
- Focus was lost after a server error, because the field was still disabled.
- The list showed the previous filter's results when a new filter failed to load.
- Back skipped pages in the list.
