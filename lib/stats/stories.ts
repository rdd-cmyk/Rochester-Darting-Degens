import type { PlayerAdvancedStats, UpsetStory } from './types';

type PositiveMetric = 'ratingDelta' | 'ratingDeltaLastFive';

export function pickPositiveLeader(
  players: PlayerAdvancedStats[],
  metric: PositiveMetric
): PlayerAdvancedStats | null {
  const leader = players.reduce<PlayerAdvancedStats | null>(
    (best, player) =>
      best === null || player[metric] > best[metric] ? player : best,
    null
  );

  return leader && leader[metric] > 0 ? leader : null;
}

export function pickEligibleUpset(
  upsets: UpsetStory[],
  eligiblePlayers: PlayerAdvancedStats[]
): UpsetStory | null {
  const eligiblePlayerIds = new Set(
    eligiblePlayers.map((player) => player.playerId)
  );

  return upsets.find((upset) =>
    ((upset.winnerIds?.length ?? 1) === 1 || upset.expectedWinProbability < 0.5 - 1e-10) &&
    (upset.winnerIds ?? [upset.winnerId]).every(id => eligiblePlayerIds.has(id))) ?? null;
}
