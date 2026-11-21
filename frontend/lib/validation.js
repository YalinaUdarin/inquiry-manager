// Form validation rules for the browser.
//
// These deliberately copy the backend rules (backend/src/validation/schemas.js)
// so users get instant, field-by-field guidance before submitting. The backend
// still checks everything again; this copy is only for a better experience.
// If a rule changes, change it in both places.

import { z } from 'zod';

function isEmail(value) {
  return z.email().safeParse(value).success;
}

// Sri Lankan phone: spaces/dashes allowed, then 0 + 9 digits or +94 + 9 digits.
function isSriLankanPhone(value) {
  const compact = value.replace(/[\s-]/g, '');
  return /^0\d{9}$/.test(compact) || /^\+94\d{9}$/.test(compact);
}

// A message for what's wrong with the contact, or null if it's fine.
// Advice matches what the user seems to be typing (email vs phone).
function contactProblem(value) {
  if (value.includes('@')) {
    return isEmail(value) ? null : 'Enter a valid email address, e.g. name@example.com.';
  }
  if (/^[+\d\s-]+$/.test(value)) {
    return isSriLankanPhone(value)
      ? null
      : 'Enter a Sri Lankan phone number, e.g. 077 123 4567 or +94 77 123 4567.';
  }
  return 'Enter an email address or a Sri Lankan phone number.';
}

// Names of people or businesses: letters (any language), digits, spaces and
// ' - . , & ( ); at least 2 letters. e.g. "K. Perera", "A&B Traders", "7-Eleven".
function nameProblem(value) {
  if (!/^[\p{L}\p{M}\d\s'’.,&()-]+$/u.test(value)) {
    return "Customer name can only contain letters, numbers, spaces and ' - . , & ( ).";
  }
  if ((value.match(/\p{L}/gu) || []).length < 2) {
    return 'Customer name must contain at least 2 letters.';
  }
  return null;
}

function rule(check) {
  return (value, ctx) => {
    const message = check(value);
    if (message) ctx.addIssue({ code: 'custom', message });
  };
}

function requiredText(label, max) {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

export const LIMITS = {
  customerName: 100,
  contact: 120,
  subject: 150,
  description: 2000,
};

export const inquirySchema = z.object({
  customerName: requiredText('Customer name', LIMITS.customerName).superRefine(rule(nameProblem)),
  contact: requiredText('Contact', LIMITS.contact).superRefine(rule(contactProblem)),
  subject: requiredText('Subject', LIMITS.subject),
  description: requiredText('Description', LIMITS.description),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Password is required.'),
});

// Runs a schema and returns either { data } (cleaned values) or
// { errors: { field: "first message" } }, the same shape the API uses.
export function validate(schema, values) {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} };
  const errors = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || '_';
    if (!errors[field]) errors[field] = issue.message;
  }
  return { data: null, errors };
}
