import { expect, it } from 'vitest';
import { sortOpponents } from './opponent-sort';
import type { Rivalry } from './engine';
const rivals = [{ opponent: 'b', meetings: [1, 2, 3] }, { opponent: 'c', meetings: [1] }, { opponent: 'd', meetings: [] }] as unknown as Rivalry[];
const names = new Map([['b', 'Bravo'], ['c', 'Charlie'], ['d', 'Delta']]);
const ratings = new Map([['a', { rating: 1600 }], ['b', { rating: 1400 }], ['c', { rating: 1590 }]]);
it('sorts by distance using the starting rating for unrated players without mutating discovery', () => {
  expect(sortOpponents(rivals, 'closest', 'a', ratings, names).map(r => r.opponent)).toEqual(['c', 'd', 'b']);
  expect(rivals.map(r => r.opponent)).toEqual(['b', 'c', 'd']);
});
it('sorts by completed singles meetings and filters never-played rivals', () => {
  expect(sortOpponents(rivals, 'most-played', 'a', ratings, names).map(r => r.opponent)).toEqual(['b', 'c', 'd']);
  expect(sortOpponents(rivals, 'never-played', 'a', ratings, names).map(r => r.opponent)).toEqual(['d']);
  expect(sortOpponents(rivals, 'recommended', 'a', ratings, names)).toEqual(rivals);
});
