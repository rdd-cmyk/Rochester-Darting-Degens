import { supabase } from "@/lib/supabaseClient";
import type { MatchWrite, SaveResult } from "./types";

export const GAME_TYPES = ["501", "301", "Cricket", "Other"] as const;
export function parseScore(
  raw: string,
  game: string | null,
  mode: "3da" | "ppd" = "3da",
): number | null {
  if (!raw.trim()) return null;
  let score = Number(raw);
  if ((game === "501" || game === "301") && mode === "ppd") score *= 3;
  const cap =
    game === "501"
      ? 167
      : game === "301"
        ? 150.5
        : game === "Cricket"
          ? 9
          : 9999;
  if (
    !Number.isFinite(score) ||
    score <= 0 ||
    score > cap ||
    (game === "Other" && !Number.isInteger(score))
  ) {
    throw new Error(
      `${game ?? "This game"} scores must be greater than zero and at most ${cap}${game === "Other" ? ", using whole numbers" : ""}. Leave an unrecorded score blank.`,
    );
  }
  return Number(score.toFixed(6));
}
export function parseCricketPoints(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 9999)
    throw new Error(
      "Cricket points must be a positive whole number up to 9999, or left blank.",
    );
  return value;
}
export function validateMatchWrite(
  input: MatchWrite,
  now = Date.now(),
): MatchWrite {
  if (input.players.length < 2 || input.players.length > 10)
    throw new Error("Choose two to ten players.");
  if (
    input.players.some((p) => !p.player_id) ||
    new Set(input.players.map((p) => p.player_id)).size !== input.players.length
  )
    throw new Error("Choose a different player for each place.");
  if (input.players.filter((p) => p.is_winner).length !== 1)
    throw new Error("Choose exactly one winner.");
  const played = Date.parse(input.played_at);
  if (!Number.isFinite(played) || played > now + 5 * 60_000)
    throw new Error("Choose a valid match time that is not in the future.");
  if ((input.notes?.length ?? 0) >= 100 || (input.venue?.length ?? 0) >= 50)
    throw new Error(
      "Use at most 99 characters for notes and 49 for the venue.",
    );
  for (const player of input.players) {
    if (player.score !== null)
      parseScore(String(player.score), input.game_type);
    if (player.points_scored !== null) {
      if (input.game_type !== "Cricket")
        throw new Error("Points scored are only supported for Cricket.");
      parseCricketPoints(String(player.points_scored));
    }
  }
  return input;
}
export async function saveMatch(
  operationId: string,
  payload: MatchWrite,
  userId: string,
): Promise<SaveResult> {
  const { data, error } = await supabase.rpc("rdd_save_match", {
    p_operation_id: operationId,
    // The database checks this against the actual JWT, closing the gap between
    // a browser auth event and an already-dispatched request in another tab.
    p_payload: { ...payload, submitted_by: userId },
  });
  if (error) throw error;
  if (data?.status !== "saved" && data?.status !== "possible_duplicate")
    throw new Error(
      "The save response was interrupted. Check this save before starting another.",
    );
  return data as SaveResult;
}
export function saveErrorMessage(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  if (
    /schema cache|rdd_save_match|league_nights.*does not exist/i.test(message)
  )
    return "League Night saving is not available on this site yet. Your entry is still here.";
  return message;
}
export function isDefiniteSaveRejection(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  return [
    "22023",
    "22003",
    "22P02",
    "22007",
    "22008",
    "23503",
    "23514",
    "40001",
    "42501",
    "PGRST202",
  ].includes(code);
}
