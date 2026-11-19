'use client';

// The status panel on the detail page: the current status, a button for
// each move the server allows from here, and the result of the last attempt.
//
// Props:
//   inquiry        → needs status and allowedTransitions
//   onChangeStatus(status) → Promise; resolves with the updated inquiry,
//                    rejects with an ApiError. (Passed in, so tests can fake it.)

import { useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { STATUS_LABELS, actionLabel } from '@/lib/status';

export function StatusActions({ inquiry, onChangeStatus }) {
  const [pendingStatus, setPendingStatus] = useState(null); // the move in progress
  // { kind, message, version }: version = the inquiry version the message
  // describes. Once the inquiry moves past it (e.g. someone else changes it),
  // the message is out of date, so it's hidden.
  const [notice, setNotice] = useState(null);

  async function handleClick(status) {
    if (pendingStatus) return; // one change at a time
    setPendingStatus(status);
    setNotice(null);
    try {
      const updated = await onChangeStatus(status);
      setNotice({
        kind: 'success',
        message: `Status changed to ${STATUS_LABELS[updated.status]}.`,
        version: updated.version,
      });
    } catch (err) {
      const current = err.details?.current;
      if (err.code === 'STALE_RECORD' && current) {
        // The page now shows the latest data (see useChangeStatus). Explain
        // why nothing changed, and let the user decide again.
        setNotice({
          kind: 'warning',
          message:
            'Someone else updated this inquiry while you had it open, so your change was not saved. ' +
            `It is now ${STATUS_LABELS[current.status]}. Please check the latest details and try again if still needed.`,
          version: current.version,
        });
      } else {
        // INVALID_TRANSITION, network or server errors: show what the server said.
        setNotice({ kind: 'error', message: err.message, version: inquiry.version });
      }
    } finally {
      setPendingStatus(null);
    }
  }

  const visibleNotice = notice && notice.version === inquiry.version ? notice : null;

  const noticeStyles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
  };

  return (
    <section aria-labelledby="status-heading" className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 id="status-heading" className="text-sm font-medium text-slate-700">
            Status
          </h2>
          <StatusBadge status={inquiry.status} />
        </div>

        <div className="flex flex-wrap gap-2">
          {inquiry.allowedTransitions.map((to) => (
            <button
              key={to}
              type="button"
              onClick={() => handleClick(to)}
              disabled={pendingStatus !== null}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {pendingStatus === to ? 'Saving…' : actionLabel(inquiry.status, to)}
            </button>
          ))}
        </div>
      </div>

      {visibleNotice && (
        <div
          role={visibleNotice.kind === 'success' ? 'status' : 'alert'}
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${noticeStyles[visibleNotice.kind]}`}
        >
          {visibleNotice.message}
        </div>
      )}
    </section>
  );
}
