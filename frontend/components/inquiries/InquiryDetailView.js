'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useInquiry, useChangeStatus } from '@/lib/inquiries';
import { formatDateTime } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/status';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { StatusActions } from './StatusActions';
import { HistoryList, LastChange } from './HistoryList';

const backLink = (
  <Link href="/inquiries" className="text-sm text-slate-600 hover:text-slate-900">
    ← Back to inquiries
  </Link>
);

const backButton = (
  <Link
    href="/inquiries"
    className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
  >
    Back to inquiries
  </Link>
);

export function InquiryDetailView({ id, justCreated }) {
  const { data: inquiry, isPending, error, refetch } = useInquiry(id);

  // 1. Loading.
  if (isPending) {
    return (
      <div className="space-y-4">
        {backLink}
        <LoadingState label="Loading inquiry…" rows={4} />
      </div>
    );
  }

  // 2. Could not load. 404 covers both "doesn't exist" and "not yours": the
  //    server answers the same for both, so the page can't (and shouldn't)
  //    tell them apart.
  if (error && !inquiry) {
    if (error.status === 404) {
      return (
        <ErrorState
          title="Inquiry not found"
          message="It may have been removed, or it isn't assigned to you."
          action={backButton}
        />
      );
    }
    if (error.code === 'INVALID_ID') {
      return <ErrorState title="That link isn't valid" message="Check the address and try again." action={backButton} />;
    }
    return (
      <ErrorState title="Couldn't load this inquiry" message={error.message} onRetry={() => refetch()} action={backButton} />
    );
  }

  return (
    <InquiryDetail
      // A new id means a different inquiry: start its local state fresh.
      key={inquiry.id}
      inquiry={inquiry}
      refreshError={error}
      onRetry={() => refetch()}
      justCreated={justCreated}
    />
  );
}

function InquiryDetail({ inquiry, refreshError, onRetry, justCreated }) {
  const changeStatus = useChangeStatus(inquiry.id);
  const [showCreated, setShowCreated] = useState(justCreated);

  // The version this screen has "acknowledged". If the data on screen moves
  // past it without this tab making the change (e.g. it was refetched when
  // the window regained focus), tell the user it changed under them.
  const [knownVersion, setKnownVersion] = useState(inquiry.version);
  const updatedElsewhere = inquiry.version !== knownVersion;

  // Drop ?created=1 from the address after showing the message once, so a
  // refresh doesn't show "recorded" again.
  useEffect(() => {
    if (justCreated) window.history.replaceState(null, '', window.location.pathname);
  }, [justCreated]);

  async function handleChangeStatus(status) {
    try {
      const updated = await changeStatus.mutateAsync({ status, version: inquiry.version });
      setKnownVersion(updated.version); // our own change, nothing to warn about
      return updated;
    } catch (err) {
      // On a conflict the page already shows the latest data; StatusActions
      // explains it, so don't warn twice.
      if (err.code === 'STALE_RECORD' && err.details?.current) setKnownVersion(err.details.current.version);
      throw err;
    }
  }

  const contactHref = inquiry.contact.includes('@')
    ? `mailto:${inquiry.contact}`
    : `tel:${inquiry.contact.replace(/[^\d+]/g, '')}`;

  return (
    <div className="space-y-5">
      {backLink}

      {showCreated && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span>Inquiry recorded and assigned to you.</span>
          <button type="button" onClick={() => setShowCreated(false)} className="font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {updatedElsewhere && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>
            This inquiry was updated elsewhere while you had it open. It&apos;s now{' '}
            <strong>{STATUS_LABELS[inquiry.status]}</strong>, and you&apos;re seeing the latest details.
          </span>
          <button type="button" onClick={() => setKnownVersion(inquiry.version)} className="font-medium underline">
            OK
          </button>
        </div>
      )}

      {refreshError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>Couldn&apos;t check for updates, so this may be out of date. {refreshError.message}</span>
          <button type="button" onClick={onRetry} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-slate-900">{inquiry.subject}</h1>
        <LastChange history={inquiry.history} />
      </div>

      <StatusActions inquiry={inquiry} onChangeStatus={handleChangeStatus} />

      <section aria-label="Inquiry details" className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Customer">{inquiry.customerName}</Detail>
          <Detail label="Contact">
            <a href={contactHref} className="text-slate-900 underline underline-offset-2">
              {inquiry.contact}
            </a>
          </Detail>
          <Detail label="Assigned to">{inquiry.assignedTo.name}</Detail>
          <Detail label="Recorded">{formatDateTime(inquiry.createdAt)}</Detail>
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-500">Description</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-900">{inquiry.description}</dd>
          </div>
        </dl>
      </section>

      <HistoryList history={inquiry.history} />
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  );
}
