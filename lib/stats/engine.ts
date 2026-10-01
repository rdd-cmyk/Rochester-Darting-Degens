import { comparisonKey, gameDefinition, ratingExclusion, validateConfig } from '@/lib/games/catalog';
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
export const RATING_POLICY_VERSION = 'team-split-v1';

type PlayerAccumulator = {
  playerId: string;
  displayName: string;
  games: number;
  evidenceGames: number;
  formatGames: Record<string, number>;
  wins: number;
  expectedWins: number;
  schedule: Array<Array<{ playerId: string; rating: number; provisional: boolean }>>;
  graduationRating?: number;
  qualityWinPoints: number;
  outcomes: boolean[];
  scores: number[];
  rating: number;
  ratingHistory: RatingHistoryPoint[];
};

type MatchGroup = {
  inconsistent?: boolean;
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

function buildDistribution(values: number[], lowerBetter = false): ScoreDistribution | null {
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
    best: lowerBetter ? sorted[0] : sorted[sorted.length - 1],
    medianAbsoluteDeviation,
    normalizedDeviation: median > 0 ? medianAbsoluteDeviation / median : Number.POSITIVE_INFINITY,
  };
}

function detectScoreLabel(
  facts: MatchFact[],
  includeOtherScores: boolean
): LeagueAdvancedStats['scoreLabel'] {
  // Missing or blank disciplines cannot be assumed compatible with known scores.
  const gameTypes = new Set(facts.map((fact) => fact.gameType));

  if (gameTypes.size !== 1) return null;
  const [gameType] = gameTypes;
  if (new Set(facts.map(f => comparisonKey(f.gameType, f.boardType, f.gameConfig))).size !== 1) return null;
  const definition = gameDefinition(gameType);
  if (definition && gameType !== 'Other') return definition.unit;
  return gameType === 'Other' && includeOtherScores ? 'Score' : null;
}

function groupMatches(facts: MatchFact[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();

  for (const fact of facts) {
    if (!fact.matchId || !fact.playerId) continue;

    const existing = groups.get(fact.matchId);
    if (existing) {
      const first = existing.participants[0];
      const duplicate = existing.participants.find(participant => participant.playerId === fact.playerId);
      if (fact.playedAt !== first.playedAt || fact.gameType !== first.gameType ||
          fact.boardType !== first.boardType || JSON.stringify(fact.gameConfig) !== JSON.stringify(first.gameConfig) ||
          (duplicate && (duplicate.isWinner !== fact.isWinner || duplicate.score !== fact.score))) {
        existing.inconsistent = true;
      }
      if (!duplicate) {
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

  for (const group of groups.values()) group.participants.sort((a,b) => a.playerId.localeCompare(b.playerId));
  return Array.from(groups.values()).sort((a, b) => {
    const dateDifference = numericDate(a.playedAt) - numericDate(b.playedAt);
    return (
      dateDifference ||
      a.matchId.localeCompare(b.matchId, undefined, { numeric: true })
    );
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
    evidenceGames: 0,
    formatGames: {},
    wins: 0,
    expectedWins: 0,
    schedule: [],
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

export function buildLeagueAdvancedStats(
  facts: MatchFact[],
  options: { includeOtherScores?: boolean } = {}
): LeagueAdvancedStats {
  const matches = groupMatches(facts);
  const analyzedFacts: MatchFact[] = [];
  const players = new Map<string, PlayerAccumulator>();
  let matchesAnalyzed = 0;
  let matchesIgnored = 0;
  const upsets: UpsetStory[] = [];

  for (const match of matches) {
    const config = match.participants[0].gameConfig;
    const teamSize = config?.format === '2v2' ? 2 : config?.format === '3v3' ? 3 : 1;
    let validConfig = true;
    if (config) {
      try {
        if (match.participants.some(p => JSON.stringify(p.gameConfig) !== JSON.stringify(config))) throw new Error('Mixed match configuration');
        validateConfig(match.gameType, config, match.participants.map(p => ({ player_id: p.playerId, is_winner: p.isWinner, score: p.score, points_scored: null })));
      } catch { validConfig = false; }
    }
    const winners = match.participants.filter((participant) => participant.isWinner);
    if (match.inconsistent || !Number.isFinite(Date.parse(match.playedAt)) || match.participants.length < 2 || winners.length !== teamSize || !validConfig || ratingExclusion(config)) {
      matchesIgnored += 1;
      continue;
    }

    const participantStates = match.participants.map((participant) => ({
      fact: participant,
      player: ensurePlayer(players, participant, match.playedAt),
    }));
    // Snapshot before any player is updated: every opponent uses pre-match ratings.
    const preMatchRatings = participantStates.map(({ player }) => player.rating);
    const preMatchProvisional = participantStates.map(({ player }) =>
      player.evidenceGames + 1e-9 < PROVISIONAL_MATCHES);
    const ratingWeights = preMatchRatings.map(rating => 10 ** (rating / 400));
    const totalRatingWeight = ratingWeights.reduce((sum, value) => sum + value, 0);
    let expectedProbabilities = ratingWeights.map((value) => value / totalRatingWeight);
    if (teamSize > 1 && config) {
      const average = (side: string) => participantStates.reduce((total, p, i) => total + (config.sides[p.fact.playerId] === side ? preMatchRatings[i] : 0), 0) / teamSize;
      const expectedA = 1 / (1 + 10 ** ((average('B') - average('A')) / 400));
      expectedProbabilities = participantStates.map(p => config.sides[p.fact.playerId] === 'A' ? expectedA : 1 - expectedA);
    }
    analyzedFacts.push(...match.participants);
    const winnerIndex = participantStates.findIndex(({ fact }) => fact.isWinner);
    const winnerProbability = expectedProbabilities[winnerIndex];
    const winner = participantStates[winnerIndex];

    upsets.push({
      matchId: match.matchId,
      playedAt: match.playedAt,
      gameType: match.gameType,
      winnerId: winner.fact.playerId,
      winnerName: winners.map(p => p.displayName).join(' + '),
      winnerIds: winners.map(p => p.playerId),
      expectedWinProbability: winnerProbability,
      opponentNames: participantStates
        .filter(({ fact }) => !fact.isWinner)
        .map(({ player }) => player.displayName),
    });

    const ratingUpdates = participantStates.map(({ fact }, index) =>
      RATING_K_FACTOR * ((fact.isWinner ? 1 : 0) - expectedProbabilities[index]) / teamSize
    );

    participantStates.forEach(({ fact, player }, index) => {
      player.schedule.push(participantStates.flatMap(({ fact: opponent }, opponentIndex) => {
        const opposing = teamSize > 1 && config
          ? config.sides[opponent.playerId] !== config.sides[fact.playerId]
          : opponentIndex !== index;
        return opposing ? [{ playerId: opponent.playerId, rating: preMatchRatings[opponentIndex],
          provisional: preMatchProvisional[opponentIndex] }] : [];
      }));

      player.games += 1;
      player.evidenceGames += 1 / teamSize;
      const format = teamSize > 1 ? config!.format : match.participants.length > 2 ? 'Free-for-all' : 'Singles';
      player.formatGames[format] = (player.formatGames[format] ?? 0) + 1;
      player.expectedWins += expectedProbabilities[index];
      player.outcomes.push(fact.isWinner);

      if (fact.isWinner) {
        player.wins += 1;
        player.qualityWinPoints += 1 - expectedProbabilities[index];
      }

      if (typeof fact.score === 'number' && Number.isFinite(fact.score)) {
        player.scores.push(fact.score);
      }

      player.rating += ratingUpdates[index];
      // Schedule alone uses hindsight for provisional appearances, including graduation.
      if (player.graduationRating === undefined && player.evidenceGames + 1e-9 >= PROVISIONAL_MATCHES) {
        player.graduationRating = player.rating;
      }
      player.ratingHistory.push({
        matchId: match.matchId,
        playedAt: match.playedAt,
        rating: player.rating,
        change: ratingUpdates[index],
        expectedWin: expectedProbabilities[index],
        format,
        opponents: participantStates.filter(({ fact: other }) => teamSize > 1 && config ? config.sides[other.playerId] !== config.sides[fact.playerId] : other.playerId !== fact.playerId).map(p => p.player.displayName),
      });
    });

    matchesAnalyzed += 1;
  }

  const scoreLabel = detectScoreLabel(analyzedFacts, options.includeOtherScores ?? false);
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
        evidenceGames: player.evidenceGames,
        formatGames: player.formatGames,
        wins: player.wins,
        losses: player.games - player.wins,
        winPct: player.games > 0 ? (player.wins / player.games) * 100 : 0,
        rating: player.rating,
        ratingDelta: player.rating - STARTING_RATING,
        ratingDeltaLastFive: player.rating - comparisonRating,
        provisional: player.evidenceGames + 1e-9 < PROVISIONAL_MATCHES,
        expectedWins: player.expectedWins,
        winDelta: player.wins - player.expectedWins,
        strengthOfSchedule:
          player.schedule.length > 0
            ? player.schedule.reduce((total, opponents) => total + opponents.reduce((sum, opponent) =>
              sum + (opponent.provisional
                ? players.get(opponent.playerId)?.graduationRating ?? opponent.rating
                : opponent.rating), 0) / opponents.length, 0) / player.schedule.length
            : STARTING_RATING,
        qualityWinPoints: player.qualityWinPoints,
        recentWins: recentOutcomes.filter(Boolean).length,
        recentGames: recentOutcomes.length,
        ratingHistory: player.ratingHistory,
        scoreDistribution: scoreLabel ? buildDistribution(player.scores, gameDefinition(analyzedFacts[0]?.gameType)?.lowerBetter) : null,
      };
    })
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.displayName.localeCompare(b.displayName));

  rankedPlayers.forEach((player, index) => {
    player.rank = index + 1;
  });

  upsets.sort(
    (a, b) =>
      a.expectedWinProbability - b.expectedWinProbability ||
      numericDate(a.playedAt) - numericDate(b.playedAt) ||
      a.matchId.localeCompare(b.matchId, undefined, { numeric: true })
  );

  return {
    players: rankedPlayers,
    matchesAnalyzed,
    matchesIgnored,
    scoreLabel,
    upsets,
    biggestUpset: upsets[0] ?? null,
  };
}
