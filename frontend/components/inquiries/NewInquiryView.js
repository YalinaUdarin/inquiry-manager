'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreateInquiry } from '@/lib/inquiries';
import { InquiryForm } from './InquiryForm';

export function NewInquiryView() {
  const router = useRouter();
  const createInquiry = useCreateInquiry();

  async function handleSubmit(data) {
    const { inquiry } = await createInquiry.mutateAsync(data);
    // replace (not push): pressing Back afterwards goes to the list, not to
    // a form that was already submitted.
    router.replace(`/inquiries/${inquiry.id}?created=1`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/inquiries" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to inquiries
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">New inquiry</h1>
        <p className="text-sm text-slate-600">
          Record what the customer asked. It will be assigned to you and start as New.
        </p>
      </div>
      <InquiryForm onSubmit={handleSubmit} onCancel={() => router.push('/inquiries')} />
    </div>
  );
}
