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

module.exports = { loginSchema };
