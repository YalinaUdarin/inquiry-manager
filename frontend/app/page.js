import { redirect } from 'next/navigation';

// The app's home is the inquiry list. (Signed-out users are sent on to /login
// from there.)
export default function Home() {
  redirect('/inquiries');
}
