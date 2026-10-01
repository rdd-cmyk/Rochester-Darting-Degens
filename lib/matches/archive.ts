import { supabase } from '@/lib/supabaseClient';
import { collectAllStatisticsRows } from '@/lib/stats/pagination';

export type ArchiveFilters = { player: string; game: string; night: string; from: string; to: string };
export const EMPTY_ARCHIVE_FILTERS: ArchiveFilters = { player: '', game: '', night: '', from: '', to: '' };
export const ARCHIVE_PAGE_SIZE = 10;

/** Filter the parent match without stripping opponents from match_players. */
export async function loadMatchArchive<T>(page: number, filters: ArchiveFilters) {
  let query = supabase.from('matches').select(`
    id,played_at,game_type,game_config,notes,board_type,venue,created_by,revision,night_id,
    league_nights(title,night_date),
    ${filters.player ? 'player_filter:match_players!inner(player_id),' : ''}
    match_players(id,match_id,player_id,score,points_scored,is_winner,
      profiles(display_name,first_name,include_first_name_in_display))
  `, { count: 'exact' });
  if (filters.player) query = query.eq('player_filter.player_id', filters.player);
  if (filters.game) query = query.eq('game_type', filters.game);
  if (filters.night === 'standalone') query = query.is('night_id', null);
  else if (filters.night) query = query.eq('night_id', filters.night);
  // Match the viewer-local dates used by the existing match date input.
  if (filters.from) query = query.gte('played_at', new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) {
    const next = new Date(`${filters.to}T00:00:00`);
    next.setDate(next.getDate() + 1);
    query = query.lt('played_at', next.toISOString());
  }
  const from = (page - 1) * ARCHIVE_PAGE_SIZE;
  const { data, error, count } = await query.order('played_at', { ascending: false }).range(from, from + ARCHIVE_PAGE_SIZE - 1);
  if (error) throw error;
  return { matches: (data ?? []) as T[], count: count ?? 0 };
}


export type ArchiveNight = { id: string; title: string; night_date: string };

/** Archive filters need every visible night, not the lobby's latest forty. */
export async function loadArchiveNights(): Promise<ArchiveNight[]> {
  return collectAllStatisticsRows<ArchiveNight>(async (from, to) => {
    const { data, error, count } = await supabase.from('league_nights')
      .select('id,title,night_date', { count: 'exact' })
      .order('night_date', { ascending: false }).order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as ArchiveNight[], totalCount: count };
  });
}
