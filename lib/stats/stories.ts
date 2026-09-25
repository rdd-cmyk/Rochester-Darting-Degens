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

  return upsets.find((upset) => eligiblePlayerIds.has(upset.winnerId)) ?? null;
}
