import { expect, it } from 'vitest';

import { formatRecordedScore } from './matchScore';

it('shows missing scores without fabricating zero and preserves recorded values', () => {
  expect(formatRecordedScore(null)).toBe('—');
  expect(formatRecordedScore(undefined)).toBe('—');
  expect(formatRecordedScore(0)).toBe('0');
  expect(formatRecordedScore(2.35)).toBe('2.35');
});
