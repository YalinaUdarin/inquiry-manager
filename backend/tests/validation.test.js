// Unit tests for the customer name and contact rules (no database needed).
// The frontend copies these rules in frontend/lib/validation.js.

import { describe, it, expect } from 'vitest';
import { contactProblem, nameProblem, createInquirySchema } from '../src/validation/schemas.js';

describe('contact: an email, or a Sri Lankan phone number', () => {
  const accepted = [
    'name@example.com',
    'first.last+tag@sub.example.lk',
    '0771234567',     // mobile, local form
    '077 123 4567',   // with spaces
    '077-123-4567',   // with dashes
    '011 234 5678',   // landline
    '+94771234567',   // international form
    '+94 77 123 4567',
  ];
  for (const value of accepted) {
    it(`accepts "${value}"`, () => expect(contactProblem(value)).toBeNull());
  }

  const rejected = {
    'name@': /valid email address/,
    'name@example': /valid email address/,
    '077123456': /Sri Lankan phone number/,     // 9 digits: one short
    '07712345678': /Sri Lankan phone number/,   // 11 digits: one too many
    '771234567': /Sri Lankan phone number/,     // missing the leading 0
    '+1 555 123 4567': /Sri Lankan phone number/, // another country
    '+94 077 123 4567': /Sri Lankan phone number/, // +94 and the 0 together
    '(077) 123 4567': /email address or a Sri Lankan phone number/, // brackets
    abc: /email address or a Sri Lankan phone number/,
  };
  for (const [value, message] of Object.entries(rejected)) {
    it(`rejects "${value}"`, () => expect(contactProblem(value)).toMatch(message));
  }
});

describe('customer name: a person or a business', () => {
  const accepted = [
    'Nimal Jayasinghe',
    "Mary-Jane O'Neil",
    'K. Perera',
    'José Álvarez',
    'நிமல்',
    'Al',
    // Businesses
    'A&B Traders',
    '7-Eleven',
    'Perera & Sons (Pvt) Ltd',
    'Smith, Jones and Co.',
    'R2-D2',
  ];
  for (const value of accepted) {
    it(`accepts "${value}"`, () => expect(nameProblem(value)).toBeNull());
  }

  const rejected = {
    'John_Smith': /can only contain letters, numbers/,
    'Alice@Home': /can only contain letters, numbers/,
    '<script>': /can only contain letters, numbers/,
    'Shop #5': /can only contain letters, numbers/,
    'A': /at least 2 letters/,
    "'. -": /at least 2 letters/,
    '123 456': /at least 2 letters/,
  };
  for (const [value, message] of Object.entries(rejected)) {
    it(`rejects "${value}"`, () => expect(nameProblem(value)).toMatch(message));
  }
});

describe('createInquirySchema', () => {
  it('reports "required" (not a format message) for an empty field', () => {
    const result = createInquirySchema.safeParse({ customerName: '', contact: '', subject: 'S', description: 'D' });
    const first = (field) => result.error.issues.find((i) => i.path[0] === field).message;
    expect(first('customerName')).toBe('Customer name is required.');
    expect(first('contact')).toBe('Contact is required.');
  });
});
