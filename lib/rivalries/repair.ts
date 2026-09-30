import type { NightMatch } from "@/lib/league-night/types";
import type { Challenge } from "./types";

// A convenience filter; the write RPC remains authoritative and checks revisions.
export function repairCandidates(matches: NightMatch[], challenge: Challenge, challenges: Challenge[]) {
  const linked = new Set(challenges.flatMap((c) => c.games.map((g) => g.id)));
  return matches.filter((m) => {
    const config = m.game_config;
    const players = m.match_players ?? [];
    return !linked.has(m.id) && !!challenge.accepted_at &&
      m.night_id === challenge.night_id && m.game_type === challenge.game &&
      m.board_type === challenge.board &&
      Date.parse(m.played_at) >= Date.parse(challenge.accepted_at) &&
      config?.preset === challenge.preset && config.format === "individual" &&
      config.context === "competitive" && config.status === "completed" &&
      config.handicap === false && players.length === 2 &&
      new Set(players.map((p) => p.player_id)).size === 2 &&
      players.every((p) => [challenge.sender, challenge.recipient].includes(p.player_id) && p.is_winner !== null) &&
      players.filter((p) => p.is_winner === true).length === 1;
  }).sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at) || b.id - a.id);
}
