import { describe, expect, test } from 'vitest';

import { localDateTimeInputToIso, toLocalDateTimeInput } from './dateTime';

describe('match date-time helpers', () => {
  test('formats an ISO date for a datetime-local control', () => {
    expect(toLocalDateTimeInput('2026-08-29T20:30:00.000Z')).toMatch(
      /^2026-08-(29|30)T\d{2}:30$/
    );
  });

  test('round-trips a local datetime into a valid ISO timestamp', () => {
    expect(new Date(localDateTimeInputToIso('2026-08-29T18:30')).toISOString()).toMatch(
      /^2026-08-(29|30)T\d{2}:30:00\.000Z$/
    );
  });

  test('rejects an invalid value', () => {
    expect(() => localDateTimeInputToIso('')).toThrow(
      'Choose a valid date and time for the match.'
    );
    expect(toLocalDateTimeInput('not-a-date')).toBe('');
  });
});
