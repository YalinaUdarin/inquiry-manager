import { InquiryDetailView } from '@/components/inquiries/InquiryDetailView';

export const metadata = { title: 'Inquiry · Inquiry Desk' };

// params and searchParams are Promises in this version of Next.js.
// ?created=1 is added after recording a new inquiry, to show a confirmation.
export default async function InquiryDetailPage({ params, searchParams }) {
  const { id } = await params;
  const { created } = await searchParams;
  return <InquiryDetailView id={id} justCreated={created === '1'} />;
}
