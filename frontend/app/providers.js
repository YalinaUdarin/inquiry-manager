'use client';

// Sets up TanStack Query, which handles server data for the whole app:
// loading and error states, caching, and refetching when the window regains
// focus (so a tab left open in the background catches up when you return).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Retry only failures that might succeed on a second try (network problems,
// 5xx). A 4xx means the request itself is wrong (not found, not allowed,
// invalid), so repeating it would just delay the error message.
function shouldRetry(failureCount, error) {
  const status = error?.status;
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false, // never repeat a write automatically
      },
    },
  });
}

let browserQueryClient;

// One client per server render, one shared client in the browser.
function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
