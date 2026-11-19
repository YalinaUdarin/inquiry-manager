'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLogin, useMe } from '@/lib/auth';
import { loginSchema, validate } from '@/lib/validation';
import { FormField } from '@/components/FormField';

const DEFAULT_DESTINATION = '/inquiries';

// Only allow redirects to pages on this site. Without this check, a link like
// /login?next=https://evil.example could send users to another site after
// they sign in (an "open redirect").
function safeDestination(next) {
  if (typeof next !== 'string') return DEFAULT_DESTINATION;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return DEFAULT_DESTINATION;
  if (next.startsWith('/login')) return DEFAULT_DESTINATION;
  return next;
}

// Demo accounts from the seed data. Shown in development only.
const DEMO_ACCOUNTS = [
  { email: 'alice@example.test', role: 'staff' },
  { email: 'bob@example.test', role: 'staff' },
  { email: 'sam@example.test', role: 'supervisor' },
];
const DEMO_PASSWORD = 'Password123!';
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== 'production';

export function LoginForm() {
  const router = useRouter();
  const destination = safeDestination(useSearchParams().get('next'));
  const { data: currentUser } = useMe();
  const login = useLogin();

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});       // per-field messages
  const [touched, setTouched] = useState({});     // fields the user has left
  const [formError, setFormError] = useState(''); // message about the whole form
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  // Which field to focus next ('email' | 'password'). Focusing happens in an
  // effect, after React re-renders: when the server answers, the inputs are
  // still disabled for that moment, and a disabled input can't take focus.
  const [focusRequest, setFocusRequest] = useState(null); // { name }

  useEffect(() => {
    if (!focusRequest) return;
    (focusRequest.name === 'email' ? emailRef : passwordRef).current?.focus();
  }, [focusRequest]);

  // Already signed in (e.g. opened /login in a new tab)? Go straight in.
  useEffect(() => {
    if (currentUser) router.replace(destination);
  }, [currentUser, destination, router]);

  function updateField(name, value) {
    const next = { ...values, [name]: value };
    setValues(next);
    setFormError('');
    // Once a field has been visited, re-check it as the user types, so an
    // error disappears as soon as it's fixed.
    if (touched[name]) setErrors(validate(loginSchema, next).errors);
  }

  function handleBlur(name) {
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors(validate(loginSchema, values).errors);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    const { data, errors: found } = validate(loginSchema, values);
    setErrors(found);
    if (!data) {
      // Move focus to the first problem, so keyboard and screen-reader users
      // land on it directly.
      setFocusRequest({ name: found.email ? 'email' : 'password' });
      return;
    }

    login.mutate(data, {
      onSuccess: () => router.replace(destination),
      onError: (err) => {
        if (err.code === 'VALIDATION_ERROR' && err.details) {
          setErrors(err.details);
        } else {
          // Wrong credentials, server down, etc. Keep what was typed, except
          // clear the password after a failed attempt (common practice).
          setFormError(err.message);
          if (err.code === 'INVALID_CREDENTIALS') {
            setValues((v) => ({ ...v, password: '' }));
            setFocusRequest({ name: 'password' });
          }
        }
      },
    });
  }

  function fillDemo(email) {
    setValues({ email, password: DEMO_PASSWORD });
    setErrors({});
    setFormError('');
  }

  if (currentUser) {
    return <p className="text-sm text-slate-600">You&apos;re already signed in. Redirecting…</p>;
  }

  const busy = login.isPending;

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-center text-2xl font-semibold text-slate-900">Inquiry Desk</h1>
      <p className="mt-1 text-center text-sm text-slate-600">Sign in to manage customer inquiries.</p>

      <form
        onSubmit={handleSubmit}
        noValidate // our own messages replace the browser's built-in ones
        className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        {formError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </div>
        )}

        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          value={values.email}
          onChange={(e) => updateField('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          error={touched.email ? errors.email : undefined}
          disabled={busy}
          inputRef={emailRef}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => updateField('password', e.target.value)}
          onBlur={() => handleBlur('password')}
          error={touched.password ? errors.password : undefined}
          disabled={busy}
          inputRef={passwordRef}
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {SHOW_DEMO_ACCOUNTS && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <p className="font-medium text-slate-800">Demo accounts</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Password for all: <code className="rounded bg-slate-100 px-1">{DEMO_PASSWORD}</code>
          </p>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email} className="flex items-center justify-between gap-2">
                <span className="text-slate-700">
                  {account.email} <span className="text-xs text-slate-500">({account.role})</span>
                </span>
                <button
                  type="button"
                  onClick={() => fillDemo(account.email)}
                  disabled={busy}
                  className="text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
