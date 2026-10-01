import { expect, it } from 'vitest';
import { nightRecapContext } from './recap-context';

it('uses Rochester midnight rather than UTC midnight for live-night wording', () => {
  expect(nightRecapContext('2026-10-01', new Date('2026-10-02T03:59:59Z')).summary).toBe('So far tonight');
  expect(nightRecapContext('2026-10-01', new Date('2026-10-02T04:00:00Z')).summary).toBe('Night recap');
  expect(nightRecapContext('2026-01-01', new Date('2026-01-02T04:59:59Z')).summary).toBe('So far tonight');
  expect(nightRecapContext('2026-01-01', new Date('2026-01-02T05:00:00Z')).summary).toBe('Night recap');
});
it('does not imply a future night is live or a past night is finalized', () => {
  expect(nightRecapContext('2026-10-03', new Date('2026-10-02T18:00:00Z')).summary).toBe('Recorded results');
  expect(nightRecapContext('2026-09-30', new Date('2026-10-02T18:00:00Z')).eyebrow).toBe('The night in review');
});
