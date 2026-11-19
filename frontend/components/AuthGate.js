'use client';

// Wraps every signed-in page. It decides what to show:
//   - checking the session    → a loading screen
//   - server unreachable      → an error with Retry
//   - not signed in           → redirect to /login (remembering the page)
//   - signed in               → the page
//
// This is for a smooth experience only. Security comes from the backend:
// every API call is checked there, so skipping this component in the browser
// gives access to nothing.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/lib/auth';
import { onUnauthorized } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

export function AuthGate({ children }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isPending, error, refetch } = useMe();

  // If any API call reports 401 (session expired, or logged out in another
  // tab), forget the user and their data. The effect below then redirects.
  useEffect(() => {
    return onUnauthorized(() => {
      queryClient.removeQueries({ queryKey: queryKeys.inquiries.all });
      queryClient.setQueryData(queryKeys.me, null);
    });
  }, [queryClient]);

  const signedOut = !isPending && !error && !user;

  useEffect(() => {
    if (!signedOut) return;
    // Remember where the user was going, so login can bring them back.
    const next = window.location.pathname + window.location.search;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [signedOut, router]);

  if (isPending || signedOut) {
    return <LoadingState label="Checking your session…" fullPage />;
  }
  if (error) {
    return (
      <ErrorState
        title="Can't load the app"
        message={error.message}
        onRetry={() => refetch()}
        fullPage
      />
    );
  }
  return children;
}
