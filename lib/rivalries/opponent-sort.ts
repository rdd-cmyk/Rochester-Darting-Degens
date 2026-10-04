import type { Rivalry } from './engine';
import { STARTING_RATING } from '@/lib/stats/engine';

export type OpponentSort = 'recommended' | 'closest' | 'most-played' | 'never-played';
export function sortOpponents(rivals: Rivalry[], mode: OpponentSort, playerId: string,
  ratings: ReadonlyMap<string, { rating: number }>, names: ReadonlyMap<string, string>) {
  if (mode === 'recommended') return rivals;
  const ownRating = ratings.get(playerId)?.rating ?? STARTING_RATING;
  const distance = (id: string) => Math.abs((ratings.get(id)?.rating ?? STARTING_RATING) - ownRating);
  const selected = mode === 'never-played' ? rivals.filter(rival => rival.meetings.length === 0) : [...rivals];
  return selected.sort((a, b) =>
    (mode === 'closest' ? distance(a.opponent) - distance(b.opponent)
      : mode === 'most-played' ? b.meetings.length - a.meetings.length : 0)
    || (names.get(a.opponent) ?? a.opponent).localeCompare(names.get(b.opponent) ?? b.opponent)
    || a.opponent.localeCompare(b.opponent));
}
