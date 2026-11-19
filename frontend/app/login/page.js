import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { LoadingState } from '@/components/LoadingState';

export const metadata = { title: 'Sign in · Inquiry Desk' };

// LoginForm reads ?next= from the URL (useSearchParams), which Next.js
// requires to sit inside a Suspense boundary.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense fallback={<LoadingState />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
