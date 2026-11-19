'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, formatRelative } from '@/lib/format';

// The inquiry list. The whole row is clickable for mouse users; the subject
// is a real link so keyboard and screen-reader users can open it too.
export function InquiryTable({ items, showAssignee }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3">Subject</th>
            <th scope="col" className="px-4 py-3">Customer</th>
            <th scope="col" className="hidden px-4 py-3 sm:table-cell">Status</th>
            {showAssignee && <th scope="col" className="hidden px-4 py-3 md:table-cell">Assigned to</th>}
            <th scope="col" className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((inquiry) => {
            const href = `/inquiries/${inquiry.id}`;
            return (
              <tr
                key={inquiry.id}
                onClick={() => router.push(href)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="max-w-xs px-4 py-3">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-slate-900 hover:underline focus:underline"
                  >
                    {inquiry.subject}
                  </Link>
                  {/* On phones the Status column is hidden, so show it here. */}
                  <div className="mt-1 sm:hidden">
                    <StatusBadge status={inquiry.status} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-900">{inquiry.customerName}</div>
                  <div className="text-xs text-slate-500">{inquiry.contact}</div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <StatusBadge status={inquiry.status} />
                </td>
                {showAssignee && (
                  <td className="hidden px-4 py-3 text-slate-700 md:table-cell">{inquiry.assignedTo.name}</td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  <time dateTime={inquiry.updatedAt} title={formatDateTime(inquiry.updatedAt)}>
                    {formatRelative(inquiry.updatedAt)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
