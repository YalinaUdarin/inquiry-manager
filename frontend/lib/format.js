// Date formatting helpers.

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

// "just now", "5 minutes ago", "yesterday", "3 weeks ago"
export function formatRelative(value, now = Date.now()) {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  if (Math.abs(seconds) < 45) return 'just now';
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(Math.round(seconds / 60), 'minute');
}

// "19 Nov 2026, 14:05": the exact time, for tooltips and detail pages.
export function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
