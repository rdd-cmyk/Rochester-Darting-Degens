import type { GameConfig } from '@/lib/games/catalog';
export type MatchFact = {
  gameConfig?: GameConfig | null;
  matchId: string;
  playerId: string;
  displayName: string;
  playedAt: string;
  gameType: string | null;
  boardType: string | null;
  venue: string | null;
  isWinner: boolean;
  score: number | null;
};

export type RatingHistoryPoint = {
  change?: number;
  expectedWin?: number;
  format?: string;
  opponents?: string[];
  matchId: string;
  playedAt: string;
  rating: number;
};

export type ScoreDistribution = {
  games: number;
  average: number;
  median: number;
  lowerQuartile: number;
  upperQuartile: number;
  best: number;
  medianAbsoluteDeviation: number;
  normalizedDeviation: number;
};

export type PlayerAdvancedStats = {
  evidenceGames?: number;
  formatGames?: Record<string, number>;
  playerId: string;
  displayName: string;
  rank: number;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  rating: number;
  ratingDelta: number;
  ratingDeltaLastFive: number;
  provisional: boolean;
  expectedWins: number;
  winDelta: number;
  strengthOfSchedule: number;
  qualityWinPoints: number;
  recentWins: number;
  recentGames: number;
  ratingHistory: RatingHistoryPoint[];
  scoreDistribution: ScoreDistribution | null;
};

export type UpsetStory = {
  winnerIds?: string[];
  matchId: string;
  playedAt: string;
  gameType: string | null;
  winnerId: string;
  winnerName: string;
  expectedWinProbability: number;
  opponentNames: string[];
};

export type LeagueAdvancedStats = {
  players: PlayerAdvancedStats[];
  matchesAnalyzed: number;
  matchesIgnored: number;
  scoreLabel: '3DA' | 'MPR' | 'Score' | 'Points' | 'Darts to finish' | null;
  upsets: UpsetStory[];
  biggestUpset: UpsetStory | null;
};
