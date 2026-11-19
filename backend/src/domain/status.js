// The inquiry lifecycle rules, in one place.
//
//   NEW ──▶ IN_PROGRESS ──▶ RESOLVED
//    ▲          │  ▲            │
//    └──────────┘  └────────────┘
//    (put back)       (reopen)
//
// - NEW → RESOLVED directly is not allowed: someone has to work on it first.
// - RESOLVED can be reopened (→ IN_PROGRESS), because customers do come back.
// - Setting the status an inquiry already has is not a change, so it's rejected.

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'];

const STATUS_LABELS = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
};

const ALLOWED_TRANSITIONS = {
  NEW: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED', 'NEW'],
  RESOLVED: ['IN_PROGRESS'],
};

function allowedNextStatuses(from) {
  return ALLOWED_TRANSITIONS[from] || [];
}

function canTransition(from, to) {
  return allowedNextStatuses(from).includes(to);
}

module.exports = { STATUSES, STATUS_LABELS, ALLOWED_TRANSITIONS, allowedNextStatuses, canTransition };
