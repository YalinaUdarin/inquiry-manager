// The inquiry list page's states: loading, loaded, empty, and failed with a
// working Retry. The API and the Next.js router are replaced with fakes.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InquiriesView } from '@/components/inquiries/InquiriesView';
import { api, ApiError } from '@/lib/api';

// --- Fakes --------------------------------------------------------------------

const searchParams = new URLSearchParams(); // no filters in the URL
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/inquiries',
  useSearchParams: () => searchParams,
}));

vi.mock('@/lib/auth', () => ({
  useMe: () => ({ data: { id: 'u1', name: 'Alice Perera', role: 'staff' } }),
}));

// Keep the real ApiError; replace only the network call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { listInquiries: vi.fn() } };
});

// --- Helpers --------------------------------------------------------------------

function listResponse(items) {
  const counts = { ALL: items.length, NEW: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const item of items) counts[item.status] += 1;
  return { items, page: 1, pageSize: 10, total: items.length, totalPages: 1, counts };
}

const SAMPLE = {
  id: 'i1',
  subject: 'Order #1042 arrived damaged',
  customerName: 'Nimal Jayasinghe',
  contact: 'nimal.j@example.com',
  status: 'NEW',
  assignedTo: { id: 'u1', name: 'Alice Perera' },
  updatedAt: new Date().toISOString(),
};

function renderPage() {
  // A fresh cache per test, with no automatic retries, so failures show at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <InquiriesView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.listInquiries.mockReset();
});

// --- Tests --------------------------------------------------------------------

describe('InquiriesView', () => {
  it('shows a loading placeholder, then the inquiries with their status', async () => {
    api.listInquiries.mockResolvedValue(listResponse([SAMPLE]));
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading inquiries…' })).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Order #1042 arrived damaged' })).toHaveAttribute('href', '/inquiries/i1');
    expect(screen.getByText('Nimal Jayasinghe')).toBeInTheDocument();
    // Status tab shows its count.
    expect(screen.getByRole('button', { name: /^New\s*1$/ })).toBeInTheDocument();
    // Staff don't see the "Assigned to" column.
    expect(screen.queryByRole('columnheader', { name: 'Assigned to' })).not.toBeInTheDocument();
  });

  it('explains when there are no inquiries yet and offers to record one', async () => {
    api.listInquiries.mockResolvedValue(listResponse([]));
    renderPage();

    expect(await screen.findByText('No inquiries yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record the first inquiry' })).toHaveAttribute('href', '/inquiries/new');
  });

  it('shows an error with a working "Try again" when loading fails', async () => {
    const user = userEvent.setup({ delay: null });
    api.listInquiries
      .mockRejectedValueOnce(new ApiError(503, 'HTTP_503', 'The server is having trouble right now.'))
      .mockResolvedValueOnce(listResponse([SAMPLE]));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load inquiries");
    expect(alert).toHaveTextContent('The server is having trouble right now.');
    // It must not pretend the list is empty.
    expect(screen.queryByText('No inquiries yet')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'Order #1042 arrived damaged' })).toBeInTheDocument();
    expect(api.listInquiries).toHaveBeenCalledTimes(2);
  });
});
