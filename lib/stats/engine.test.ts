import { describe, expect, test } from 'vitest';

import {
  buildLeagueAdvancedStats,
  RATING_K_FACTOR,
  STARTING_RATING,
} from './engine';
import type { MatchFact } from './types';

function match(
  matchId: string,
  winnerId: string | null,
  players: Array<{ id: string; score?: number }>,
  options: { gameType?: string; playedAt?: string } = {}
): MatchFact[] {
  return players.map((player) => ({
    matchId,
    playerId: player.id,
    displayName: player.id,
    playedAt: options.playedAt ?? `2026-01-${matchId.padStart(2, '0')}T20:00:00.000Z`,
    gameType: options.gameType ?? '501',
    boardType: 'Steel Tip',
    venue: 'Test venue',
    isWinner: player.id === winnerId,
    score: player.score ?? null,
  }));
}

describe('RDD rating engine', () => {
  test.each([
    ['A', 'B'], ['B', 'A'],
    ['A', 'B', 'C'], ['C', 'A', 'B'], ['B', 'C', 'A'],
  ])('uses pre-match schedule ratings regardless of participant order: %j', (...ids) => {
    const result = buildLeagueAdvancedStats(match('1', 'A', ids.map(id => ({ id }))));
    for (const player of result.players) {
      expect(player.strengthOfSchedule).toBe(STARTING_RATING);
    }
  });

  test.each([
    ['A', 'B', 'C'], ['A', 'C', 'B'], ['B', 'A', 'C'],
    ['B', 'C', 'A'], ['C', 'A', 'B'], ['C', 'B', 'A'],
  ])('averages unequal pre-match opponents per match: %j', (...ids) => {
    const result = buildLeagueAdvancedStats([
      ...match('1', 'A', [{ id: 'A' }, { id: 'B' }]),
      ...match('2', 'C', ids.map(id => ({ id }))),
    ]);
    // Before match 2: A=1516, B=1484, C=1500. Weight each match equally.
    const expected = { A: 1496, B: 1504, C: 1500 };
    for (const [id, schedule] of Object.entries(expected)) {
      expect(result.players.find(player => player.playerId === id)?.strengthOfSchedule)
        .toBeCloseTo(schedule, 8);
    }
  });

  test('updates an even two-player match symmetrically', () => {
    const result = buildLeagueAdvancedStats(match('1', 'A', [{ id: 'A' }, { id: 'B' }]));
    const playerA = result.players.find((player) => player.playerId === 'A');
    const playerB = result.players.find((player) => player.playerId === 'B');

    expect(playerA?.rating).toBe(STARTING_RATING + RATING_K_FACTOR / 2);
    expect(playerB?.rating).toBe(STARTING_RATING - RATING_K_FACTOR / 2);
    expect((playerA?.rating ?? 0) + (playerB?.rating ?? 0)).toBe(STARTING_RATING * 2);
    expect(playerA?.expectedWins).toBe(0.5);
    expect(playerA?.provisional).toBe(true);
  });

  test('uses a zero-sum multiplayer update', () => {
    const result = buildLeagueAdvancedStats(
      match('1', 'A', [{ id: 'A' }, { id: 'B' }, { id: 'C' }])
    );
    const totalRating = result.players.reduce((sum, player) => sum + player.rating, 0);

    expect(totalRating).toBeCloseTo(STARTING_RATING * 3, 8);
    expect(result.players.find((player) => player.playerId === 'A')?.rating).toBeCloseTo(
      STARTING_RATING + RATING_K_FACTOR * (2 / 3),
      8
    );
  });

  test('uses chronology for ratings and identifies the least likely winner', () => {
    const facts = [
      ...match('1', 'A', [{ id: 'A' }, { id: 'B' }]),
      ...match('2', 'A', [{ id: 'A' }, { id: 'B' }]),
      ...match('3', 'A', [{ id: 'A' }, { id: 'B' }]),
      ...match('4', 'B', [{ id: 'A' }, { id: 'B' }]),
    ];
    const result = buildLeagueAdvancedStats(facts.reverse());

    expect(result.biggestUpset?.matchId).toBe('4');
    expect(result.biggestUpset?.winnerId).toBe('B');
    expect(result.biggestUpset?.expectedWinProbability).toBeLessThan(0.5);
    expect(result.matchesAnalyzed).toBe(4);
  });

  test('orders numeric match IDs numerically when timestamps are equal', () => {
    const playedAt = '2026-01-01T20:00:00.000Z';
    const result = buildLeagueAdvancedStats([
      ...match('10', 'B', [{ id: 'A' }, { id: 'B' }], { playedAt }),
      ...match('2', 'A', [{ id: 'A' }, { id: 'B' }], { playedAt }),
    ]);

    expect(result.biggestUpset?.matchId).toBe('10');
    expect(result.upsets.map((upset) => upset.matchId)).toEqual(['10', '2']);
  });

  test('calculates expected record, schedule strength, form, and quality wins', () => {
    const result = buildLeagueAdvancedStats([
      ...match('1', 'A', [{ id: 'A' }, { id: 'B' }]),
      ...match('2', 'A', [{ id: 'A' }, { id: 'B' }]),
      ...match('3', 'B', [{ id: 'A' }, { id: 'B' }]),
    ]);
    const playerA = result.players.find((player) => player.playerId === 'A');

    expect(playerA?.expectedWins).toBeGreaterThan(1.5);
    expect(playerA?.winDelta).toBeCloseTo(2 - (playerA?.expectedWins ?? 0), 8);
    expect(playerA?.strengthOfSchedule).toBeLessThan(STARTING_RATING);
    expect(playerA?.ratingDeltaLastFive).toBeCloseTo(playerA?.ratingDelta ?? 0, 8);
    expect(playerA?.qualityWinPoints).toBeGreaterThan(0.9);
  });

  test('builds a robust score distribution for one discipline', () => {
    const facts = [40, 50, 60, 70].flatMap((score, index) =>
      match(
        String(index + 1),
        'A',
        [
          { id: 'A', score },
          { id: 'B', score: 45 },
        ],
        { gameType: '501' }
      )
    );
    const result = buildLeagueAdvancedStats(facts);
    const distribution = result.players.find((player) => player.playerId === 'A')
      ?.scoreDistribution;

    expect(result.scoreLabel).toBe('3DA');
    expect(distribution).toMatchObject({
      games: 4,
      average: 55,
      median: 55,
      lowerQuartile: 47.5,
      upperQuartile: 62.5,
      best: 70,
      medianAbsoluteDeviation: 10,
    });
  });

  test('does not compare scores across mixed disciplines', () => {
    const result = buildLeagueAdvancedStats([
      ...match('1', 'A', [{ id: 'A', score: 60 }, { id: 'B', score: 50 }], {
        gameType: '501',
      }),
      ...match('2', 'B', [{ id: 'A', score: 2.5 }, { id: 'B', score: 3 }], {
        gameType: 'Cricket',
      }),
    ]);

    expect(result.scoreLabel).toBeNull();
  });

  test.each([
    ['Cricket', 'MPR'],
    ['Other', 'Score'],
  ])('uses the correct score label for %s', (gameType, label) => {
    const result = buildLeagueAdvancedStats(
      match('1', 'A', [{ id: 'A', score: 0 }, { id: 'B' }], { gameType })
    );

    expect(result.scoreLabel).toBe(label);
    expect(
      result.players.find((player) => player.playerId === 'A')?.scoreDistribution
        ?.normalizedDeviation
    ).toBe(0);
  });

  test('deduplicates a player within a match and refreshes an unknown name later', () => {
    const firstMatch = match('1', 'A', [{ id: 'A' }, { id: 'B' }]);
    firstMatch[0].displayName = '';
    const secondMatch = match('2', 'B', [{ id: 'A' }, { id: 'B' }]);
    secondMatch[0].displayName = 'Ace';

    const result = buildLeagueAdvancedStats([
      ...firstMatch,
      { ...firstMatch[0], score: 99 },
      ...secondMatch,
      { ...secondMatch[0], matchId: '' },
      { ...secondMatch[1], playerId: '' },
    ]);

    expect(result.matchesAnalyzed).toBe(2);
    expect(result.players.find((player) => player.playerId === 'A')).toMatchObject({
      displayName: 'Ace',
      games: 2,
    });
  });

  test('ignores matches without exactly one winner', () => {
    const result = buildLeagueAdvancedStats(match('1', null, [{ id: 'A' }, { id: 'B' }]));

    expect(result.matchesAnalyzed).toBe(0);
    expect(result.matchesIgnored).toBe(1);
    expect(result.players).toEqual([]);
    expect(result.biggestUpset).toBeNull();
  });
});
