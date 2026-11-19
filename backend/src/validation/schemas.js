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

// A phone number: optional leading +, then digits with spaces, dashes or
// brackets, containing 7 to 15 digits in total (the international maximum).
function isPhone(value) {
  if (!/^\+?[\d\s\-()]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}

function isEmail(value) {
  return z.email().safeParse(value).success;
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
  customerName: requiredText('Customer name', 100),
  contact: requiredText('Contact', 120).refine(
    (value) => isEmail(value) || isPhone(value),
    'Enter a valid email address or phone number.',
  ),
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
  isPhone,
};
