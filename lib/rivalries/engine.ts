import type { NightMatch } from "@/lib/league-night/types";
import { comparisonKey, ratingExclusion } from "@/lib/games/catalog";
export type Meeting = { match: NightMatch; winner: string };
export type Rivalry = {
  opponent: string;
  wins: [number, number];
  meetings: Meeting[];
  headline: string;
  story: string;
};
export function eligibleSingles(m: NightMatch): boolean {
  const p = m.match_players ?? [];
  return (
    Number.isFinite(Date.parse(m.played_at)) &&
    p.length === 2 &&
    p.every((row) => !!row.player_id && typeof row.is_winner === "boolean") &&
    new Set(p.map((row) => row.player_id)).size === 2 &&
    p.filter((row) => row.is_winner).length === 1 &&
    (!m.game_config ||
      (m.game_config.format === "individual" &&
        !ratingExclusion(m.game_config)))
  );
}
export function buildRivalry(
  matches: NightMatch[],
  player: string,
  opponent: string,
  game?: string,
  board?: string,
): Rivalry {
  const meetings = matches
    .filter(
      (m) =>
        eligibleSingles(m) &&
        m.match_players!.some((p) => p.player_id === player) &&
        m.match_players!.some((p) => p.player_id === opponent) &&
        (!game || m.game_type === game) &&
        (!board || m.board_type === board),
    )
    .sort(
      (a, b) =>
        Date.parse(a.played_at) - Date.parse(b.played_at) || a.id - b.id,
    )
    .map((match) => ({
      match,
      winner: match.match_players!.find((p) => p.is_winner)!.player_id,
    }));
  const wins: [number, number] = [
    meetings.filter((m) => m.winner === player).length,
    meetings.filter((m) => m.winner === opponent).length,
  ];
  let headline = "A NEW CHAPTER.";
  let story = meetings.length
    ? `${meetings.length} recorded singles ${meetings.length === 1 ? "meeting" : "meetings"}. The next game writes the next chapter.`
    : "Every great rivalry starts with a first game.";
  const before = meetings.slice(0, -2);
  const wasBehind =
    before.filter((m) => m.winner === player).length <
    before.filter((m) => m.winner === opponent).length;
  if (meetings.length >= 5 && Math.abs(wins[0] - wins[1]) <= 1) {
    headline = "UNFINISHED BUSINESS.";
    story =
      wins[0] === wins[1]
        ? `Deadlocked after ${meetings.length} recorded singles meetings.`
        : `Only one win separates you after ${meetings.length} recorded singles meetings.`;
  } else if (
    meetings.length >= 3 &&
    wasBehind &&
    meetings.slice(-2).every((m) => m.winner === player)
  ) {
    headline = "THE TIDE IS TURNING.";
    story = "You trailed the series. You took the last two recorded meetings.";
  } else if (meetings.length >= 3) {
    headline = "FAMILIAR FOES.";
    story = `${meetings.length} recorded singles meetings. You know each other’s game.`;
  }
  return { opponent, wins, meetings, headline, story };
}
export function discoverRivalries(
  matches: NightMatch[],
  player: string,
  opponents: string[],
) {
  return opponents
    .filter((id) => id !== player)
    .map((id) => buildRivalry(matches, player, id))
    .sort(
      (a, b) =>
        Number(b.meetings.length >= 5 && Math.abs(b.wins[0] - b.wins[1]) <= 1) -
          Number(
            a.meetings.length >= 5 && Math.abs(a.wins[0] - a.wins[1]) <= 1,
          ) ||
        b.meetings.length - a.meetings.length ||
        a.opponent.localeCompare(b.opponent),
    );
}
/** Scores stay within the exact game/board/rules cohort; nulls never become zero. */
export function scoreCohorts(rivalry: Rivalry, player: string) {
  const groups = new Map<string, { label: string; scores: number[] }>();
  for (const { match: m } of rivalry.meetings) {
    const key = comparisonKey(m.game_type, m.board_type, m.game_config);
    const score = m.match_players!.find((p) => p.player_id === player)?.score;
    if (!groups.has(key))
      groups.set(key, {
        label: `${m.game_type ?? "Unknown game"} · ${m.board_type ?? "Unknown board"} · ${m.game_config?.preset ?? "unspecified"}`,
        scores: [],
      });
    if (score != null && Number.isFinite(score))
      groups.get(key)!.scores.push(score);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    average: g.scores.length
      ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length
      : null,
  }));
}
