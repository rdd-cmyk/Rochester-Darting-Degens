import type { NightMatch } from '@/lib/league-night/types';
import { buildLeagueAdvancedStats } from '@/lib/stats/engine';

/** Replay the complete room history, not the selected pair/game/board subset. */
export function buildRivalryPowerRatings(matches: NightMatch[]) {
  const facts = matches.flatMap(match => (match.match_players ?? []).flatMap(player =>
    !player.player_id ? [] : [{
      matchId: String(match.id),
      playerId: player.player_id,
      displayName: player.player_id,
      playedAt: match.played_at,
      gameType: match.game_type,
      gameConfig: match.game_config,
      boardType: match.board_type,
      venue: match.venue,
      isWinner: player.is_winner === true,
      score: player.score,
    }],
  ));
  return new Map(buildLeagueAdvancedStats(facts).players.map(player => [
    player.playerId,
    { rating: player.rating, provisional: player.provisional },
  ]));
}
