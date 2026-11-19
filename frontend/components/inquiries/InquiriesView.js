'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useMe } from '@/lib/auth';
import { useInquiryFilters } from '@/lib/useInquiryFilters';
import { useInquiryList, PAGE_SIZE } from '@/lib/inquiries';
import { STATUS_LABELS } from '@/lib/status';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusTabs } from './StatusTabs';
import { SearchBox } from './SearchBox';
import { InquiryTable } from './InquiryTable';
import { Pagination } from './Pagination';

const primaryButton =
  'inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800';
const secondaryButton =
  'inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';

export function InquiriesView() {
  const { data: user } = useMe();
  const isSupervisor = user?.role === 'supervisor';
  const { filters, setFilters, clearFilters, hasFilters } = useInquiryFilters();
  const { data, isPending, isFetching, isPlaceholderData, error, refetch } = useInquiryList(filters);
  // Stable function, so the search box's 300 ms wait isn't restarted every
  // time the list re-renders.
  const handleSearch = useCallback((q) => setFilters({ q }), [setFilters]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Inquiries</h1>
          <p className="text-sm text-slate-600">
            {isSupervisor ? 'All inquiries across the team.' : 'Inquiries assigned to you.'}
          </p>
        </div>
        <Link href="/inquiries/new" className={primaryButton}>
          New inquiry
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusTabs value={filters.status} counts={data?.counts} onChange={(status) => setFilters({ status })} />
        <SearchBox value={filters.q ?? ''} onSearch={handleSearch} />
      </div>

      {/* Announced to screen readers when results change in the background. */}
      <p aria-live="polite" className="h-4 text-xs text-slate-500">
        {isFetching && !isPending ? 'Updating…' : ''}
      </p>

      <ListBody
        data={data}
        isPending={isPending}
        isPlaceholderData={isPlaceholderData}
        error={error}
        refetch={refetch}
        filters={filters}
        hasFilters={hasFilters}
        isSupervisor={isSupervisor}
        clearFilters={clearFilters}
        setFilters={setFilters}
      />
    </div>
  );
}

// Explains why nothing matched, naming the active filters.
function noMatchMessage({ status, q }) {
  const label = status ? STATUS_LABELS[status] : null;
  if (status && q) return `No ${label} inquiries match "${q}".`;
  if (q) return `Nothing matches "${q}".`;
  return `No inquiries are ${label} right now.`;
}

// Picks which of the list's states to show.
function ListBody(props) {
  const { data, isPending, isPlaceholderData, error, refetch } = props;

  // 1. First load, nothing to show yet.
  if (isPending) return <LoadingState label="Loading inquiries…" rows={5} />;

  // 2. These filters have never loaded successfully. Any data on screen
  //    belongs to the previous filters (kept as a placeholder), so showing it
  //    would be misleading. Show the error instead.
  if (error && (!data || isPlaceholderData)) {
    return <ErrorState title="Couldn't load inquiries" message={error.message} onRetry={() => refetch()} />;
  }

  // 3. These filters loaded before, but a background refresh failed. Keep
  //    the last good result and add a warning on top.
  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>Couldn&apos;t refresh the list, so this may be out of date. {error.message}</span>
          <button type="button" className="font-medium underline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}
      <ListContent {...props} />
    </div>
  );
}

function ListContent({ data, isPlaceholderData, filters, hasFilters, isSupervisor, clearFilters, setFilters }) {
  const { items, total, counts } = data;

  // a. Nothing recorded at all (not just filtered away).
  if (counts.ALL === 0 && !filters.q) {
    return (
      <EmptyState
        title="No inquiries yet"
        message={
          isSupervisor
            ? 'When anyone on the team records an inquiry, it will appear here.'
            : 'Inquiries you record will appear here.'
        }
        action={<Link href="/inquiries/new" className={primaryButton}>Record the first inquiry</Link>}
      />
    );
  }

  // b. A page number past the end (e.g. an old link after inquiries changed).
  if (items.length === 0 && total > 0) {
    return (
      <EmptyState
        title={`There's no page ${filters.page}`}
        message={`These filters have ${total} ${total === 1 ? 'inquiry' : 'inquiries'}.`}
        action={<button type="button" className={secondaryButton} onClick={() => setFilters({ page: 1 })}>Go to the first page</button>}
      />
    );
  }

  // c. Filters or search match nothing.
  if (items.length === 0) {
    return (
      <EmptyState
        title="No inquiries match"
        message={noMatchMessage(filters)}
        action={hasFilters && <button type="button" className={secondaryButton} onClick={clearFilters}>Clear filters</button>}
      />
    );
  }

  // d. Results. While the next page or filter loads, the current rows stay
  //    visible but faded.
  return (
    <div className="space-y-4">
      <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
        <InquiryTable items={items} showAssignee={isSupervisor} />
      </div>
      <Pagination
        page={data.page}
        pageSize={PAGE_SIZE}
        total={total}
        totalPages={data.totalPages}
        disabled={isPlaceholderData}
        onPageChange={(page) => setFilters({ page })}
      />
    </div>
  );
}
