import { supabase } from "@/lib/supabaseClient";
import { collectAllStatisticsRows } from "@/lib/stats/pagination";
import type { Attendee, LeagueNight, NightMatch, PlayerProfile } from "./types";

export const MATCH_SELECT =
  "id,played_at,game_type,board_type,venue,notes,created_by,night_id,revision,match_players(id,player_id,score,points_scored,is_winner,profiles(display_name,first_name,include_first_name_in_display))";
export async function loadProfiles(): Promise<PlayerProfile[]> {
  return collectAllStatisticsRows<PlayerProfile>(async (from, to) => {
    const { data, error, count } = await supabase
      .from("profiles")
      .select("id,display_name,first_name,include_first_name_in_display", {
        count: "exact",
      })
      .order("id")
      .range(from, to);
    if (error) throw error;
    return { rows: data ?? [], totalCount: count };
  });
}
export async function loadNights(): Promise<LeagueNight[]> {
  const { data, error } = await supabase
    .from("league_nights")
    .select("*")
    .order("night_date", { ascending: false })
    .order("id")
    .limit(40);
  if (error) throw error;
  return data ?? [];
}
export async function loadNight(id: string): Promise<LeagueNight> {
  const { data, error } = await supabase
    .from("league_nights")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
export async function loadAttendees(id: string): Promise<Attendee[]> {
  return collectAllStatisticsRows<Attendee>(async (from, to) => {
    const { data, error, count } = await supabase
      .from("league_night_attendees")
      .select("*", { count: "exact" })
      .eq("night_id", id)
      .order("player_id")
      .range(from, to);
    if (error) throw error;
    return { rows: data ?? [], totalCount: count };
  });
}
export async function loadMatches(nightId?: string): Promise<NightMatch[]> {
  return collectAllStatisticsRows<NightMatch>(async (from, to) => {
    let query = supabase
      .from("matches")
      .select(MATCH_SELECT, { count: "exact" });
    if (nightId) query = query.eq("night_id", nightId);
    const { data, error, count } = await query.order("id").range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as unknown as NightMatch[], totalCount: count };
  });
}
export async function setAttendance(
  nightId: string,
  playerId: string,
  present: boolean,
  revision: number,
): Promise<Attendee> {
  const { data, error } = await supabase.rpc("rdd_set_attendance", {
    p_night_id: nightId,
    p_player_id: playerId,
    p_present: present,
    p_revision: revision,
  });
  if (error) throw error;
  return data;
}
