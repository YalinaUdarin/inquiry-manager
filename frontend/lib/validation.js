// Form validation rules for the browser.
//
// These deliberately copy the backend rules (backend/src/validation/schemas.js)
// so users get instant, field-by-field guidance before submitting. The backend
// still checks everything again; this copy is only for a better experience.
// If a rule changes, change it in both places.

import { z } from 'zod';

function isPhone(value) {
  if (!/^\+?[\d\s\-()]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}

function isEmail(value) {
  return z.email().safeParse(value).success;
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
  customerName: requiredText('Customer name', LIMITS.customerName),
  contact: requiredText('Contact', LIMITS.contact).refine(
    (value) => isEmail(value) || isPhone(value),
    'Enter a valid email address or phone number.',
  ),
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
