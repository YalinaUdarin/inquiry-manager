// The status history: who changed the status, from what, to what, and when.
// `history` arrives newest first from the API.

import { STATUS_LABELS } from '@/lib/status';
import { formatDateTime, formatRelative } from '@/lib/format';

function describe(event) {
  if (!event.fromStatus) return 'recorded the inquiry';
  return `moved it from ${STATUS_LABELS[event.fromStatus]} to ${STATUS_LABELS[event.toStatus]}`;
}

export function HistoryList({ history }) {
  return (
    <section aria-labelledby="history-heading" className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 id="history-heading" className="text-sm font-medium text-slate-700">
        History
      </h2>
      <ol className="mt-3 space-y-3">
        {history.map((event) => (
          <li key={event.id} className="flex gap-3 text-sm">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
            <div>
              <span className="font-medium text-slate-900">{event.actor.name}</span>{' '}
              <span className="text-slate-700">{describe(event)}</span>
              <div className="text-xs text-slate-500">
                <time dateTime={event.at} title={formatDateTime(event.at)}>
                  {formatRelative(event.at)}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// One-line summary for the top of the page: "Last change: Bob moved it from
// New to In Progress, 2 hours ago". Answers "what happened last?" at a glance.
export function LastChange({ history }) {
  const latest = history[0];
  if (!latest) return null;
  return (
    <p className="text-sm text-slate-600">
      Last change: <span className="font-medium text-slate-800">{latest.actor.name}</span> {describe(latest)},{' '}
      <time dateTime={latest.at} title={formatDateTime(latest.at)}>
        {formatRelative(latest.at)}
      </time>
      .
    </p>
  );
}
