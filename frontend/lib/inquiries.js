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

// One inquiry with its history. Returns the inquiry object itself (not the
// API's { inquiry } wrapper), matching what create and status changes store.
export function useInquiry(id) {
  return useQuery({
    queryKey: queryKeys.inquiries.detail(id),
    queryFn: async ({ signal }) => (await api.getInquiry(id, { signal })).inquiry,
  });
}

// Changes an inquiry's status. Sends the version this screen last saw, so the
// server can refuse the change if someone else changed the inquiry first.
export function useChangeStatus(id) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.inquiries.detail(id);
  const markListsStale = () => queryClient.invalidateQueries({ queryKey: ['inquiries', 'list'] });

  return useMutation({
    mutationFn: async ({ status, version }) => (await api.changeStatus(id, { status, version })).inquiry,
    onSuccess: (inquiry) => {
      queryClient.setQueryData(detailKey, inquiry);
      markListsStale();
    },
    onError: (err) => {
      if (err.code === 'STALE_RECORD' && err.details?.current) {
        // Someone else changed it first. The server sent the latest version,
        // so show that straight away instead of the out-of-date one.
        queryClient.setQueryData(detailKey, err.details.current);
        markListsStale();
      } else if (err.status === 404) {
        // Gone, or no longer ours: reload so the page shows "not found".
        queryClient.invalidateQueries({ queryKey: detailKey });
        markListsStale();
      }
    },
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
