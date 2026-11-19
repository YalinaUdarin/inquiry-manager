import { Suspense } from 'react';
import { InquiriesView } from '@/components/inquiries/InquiriesView';
import { LoadingState } from '@/components/LoadingState';

export const metadata = { title: 'Inquiries · Inquiry Desk' };

// InquiriesView reads its filters from the URL (useSearchParams), which
// Next.js requires to sit inside a Suspense boundary.
export default function InquiriesPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading inquiries…" rows={5} />}>
      <InquiriesView />
    </Suspense>
  );
}
