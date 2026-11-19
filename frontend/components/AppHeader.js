'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMe, useLogout } from '@/lib/auth';

export function AppHeader() {
  const router = useRouter();
  const { data: user } = useMe();
  const logout = useLogout();

  function handleLogout() {
    logout.mutate(undefined, { onSettled: () => router.replace('/login') });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/inquiries" className="text-base font-semibold text-slate-900">
          Inquiry Desk
        </Link>

        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-700 sm:inline">
              {user.name}
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium capitalize text-slate-600">
                {user.role}
              </span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {logout.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
