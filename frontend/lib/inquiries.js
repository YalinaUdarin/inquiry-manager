'use client';

// Data hooks for inquiries. Components use these instead of calling the API
// directly, so caching and refreshing work the same everywhere.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

// Records a new inquiry. On success, the new inquiry is put straight into
// the cache (so its page opens instantly) and every list is marked out of
// date, so counts and results include it next time they're shown.
export function useCreateInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createInquiry,
    onSuccess: ({ inquiry }) => {
      queryClient.setQueryData(queryKeys.inquiries.detail(inquiry.id), inquiry);
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'list'] });
    },
  });
}
