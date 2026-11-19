// Unit tests for the lifecycle rules in domain/status.js (no database needed).

import { describe, it, expect } from 'vitest';
import { canTransition, allowedNextStatuses, STATUSES } from '../src/domain/status.js';

describe('status transitions', () => {
  // Every possible (from, to) pair, with whether it should be allowed.
  const expected = {
    'NEW->IN_PROGRESS': true,
    'NEW->RESOLVED': false, // must be worked on first
    'NEW->NEW': false,
    'IN_PROGRESS->RESOLVED': true,
    'IN_PROGRESS->NEW': true, // put back
    'IN_PROGRESS->IN_PROGRESS': false,
    'RESOLVED->IN_PROGRESS': true, // reopen
    'RESOLVED->NEW': false,
    'RESOLVED->RESOLVED': false,
  };

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const key = `${from}->${to}`;
      it(`${key} is ${expected[key] ? 'allowed' : 'rejected'}`, () => {
        expect(canTransition(from, to)).toBe(expected[key]);
      });
    }
  }

  it('rejects unknown statuses instead of crashing', () => {
    expect(canTransition('CLOSED', 'NEW')).toBe(false);
    expect(allowedNextStatuses('CLOSED')).toEqual([]);
  });
});
