'use client';

// The list's filters live in the URL (?status=NEW&q=refund&page=2), not in
// component state. That means a filtered view survives a refresh, works with
// the browser's back button, and can be shared as a link.

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { STATUSES } from './status';

// Reads the URL, ignoring anything invalid (e.g. ?status=FOO or ?page=-3),
// so a mistyped link shows the normal list instead of an error.
function parseFilters(searchParams) {
  const status = searchParams.get('status');
  const q = (searchParams.get('q') ?? '').trim();
  const page = Number.parseInt(searchParams.get('page') ?? '', 10);
  return {
    status: STATUSES.includes(status) ? status : undefined,
    q: q || undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function useInquiryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // Merge changes into the URL. Changing the status or search goes back to
  // page 1, because page 3 of the old results may not exist in the new ones.
  const setFilters = useCallback(
    (changes) => {
      const next = { ...parseFilters(searchParams), ...changes };
      if ('status' in changes || 'q' in changes) next.page = 1;

      const params = new URLSearchParams();
      if (next.status) params.set('status', next.status);
      if (next.q) params.set('q', next.q);
      if (next.page > 1) params.set('page', String(next.page));

      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      // Clicking a status or page adds a history entry, so Back undoes it.
      // Search replaces the entry instead, so Back doesn't step through
      // every pause in typing.
      if ('q' in changes) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const clearFilters = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  const hasFilters = Boolean(filters.status || filters.q);

  return { filters, setFilters, clearFilters, hasFilters };
}
