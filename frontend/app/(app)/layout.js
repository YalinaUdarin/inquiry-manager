// Layout for every signed-in page. The "(app)" folder name is a route group:
// the brackets keep it out of the URL, so pages here live at /inquiries etc.

import { AuthGate } from '@/components/AuthGate';
import { AppHeader } from '@/components/AppHeader';

export default function SignedInLayout({ children }) {
  return (
    <AuthGate>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </AuthGate>
  );
}
