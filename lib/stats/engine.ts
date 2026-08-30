import type {
  LeagueAdvancedStats,
  MatchFact,
  PlayerAdvancedStats,
  RatingHistoryPoint,
  ScoreDistribution,
  UpsetStory,
} from './types';

export const STARTING_RATING = 1500;
export const RATING_K_FACTOR = 32;
export const PROVISIONAL_MATCHES = 10;

type PlayerAccumulator = {
  playerId: string;
  displayName: string;
  games: number;
  wins: number;
  expectedWins: number;
  opponentRatingTotal: number;
  opponentMatchCount: number;
  qualityWinPoints: number;
  outcomes: boolean[];
  scores: number[];
  rating: number;
  ratingHistory: RatingHistoryPoint[];
};

type MatchGroup = {
  matchId: string;
  playedAt: string;
  gameType: string | null;
  participants: MatchFact[];
};

function numericDate(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function quantile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const position = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;

  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

function buildDistribution(values: number[]): ScoreDistribution | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  const deviations = sorted
    .map((value) => Math.abs(value - median))
    .sort((a, b) => a - b);
  const medianAbsoluteDeviation = quantile(deviations, 0.5);

  return {
    games: sorted.length,
    average: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median,
    lowerQuartile: quantile(sorted, 0.25),
    upperQuartile: quantile(sorted, 0.75),
    best: sorted[sorted.length - 1],
    medianAbsoluteDeviation,
    normalizedDeviation: median > 0 ? medianAbsoluteDeviation / median : 0,
  };
}

function detectScoreLabel(facts: MatchFact[]): LeagueAdvancedStats['scoreLabel'] {
  const gameTypes = new Set(
    facts.map((fact) => fact.gameType).filter((gameType): gameType is string => Boolean(gameType))
  );

  if (gameTypes.size !== 1) return null;
  const [gameType] = gameTypes;
  if (gameType === '501' || gameType === '301') return '3DA';
  if (gameType === 'Cricket') return 'MPR';
  return 'Score';
}

function groupMatches(facts: MatchFact[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();

  for (const fact of facts) {
    if (!fact.matchId || !fact.playerId) continue;

    const existing = groups.get(fact.matchId);
    if (existing) {
      if (!existing.participants.some((participant) => participant.playerId === fact.playerId)) {
        existing.participants.push(fact);
      }
      continue;
    }

    groups.set(fact.matchId, {
      matchId: fact.matchId,
      playedAt: fact.playedAt,
      gameType: fact.gameType,
      participants: [fact],
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const dateDifference = numericDate(a.playedAt) - numericDate(b.playedAt);
    return dateDifference || a.matchId.localeCompare(b.matchId);
  });
}

function ensurePlayer(
  players: Map<string, PlayerAccumulator>,
  participant: MatchFact,
  firstPlayedAt: string
): PlayerAccumulator {
  const existing = players.get(participant.playerId);
  if (existing) {
    if (existing.displayName === 'Unknown player' && participant.displayName) {
      existing.displayName = participant.displayName;
    }
    return existing;
  }

  const player: PlayerAccumulator = {
    playerId: participant.playerId,
    displayName: participant.displayName || 'Unknown player',
    games: 0,
    wins: 0,
    expectedWins: 0,
    opponentRatingTotal: 0,
    opponentMatchCount: 0,
    qualityWinPoints: 0,
    outcomes: [],
    scores: [],
    rating: STARTING_RATING,
    ratingHistory: [
      {
        matchId: `start:${participant.playerId}`,
        playedAt: firstPlayedAt,
        rating: STARTING_RATING,
      },
    ],
  };

  players.set(participant.playerId, player);
  return player;
}

export function buildLeagueAdvancedStats(facts: MatchFact[]): LeagueAdvancedStats {
  const matches = groupMatches(facts);
  const players = new Map<string, PlayerAccumulator>();
  let matchesAnalyzed = 0;
  let matchesIgnored = 0;
  let biggestUpset: UpsetStory | null = null;

  for (const match of matches) {
    const winners = match.participants.filter((participant) => participant.isWinner);
    if (match.participants.length < 2 || winners.length !== 1) {
      matchesIgnored += 1;
      continue;
    }

    const participantStates = match.participants.map((participant) => ({
      fact: participant,
      player: ensurePlayer(players, participant, match.playedAt),
    }));
    const ratingWeights = participantStates.map(({ player }) =>
      10 ** (player.rating / 400)
    );
    const totalRatingWeight = ratingWeights.reduce((sum, value) => sum + value, 0);
    const expectedProbabilities = ratingWeights.map((value) => value / totalRatingWeight);
    const winnerIndex = participantStates.findIndex(({ fact }) => fact.isWinner);
    const winnerProbability = expectedProbabilities[winnerIndex];
    const winner = participantStates[winnerIndex];

    if (!biggestUpset || winnerProbability < biggestUpset.expectedWinProbability) {
      biggestUpset = {
        matchId: match.matchId,
        playedAt: match.playedAt,
        gameType: match.gameType,
        winnerId: winner.fact.playerId,
        winnerName: winner.player.displayName,
        expectedWinProbability: winnerProbability,
        opponentNames: participantStates
          .filter((_, index) => index !== winnerIndex)
          .map(({ player }) => player.displayName),
      };
    }

    const ratingUpdates = participantStates.map(({ fact }, index) =>
      RATING_K_FACTOR * ((fact.isWinner ? 1 : 0) - expectedProbabilities[index])
    );

    participantStates.forEach(({ fact, player }, index) => {
      const opponentRatings = participantStates
        .filter((_, opponentIndex) => opponentIndex !== index)
        .map(({ player: opponent }) => opponent.rating);
      const opponentAverage =
        opponentRatings.reduce((sum, value) => sum + value, 0) / opponentRatings.length;

      player.games += 1;
      player.expectedWins += expectedProbabilities[index];
      player.opponentRatingTotal += opponentAverage;
      player.opponentMatchCount += 1;
      player.outcomes.push(fact.isWinner);

      if (fact.isWinner) {
        player.wins += 1;
        player.qualityWinPoints += 1 - expectedProbabilities[index];
      }

      if (typeof fact.score === 'number' && Number.isFinite(fact.score)) {
        player.scores.push(fact.score);
      }

      player.rating += ratingUpdates[index];
      player.ratingHistory.push({
        matchId: match.matchId,
        playedAt: match.playedAt,
        rating: player.rating,
      });
    });

    matchesAnalyzed += 1;
  }

  const rankedPlayers: PlayerAdvancedStats[] = Array.from(players.values())
    .map((player) => {
      const recentOutcomes = player.outcomes.slice(-5);
      const comparisonIndex = Math.max(0, player.ratingHistory.length - 6);
      const comparisonRating = player.ratingHistory[comparisonIndex].rating;

      return {
        playerId: player.playerId,
        displayName: player.displayName,
        rank: 0,
        games: player.games,
        wins: player.wins,
        losses: player.games - player.wins,
        winPct: player.games > 0 ? (player.wins / player.games) * 100 : 0,
        rating: player.rating,
        ratingDelta: player.rating - STARTING_RATING,
        ratingDeltaLastFive: player.rating - comparisonRating,
        provisional: player.games < PROVISIONAL_MATCHES,
        expectedWins: player.expectedWins,
        winDelta: player.wins - player.expectedWins,
        strengthOfSchedule:
          player.opponentMatchCount > 0
            ? player.opponentRatingTotal / player.opponentMatchCount
            : STARTING_RATING,
        qualityWinPoints: player.qualityWinPoints,
        recentWins: recentOutcomes.filter(Boolean).length,
        recentGames: recentOutcomes.length,
        ratingHistory: player.ratingHistory,
        scoreDistribution: buildDistribution(player.scores),
      };
    })
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.displayName.localeCompare(b.displayName));

  rankedPlayers.forEach((player, index) => {
    player.rank = index + 1;
  });

  return {
    players: rankedPlayers,
    matchesAnalyzed,
    matchesIgnored,
    scoreLabel: detectScoreLabel(facts),
    biggestUpset,
  };
}
