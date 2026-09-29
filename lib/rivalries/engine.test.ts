import { describe, it, expect } from "vitest";
import {
  buildRivalry,
  eligibleSingles,
  scoreCohorts,
  discoverRivalries,
} from "./engine";
import { defaultConfig } from "@/lib/games/catalog";
import type { NightMatch } from "@/lib/league-night/types";
const match = (
  id: number,
  winner = "a",
  extra: Partial<NightMatch> = {},
): NightMatch => ({
  id,
  played_at: `2026-09-${String(id).padStart(2, "0")}T20:00:00Z`,
  game_type: "501",
  board_type: "Steel Tip",
  game_config: null,
  venue: null,
  notes: null,
  created_by: "a",
  night_id: null,
  revision: 1,
  match_players: ["a", "b"].map((player_id, i) => ({
    id: id * 2 + i,
    player_id,
    score: null,
    points_scored: null,
    is_winner: player_id === winner,
  })),
  ...extra,
});
describe("recorded rivalry evidence", () => {
  it("keeps eligible legacy singles without inventing rules or scores", () => {
    const r = buildRivalry([match(1)], "a", "b");
    expect(r.wins).toEqual([1, 0]);
    expect(scoreCohorts(r, "a")[0].average).toBeNull();
    expect(scoreCohorts(r, "a")[0].label).toContain("unspecified");
  });
  it.each([
    "practice",
    "abandoned",
    "handicap",
    "team",
    "multiple winners",
    "duplicate",
    "unknown winner",
    "three players",
    "invalid time",
  ])("excludes %s", (kind) => {
    const m = match(1);
    const config = defaultConfig();
    if (kind === "practice") config.context = "practice";
    if (kind === "abandoned") config.status = "abandoned";
    if (kind === "handicap") config.handicap = true;
    if (kind === "team") config.format = "2v2";
    m.game_config = config;
    if (kind === "multiple winners") m.match_players![1].is_winner = true;
    if (kind === "duplicate") m.match_players![1].player_id = "a";
    if (kind === "unknown winner") m.match_players![1].is_winner = null;
    if (kind === "three players")
      m.match_players!.push({ ...m.match_players![1], player_id: "c" });
    if (kind === "invalid time") m.played_at = "bad";
    expect(eligibleSingles(m)).toBe(false);
  });
  it("requires evidence for close rivalry copy", () => {
    expect(buildRivalry([match(1), match(2, "b")], "a", "b").headline).toBe(
      "A NEW CHAPTER.",
    );
    const r = buildRivalry(
      [1, 2, 3, 4, 5, 6].map((id) => match(id, id % 2 ? "a" : "b")),
      "a",
      "b",
    );
    expect(r.headline).toBe("UNFINISHED BUSINESS.");
    expect(r.wins).toEqual([3, 3]);
  });
  it("uses stable chronological evidence for turning tide", () => {
    const rows = [
      match(5),
      match(2, "b"),
      match(1, "b"),
      match(4, 'b'),
      match(3, "b"),
      match(6),
    ];
    expect(buildRivalry(rows, "a", "b").headline).toBe("THE TIDE IS TURNING.");
  });
  it("keeps score cohorts separate across board and rules", () => {
    const rows = [
      match(1),
      match(2, "b", { board_type: "Soft Tip" }),
      match(3, "a", {
        game_config: { ...defaultConfig(), preset: "501-double-v1" },
      }),
    ];
    rows.forEach((m, i) => (m.match_players![0].score = (i + 1) * 30));
    const cohorts = scoreCohorts(buildRivalry(rows, "a", "b"), "a");
    expect(cohorts.map((c) => c.average)).toEqual([30, 60, 90]);
  });
  it("filters scope without turning unknown boards into steel", () => {
    const rows = [match(1), match(2, "b", { board_type: null })];
    expect(
      buildRivalry(rows, "a", "b", undefined, "Steel Tip").meetings,
    ).toHaveLength(1);
    expect(buildRivalry(rows, "a", "b").meetings).toHaveLength(2);
  });
  it("preserves input order and excludes self from discovery", () => {
    const rows = [match(2), match(1)];
    discoverRivalries(rows, "a", ["a", "b", "c"]);
    expect(rows[0].id).toBe(2);
    expect(
      discoverRivalries(rows, "a", ["a", "b", "c"]).map((r) => r.opponent),
    ).toEqual(["b", "c"]);
  });
});
