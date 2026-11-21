'use client';

// The "record an inquiry" form.
//
// It checks fields in the browser for instant guidance, but the server is
// still the authority: its answers (field errors, duplicates, failures) are
// shown here too. Whatever happens, what the user typed is never lost.
//
// Props:
//   onSubmit(data) → Promise. Resolve on success; reject with an ApiError on
//                    failure. (Passed in, so tests can supply a fake.)
//   onCancel()     → called by the Cancel button.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FormField } from '@/components/FormField';
import { inquirySchema, validate, LIMITS } from '@/lib/validation';

const FIELDS = ['customerName', 'contact', 'subject', 'description'];
const EMPTY = { customerName: '', contact: '', subject: '', description: '' };

export function InquiryForm({ onSubmit, onCancel }) {
  const formRef = useRef(null);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});   // per-field messages
  const [touched, setTouched] = useState({}); // fields the user has left
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null); // { message, existingId? }
  // Which field to focus next. Focusing happens in an effect, after React has
  // re-rendered: right after a failed save the inputs are still disabled at
  // the moment the error arrives, and a disabled input can't take focus.
  const [focusRequest, setFocusRequest] = useState(null); // { name }

  useEffect(() => {
    if (focusRequest) formRef.current?.elements.namedItem(focusRequest.name)?.focus();
  }, [focusRequest]);

  function focusField(name) {
    if (name) setFocusRequest({ name }); // a new object each time, so the effect re-runs
  }

  function updateField(name, value) {
    const next = { ...values, [name]: value };
    setValues(next);
    // Re-check visited fields while typing, so a fixed error disappears at once.
    if (touched[name]) setErrors(validate(inquirySchema, next).errors);
  }

  function handleBlur(name) {
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors(validate(inquirySchema, values).errors);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return; // ignore double clicks / double Enter

    setBanner(null);
    setTouched(Object.fromEntries(FIELDS.map((f) => [f, true])));
    const { data, errors: found } = validate(inquirySchema, values);
    setErrors(found);
    if (!data) {
      focusField(FIELDS.find((f) => found[f]));
      return; // nothing is sent while the form is invalid
    }

    setSubmitting(true);
    try {
      await onSubmit(data);
      // Success: the page navigates away, so there's nothing to reset here.
    } catch (err) {
      setSubmitting(false);
      if (err.code === 'VALIDATION_ERROR' && err.details) {
        // The server disagreed with a field: show its message on that field.
        setErrors(err.details);
        focusField(FIELDS.find((f) => err.details[f]));
      } else if (err.code === 'DUPLICATE_INQUIRY') {
        setBanner({ message: err.message, existingId: err.details?.existingId });
      } else {
        setBanner({ message: `Couldn't save the inquiry. ${err.message} Nothing you typed has been lost.` });
      }
    }
  }

  const fieldProps = (name) => ({
    id: name,
    name,
    value: values[name],
    onChange: (e) => updateField(name, e.target.value),
    onBlur: () => handleBlur(name),
    error: touched[name] ? errors[name] : undefined,
    disabled: submitting,
    maxLength: LIMITS[name],
  });

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting}
      className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {banner && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{banner.message}</p>
          {banner.existingId && (
            <Link href={`/inquiries/${banner.existingId}`} className="mt-1 inline-block font-medium underline">
              View the existing inquiry
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Customer name" autoComplete="off" {...fieldProps('customerName')} />
        <FormField label="Contact" hint="Email, or a Sri Lankan phone number like 077 123 4567" autoComplete="off" {...fieldProps('contact')} />
      </div>
      <FormField label="Subject" placeholder="e.g. Order #1042 arrived damaged" {...fieldProps('subject')} />
      <div>
        <FormField label="Description" multiline rows={5} {...fieldProps('description')} />
        <p className="mt-1 text-right text-xs text-slate-500">
          {values.description.length} / {LIMITS.description}
        </p>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save inquiry'}
        </button>
      </div>
    </form>
  );
}
