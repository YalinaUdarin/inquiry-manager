'use client';

// Data hooks for inquiries. Components use these instead of calling the API
// directly, so caching and refreshing work the same everywhere.

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { queryKeys } from './queryKeys';

export const PAGE_SIZE = 10;

// One page of the list for the given filters ({ status, q, page }).
export function useInquiryList(filters) {
  return useQuery({
    queryKey: queryKeys.inquiries.list(filters),
    queryFn: ({ signal }) => api.listInquiries({ ...filters, pageSize: PAGE_SIZE }, { signal }),
    // While the next page or filter loads, keep showing the current results
    // (marked as updating) instead of flashing back to a skeleton.
    placeholderData: keepPreviousData,
  });
}
