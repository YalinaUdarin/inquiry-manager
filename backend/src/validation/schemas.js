// Request validation rules (zod). Each schema both checks the input and
// cleans it (e.g. trims spaces), so routes only ever see valid, tidy data.
// A failed parse throws a ZodError, which the error handler turns into
// 400 VALIDATION_ERROR with one message per field.

const { z } = require('zod');

const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required.' })
    .trim()
    .min(1, 'Email is required.')
    .pipe(z.email('Enter a valid email address.')),
  password: z
    .string({ error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(200, 'Password is too long.'),
});

// ---------------------------------------------------------------------------
// Inquiries
// ---------------------------------------------------------------------------

const STATUS_VALUES = ['NEW', 'IN_PROGRESS', 'RESOLVED'];

function isEmail(value) {
  return z.email().safeParse(value).success;
}

// A Sri Lankan phone number. Spaces and dashes are allowed for readability,
// then it must be either:
//   0 + 9 digits     e.g. 077 123 4567, 011-234-5678
//   +94 + 9 digits   e.g. +94 77 123 4567
function isSriLankanPhone(value) {
  const compact = value.replace(/[\s-]/g, '');
  return /^0\d{9}$/.test(compact) || /^\+94\d{9}$/.test(compact);
}

// Returns a message explaining what's wrong with a contact, or null if it's
// fine. The message depends on what the user seems to have meant, so an
// almost-right phone number gets phone advice, not email advice.
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

// Customer names: letters in any language (\p{L}, plus accents \p{M}),
// spaces, apostrophes, hyphens and dots, e.g. "Mary-Jane O'Neil", "K. Perera".
// No digits or other symbols, and at least 2 actual letters.
function nameProblem(value) {
  if (!/^[\p{L}\p{M}\s'’.-]+$/u.test(value)) {
    return "Customer name can only contain letters, spaces, apostrophes ('), hyphens (-) and dots (.).";
  }
  if ((value.match(/\p{L}/gu) || []).length < 2) {
    return 'Customer name must contain at least 2 letters.';
  }
  return null;
}

// Turns a "returns a message or null" check into a zod rule.
function rule(check) {
  return (value, ctx) => {
    const message = check(value);
    if (message) ctx.addIssue({ code: 'custom', message });
  };
}

// A required, trimmed text field with a maximum length.
function requiredText(label, max) {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

// Fields a staff member can send when creating an inquiry. Any other keys
// (e.g. status, assignedTo) are silently dropped, so a client can't set them.
// Limits match the CHECK constraints in migrations/001_init.sql.
const createInquirySchema = z.object({
  customerName: requiredText('Customer name', 100).superRefine(rule(nameProblem)),
  contact: requiredText('Contact', 120).superRefine(rule(contactProblem)),
  subject: requiredText('Subject', 150),
  description: requiredText('Description', 2000),
});

// Query string for GET /api/inquiries, e.g. ?status=NEW&q=refund&page=2
// Query values always arrive as strings, so numbers are converted (coerced).
const listQuerySchema = z.object({
  status: z
    .enum(STATUS_VALUES, { error: `Status must be one of ${STATUS_VALUES.join(', ')}.` })
    .optional(),
  q: z
    .string()
    .trim()
    .max(100, 'Search must be 100 characters or fewer.')
    .optional()
    .transform((value) => value || undefined), // treat "" as "no search"
  page: z.coerce.number().int().min(1, 'Page must be 1 or more.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Page size must be at least 1.')
    .max(50, 'Page size must be 50 or fewer.')
    .default(10),
});

// Body for PATCH /api/inquiries/:id/status
// version = the version the client last saw; used to detect stale changes.
const statusChangeSchema = z.object({
  status: z.enum(STATUS_VALUES, {
    error: `Status must be one of ${STATUS_VALUES.join(', ')}.`,
  }),
  version: z
    .number({ error: 'Version is required.' })
    .int('Version must be a whole number.')
    .min(1, 'Version must be 1 or more.'),
});

module.exports = {
  loginSchema,
  createInquirySchema,
  listQuerySchema,
  statusChangeSchema,
  contactProblem,
  nameProblem,
};
