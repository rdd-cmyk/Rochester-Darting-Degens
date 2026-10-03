import { expect, it } from 'vitest';
import { defaultConfig } from './catalog';
import { buildLeagueAdvancedStats } from '@/lib/stats/engine';
import { buildNightRecap, facts } from '@/lib/league-night/recap';
import type { NightMatch } from '@/lib/league-night/types';

function match(id: number, overrides: Partial<NightMatch> = {}): NightMatch {
  return {
    id, played_at: new Date(Date.UTC(2026, 0, id)).toISOString(), revision: 1,
    game_type: '501', game_config: defaultConfig(), board_type: 'Soft Tip',
    created_by: 'a', night_id: 'night', venue: null, notes: null,
    match_players: ['a', 'b'].map((player_id, i) => ({
      id: id * 10 + i, player_id, is_winner: i === 0, score: 40 + id,
      points_scored: null, profiles: {display_name: player_id, first_name: null, include_first_name_in_display: false},
    })),
    ...overrides,
  };
}

it('does not let excluded practice records disable eligible score comparisons', () => {
  const practice = match(1, {game_type: 'Cricket', game_config: {...defaultConfig(), context: 'practice'}});
  const result = buildLeagueAdvancedStats(facts([practice, match(2)]));
  expect(result.matchesAnalyzed).toBe(1);
  expect(result.matchesIgnored).toBe(1);
  expect(result.scoreLabel).toBe('3DA');
  expect(result.players[0].scoreDistribution?.median).toBe(42);
});

it('does not treat intentionally unrated games as holes in award history', () => {
  const practice = match(1, {game_config: {...defaultConfig(), context: 'practice'}});
  const result = buildNightRecap([practice, match(2), match(3)], 'night');
  expect(result.incompleteHistory).toBe(0);
  expect(result.awards.some(a => a.kind === 'first' && a.playerId === 'a')).toBe(true);
  expect(result.awards.some(a => a.kind === 'best' && a.playerId === 'a')).toBe(true);
});
