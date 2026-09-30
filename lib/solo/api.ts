import { supabase } from "@/lib/supabaseClient";
import { collectAllStatisticsRows } from "@/lib/stats/pagination";
import type {
  SoloGame,
  SoloOperation,
  SoloReceipt,
  SoloCohort,
  SoloNightItem,
} from "./types";
import type { LeagueNight } from "@/lib/league-night/types";
export async function loadSoloNights(): Promise<LeagueNight[]> {
  return collectAllStatisticsRows(async (from, to) => {
    const { data, error, count } = await supabase
      .from("league_nights")
      .select("*", { count: "exact" })
      .order("id")
      .range(from, to);
    if (error) throw error;
    return { rows: data ?? [], totalCount: count };
  });
}
export async function loadSoloGames(owner: string): Promise<SoloGame[]> {
  return collectAllStatisticsRows(async (from, to) => {
    const { data, error, count } = await supabase
      .from("solo_games")
      .select("*", { count: "exact" })
      .eq("owner_id", owner)
      .order("id")
      .range(from, to);
    if (error) throw error;
    return { rows: data ?? [], totalCount: count };
  });
}
export async function writeSolo(
  operation: SoloOperation,
): Promise<SoloReceipt> {
  const { data, error } = await supabase.rpc("rdd_solo_write", {
    p_operation_id: operation.operationId,
    p_payload: operation.payload,
  });
  if (error) throw error;
  return data;
}
export async function loadSoloProfile(
  owner: string,
): Promise<SoloCohort[] | null> {
  const { data, error } = await supabase.rpc("rdd_solo_profile", {
    p_owner: owner,
  });
  if (error) throw error;
  return data;
}
export async function loadSoloNight(night: string): Promise<SoloNightItem[]> {
  const { data, error } = await supabase.rpc("rdd_solo_night", {
    p_night: night,
  });
  if (error) throw error;
  return data ?? [];
}
export async function soloVisibility() {
  const { data, error } = await supabase
    .from("solo_preferences")
    .select("share_summary")
    .maybeSingle();
  if (error) throw error;
  return data?.share_summary ?? true;
}
export async function setSoloVisibility(shared: boolean) {
  const { error } = await supabase.rpc("rdd_set_solo_visibility", {
    p_shared: shared,
  });
  if (error) throw error;
}
export function soloError(cause: unknown) {
  const e = cause as { message?: string; code?: string };
  return ["PGRST202", "42P01"].includes(e?.code ?? "")
    ? "Solo Play is not available on this database yet. Your draft is kept on this device."
    : (e?.message ?? "Could not reach Solo Play. Your entry is preserved.");
}
export function definiteRejection(cause: unknown) {
  return [
    "22023",
    "42501",
    "40001",
    "PT409",
    "23514",
    "23503",
    "22P02",
    "22007",
    "22008",
    "22003",
    "23502",
  ].includes((cause as { code?: string })?.code ?? "");
}
