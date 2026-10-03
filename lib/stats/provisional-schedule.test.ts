import { describe, expect, test } from 'vitest';
import { defaultConfig, type GameConfig } from '@/lib/games/catalog';
import { buildLeagueAdvancedStats } from './engine';
import type { MatchFact } from './types';

function game(id: number, ids = ['Tim', 'Other'], size = 1, winner = ids[0]): MatchFact[] {
  const config: GameConfig = { ...defaultConfig(), preset: '701-double-v1',
    format: size === 1 ? 'individual' : size === 2 ? '2v2' : '3v3',
    sides: size === 1 ? {} : Object.fromEntries(ids.map((p, i) => [p, i < size ? 'A' : 'B'])) };
  return ids.map((playerId, i) => ({ matchId: String(id), playerId, displayName: playerId,
    playedAt: new Date(Date.UTC(2026, 0, id)).toISOString(), gameType: '701',
    boardType: 'Soft Tip', venue: null, score: 50 + i, gameConfig: config,
    isWinner: size === 1 ? playerId === winner : i < size }));
}
const player = (facts: MatchFact[], id: string) => buildLeagueAdvancedStats(facts).players.find(p => p.playerId === id)!;
const history = (count: number) => Array.from({ length: count }, (_, i) => game(i + 1)).flat();

describe('provisional opponent schedule replacement', () => {
  test('replaces all provisional encounters including graduation, then uses established pre-match ratings', () => {
    const facts = history(12);
    const tim = player(facts, 'Tim');
    const graduation = tim.ratingHistory[10].rating;
    const expected = (10 * graduation + graduation + tim.ratingHistory[11].rating) / 12;
    expect(player(facts, 'Other').strengthOfSchedule).toBeCloseTo(expected, 10);
    expect(player(history(10), 'Other').strengthOfSchedule).toBeCloseTo(graduation, 10);
    expect(graduation).toBeGreaterThan(1500);
    expect(buildLeagueAdvancedStats([...facts].reverse())).toEqual(buildLeagueAdvancedStats(facts));
  });

  test('retains original estimates before graduation and for a narrower history', () => {
    const facts = history(9);
    const tim = player(facts, 'Tim');
    const expected = tim.ratingHistory.slice(0, 9).reduce((sum, p) => sum + p.rating, 0) / 9;
    expect(player(facts, 'Other').strengthOfSchedule).toBeCloseTo(expected, 10);
    const full = history(10);
    expect(player(full, 'Other').strengthOfSchedule).not.toBeCloseTo(expected, 5);
    expect(player(full.filter(f => Number(f.matchId) < 10), 'Other').strengthOfSchedule).toBeCloseTo(expected, 10);
  });

  test('an early opponent who never plays again retains the graduation estimate through later growth and slumps', () => {
    const first = game(1, ['Tim', 'Ben']);
    const graduationFacts = [...first, ...Array.from({ length: 9 }, (_, i) => game(i + 2)).flat()];
    const graduation = player(graduationFacts, 'Tim').rating;
    const later = [...graduationFacts, ...Array.from({ length: 20 }, (_, i) => game(i + 11, ['Tim', 'Other'], 1, i < 10 ? 'Tim' : 'Other')).flat()];
    expect(player(later, 'Ben').strengthOfSchedule).toBe(graduation);
    expect(player(later, 'Tim').rating).not.toBe(graduation);
  });

  test.each([2, 3])('uses fractional evidence and only opposing players for team size %i', size => {
    const ids = Array.from({ length: size * 2 }, (_, i) => `P${i}`);
    const count = 10 * size;
    const facts = Array.from({ length: count }, (_, i) => game(i + 1, ids, size)).flat();
    expect(player(facts.slice(0, -size * 2), ids[0]).provisional).toBe(true);
    const result = buildLeagueAdvancedStats(facts);
    expect(result.players.every(p => !p.provisional)).toBe(true);
    const opposingMean = result.players.filter(p => ids.indexOf(p.playerId) >= size).reduce((sum, p) => sum + p.rating, 0) / size;
    expect(player(facts, ids[0]).strengthOfSchedule).toBeCloseTo(opposingMean, 10);
  });

  test('averages mixed established and graduating opponents within a match and weights appearances equally', () => {
    const training = history(10);
    const established = player(training, 'Tim').rating;
    const encounter = game(11, ['Ben', 'Tim', 'New']);
    const later = Array.from({ length: 9 }, (_, i) => game(i + 12, ['New', 'Fresh'])).flat();
    const facts = [...training, ...encounter, ...later];
    const newcomerGraduation = player(facts, 'New').rating;
    expect(player(facts, 'Ben').strengthOfSchedule).toBeCloseTo((established + newcomerGraduation) / 2, 10);
  });

  test('recomputes graduation after historical corrections and deletion', () => {
    const facts = history(11);
    const corrected = facts.map(f => f.matchId === '1' ? { ...f, isWinner: !f.isWinner } : f);
    const correctedTim = player(corrected, 'Tim');
    expect(player(corrected, 'Other').strengthOfSchedule).toBeCloseTo(correctedTim.ratingHistory[10].rating, 10);
    expect(player(corrected, 'Other').strengthOfSchedule).not.toBe(player(facts, 'Other').strengthOfSchedule);
    const deleted = facts.filter(f => f.matchId !== '1');
    expect(player(deleted, 'Other').strengthOfSchedule).toBeCloseTo(player(deleted, 'Tim').ratingHistory[10].rating, 10);
  });
});
