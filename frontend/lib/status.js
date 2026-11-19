// How statuses look and read in the UI.
// Which moves are allowed is decided by the backend: each inquiry arrives
// with `allowedTransitions`, so the UI never keeps its own copy of the rules.

export const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'];

export const STATUS_LABELS = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
};

// Badge colours. The text label is always shown too, so colour is never the
// only way to tell statuses apart.
export const STATUS_BADGE_CLASSES = {
  NEW: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  IN_PROGRESS: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  RESOLVED: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
};

// Button text for each move, worded as an action.
const ACTION_LABELS = {
  'NEW->IN_PROGRESS': 'Start progress',
  'IN_PROGRESS->RESOLVED': 'Mark resolved',
  'IN_PROGRESS->NEW': 'Move back to New',
  'RESOLVED->IN_PROGRESS': 'Reopen',
};

export function actionLabel(from, to) {
  return ACTION_LABELS[`${from}->${to}`] ?? `Set to ${STATUS_LABELS[to] ?? to}`;
}
