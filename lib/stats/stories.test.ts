import { describe, expect, test } from 'vitest';

import { pickEligibleUpset, pickPositiveLeader } from './stories';
import type { PlayerAdvancedStats, UpsetStory } from './types';

function player(
  playerId: string,
  ratingDelta: number,
  ratingDeltaLastFive: number
): PlayerAdvancedStats {
  return {
    playerId,
    displayName: playerId,
    rank: 1,
    games: 3,
    wins: 1,
    losses: 2,
    winPct: 33.3,
    rating: 1500 + ratingDelta,
    ratingDelta,
    ratingDeltaLastFive,
    provisional: true,
    expectedWins: 1.5,
    winDelta: -0.5,
    strengthOfSchedule: 1500,
    qualityWinPoints: 0,
    recentWins: 1,
    recentGames: 3,
    ratingHistory: [],
    scoreDistribution: null,
  };
}

function upset(winnerId: string, probability: number): UpsetStory {
  return {
    matchId: winnerId,
    playedAt: '2026-08-30T20:00:00.000Z',
    gameType: '501',
    winnerId,
    winnerName: winnerId,
    expectedWinProbability: probability,
    opponentNames: ['Opponent'],
  };
}

describe('statistics dashboard stories', () => {
  test('does not apply positive labels to zero or negative movement', () => {
    const players = [player('A', -2, -1), player('B', 0, -3)];

    expect(pickPositiveLeader(players, 'ratingDelta')).toBeNull();
    expect(pickPositiveLeader(players, 'ratingDeltaLastFive')).toBeNull();
  });

  test('selects the strongest positive movement', () => {
    const players = [player('A', 8, 3), player('B', 12, 1)];

    expect(pickPositiveLeader(players, 'ratingDelta')?.playerId).toBe('B');
    expect(pickPositiveLeader(players, 'ratingDeltaLastFive')?.playerId).toBe('A');
  });

  test('uses the best upset whose winner meets the sample threshold', () => {
    const eligiblePlayers = [player('B', 2, 1)];
    const upsets = [upset('A', 0.1), upset('B', 0.2), upset('C', 0.3)];

    expect(pickEligibleUpset(upsets, eligiblePlayers)?.winnerId).toBe('B');
  });
});
