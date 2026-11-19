'use client';

// Hooks for the signed-in user.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { queryKeys } from './queryKeys';

// The current user, or null if not signed in.
// A 401 from /auth/me just means "not signed in", so it becomes null rather
// than an error. Other failures (server down) stay errors, so the UI can
// show "can't reach the server" instead of wrongly showing the login page.
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        const { user } = await api.me();
        return user;
      } catch (err) {
        if (err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000, // the user rarely changes; don't recheck on every focus
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: ({ user }) => {
      // Drop anything cached for a previous user, then store the new one.
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    // Clear local data even if the request failed: the user asked to leave.
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, null);
    },
  });
}
