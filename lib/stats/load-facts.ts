import { supabase } from '@/lib/supabaseClient';
import { collectAllStatisticsRows } from './pagination';
import { formatPlayerName } from '@/lib/playerName';
import type { GameConfig } from '@/lib/games/catalog';
import type { MatchFact } from './types';

type Profile = { display_name: string | null; first_name: string | null; include_first_name_in_display: boolean | null };
type Match = { played_at: string; game_type: string | null; game_config?: GameConfig | null; board_type: string | null; venue: string | null };
type Row = { id: number; match_id: number | string; player_id: string; is_winner: boolean | null; score: number | null; profiles: Profile | Profile[] | null; matches: Match | Match[] | null };
const first = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value;

/** Same complete, ordered source for the landing snapshot and detailed ratings. */
export async function loadStatisticsFacts(): Promise<MatchFact[]> {
  const rows = await collectAllStatisticsRows<Row>(async (from, to) => {
    const { data, error, count } = await supabase.from('match_players').select(
      'id,match_id,player_id,is_winner,score,profiles(id,display_name,first_name,include_first_name_in_display),matches!inner(played_at,game_type,game_config,board_type,venue)',
      { count: 'exact' },
    ).order('match_id', { ascending: true }).order('id', { ascending: true }).range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as Row[], totalCount: count };
  });
  return rows.flatMap(row => {
    const match = first(row.matches), profile = first(row.profiles);
    if (!match || !row.match_id || !row.player_id) return [];
    return [{
      matchId: String(row.match_id), playerId: row.player_id,
      displayName: profile ? formatPlayerName(profile.display_name, profile.first_name, profile.include_first_name_in_display) : 'Unknown player',
      playedAt: match.played_at, gameType: match.game_type, gameConfig: match.game_config,
      boardType: match.board_type, venue: match.venue, isWinner: row.is_winner === true, score: row.score,
    }];
  });
}
