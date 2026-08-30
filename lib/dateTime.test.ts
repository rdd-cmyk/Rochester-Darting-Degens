import { describe, expect, test } from 'vitest';

import {
  localDateTimeInputToIso,
  resolvePlayedAtIso,
  toLocalDateTimeInput,
} from './dateTime';

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

  test('preserves the exact original timestamp when its displayed minute is unchanged', () => {
    const original = '2026-08-29T20:30:56.789Z';

    expect(resolvePlayedAtIso(toLocalDateTimeInput(original), original)).toBe(original);
  });

  test('uses the edited minute when the datetime-local value changes', () => {
    const original = '2026-08-29T20:30:56.789Z';
    const editedInput = toLocalDateTimeInput(
      new Date(new Date(original).getTime() + 60_000)
    );

    expect(resolvePlayedAtIso(editedInput, original)).toBe(
      localDateTimeInputToIso(editedInput)
    );
  });
});
