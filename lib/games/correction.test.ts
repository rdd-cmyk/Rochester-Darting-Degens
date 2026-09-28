import { describe, expect, it } from 'vitest';
import { previewCorrection } from './correction';
import { defaultConfig } from './catalog';
import type { MatchWrite, NightMatch } from '@/lib/league-night/types';
import { scoreSummary } from '@/lib/league-night/recap';

const original: NightMatch = {
  id: 1, revision: 2, played_at: '2026-01-01T00:00:00Z', game_type: 'Other',
  board_type: 'Soft Tip', venue: null, notes: null, created_by: 'a', night_id: null,
  match_players: ['a', 'b'].map((id, i) => ({id: i, player_id: id, score: 100,
    points_scored: null, is_winner: i === 0,
    profiles: {display_name: id, first_name: null, include_first_name_in_display: false}})),
};
const correction: MatchWrite = {
  match_id: 1, expected_revision: 2, played_at: original.played_at,
  game_type: 'Gotcha', game_config: {...defaultConfig(), preset: 'gotcha-301-return-v1'},
  board_type: original.board_type, venue: null, notes: null, night_id: null,
  allow_duplicate: false,
  players: original.match_players!.map(p => ({...p, score: null, is_winner: p.is_winner === true})),
};

describe('correction preview', () => {
  it('reclassifies without inventing score units or changing an unchanged result rating', () => {
    const history = structuredClone([original]);
    expect(previewCorrection(history, correction)).toEqual({from: 'Other', to: 'Gotcha', changes: []});
    expect(history).toEqual([original]);
  });
  it('replays downstream outcomes and rejects stale or missing originals', () => {
    const next = {...original, id: 2, played_at: '2026-01-02T00:00:00Z'};
    const result = previewCorrection([original, next], {
      ...correction, players: correction.players.map(p => ({...p, is_winner: !p.is_winner})),
    });
    expect(result.changes).toHaveLength(2);
    expect(result.changes.find(p => p.id === 'a')!.after).toBeLessThan(result.changes.find(p => p.id === 'a')!.before);
    expect(() => previewCorrection([], correction)).toThrow('Reload');
    expect(() => previewCorrection([original], {...correction, expected_revision: 1})).toThrow('Reload');
  });
  it('keeps shared scores explicitly owned by the side in summaries', () => {
    expect(scoreSummary({...original, game_type: 'Count-Up',
      game_config: {...defaultConfig(), format: '2v2', teamScores: {A: 0, B: 300}},
      match_players: [],
    })).toBe('Team A: 0 Points · Team B: 300 Points');
  });
});
