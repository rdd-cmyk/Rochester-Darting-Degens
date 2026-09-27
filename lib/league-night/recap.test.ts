import { describe, expect, it } from "vitest";
import { buildNightRecap, scoreSummary } from "./recap";
import type { NightMatch } from "./types";
function match(
  id: number,
  winner = "a",
  night: string | null = "night",
  overrides: Partial<NightMatch> = {},
): NightMatch {
  return {
    id,
    played_at: new Date(Date.UTC(2026, 8, 1, 0, id)).toISOString(),
    game_type: "501",
    board_type: "Soft Tip",
    venue: null,
    notes: null,
    created_by: "recorder",
    night_id: night,
    revision: 1,
    match_players: ["a", "b"].map((player_id, index) => ({
      id: id * 10 + index,
      player_id,
      score: player_id === "a" ? 60 : 50,
      points_scored: null,
      is_winner: player_id === winner,
      profiles: {
        display_name: player_id.toUpperCase(),
        first_name: null,
        include_first_name_in_display: false,
      },
    })),
    ...overrides,
  };
}
describe("night recap and earned awards", () => {
  it("labels saved scores without inventing missing values or units", () => {
    expect(scoreSummary(match(1))).toContain("60 3DA");
    const cricket = match(2, "a", "night", { game_type: "Cricket" });
    cricket.match_players![0].score = null;
    cricket.match_players![0].points_scored = 100;
    expect(scoreSummary(cricket)).toContain("not recorded, 100 points");
    expect(scoreSummary(match(3, "a", "night", { game_type: null }))).toContain(
      "60 score",
    );
  });
  it("includes unresolved appearances in tied-timestamp ambiguity", () => {
    const unresolved = match(1, "nobody");
    const first = match(2);
    unresolved.played_at = first.played_at;
    expect(
      buildNightRecap(
        [unresolved, first, match(3), match(4)],
        "night",
      ).awards.some((a) => a.kind === "streak"),
    ).toBe(false);
  });
  it("counts Power Surge history before the shared night opens, not the first game in each format", () => {
    const cricket = (id: number, winner = "a", night: string | null = null) =>
      match(id, winner, night, { game_type: "Cricket" });
    const prior = Array.from({ length: 9 }, (_, i) => cricket(i + 1));
    const result = buildNightRecap(
      [
        ...prior,
        match(10),
        cricket(11),
        cricket(12, "b", "night"),
        cricket(13, "b", "night"),
        cricket(14, "b", "night"),
      ],
      "night",
    );
    expect(result.awards.some((a) => a.kind === "surge")).toBe(false);
    expect(
      result.ratingMoves.find(
        (m) => m.scope === "Cricket · Soft Tip" && m.playerId === "b",
      )?.provisional,
    ).toBe(true);
  });
  it("keeps shared streak winners and multiple personal milestones instead of arbitrary tie-breaking", () => {
    const group = (id: number) => {
      const m = match(id, "a");
      m.match_players = m.match_players!.map((p) => ({
        ...p,
        player_id: p.player_id === "a" ? "c" : "d",
      }));
      return m;
    };
    const awards = buildNightRecap(
      [match(1), match(3), match(5), group(2), group(4), group(6)],
      "night",
    ).awards;
    expect(
      awards
        .filter((a) => a.kind === "streak")
        .map((a) => a.playerId)
        .sort(),
    ).toEqual(["a", "c"]);
  });
  it("does not erase unresolved appearances when calculating streaks", () => {
    const unresolved = match(2, "nobody");
    expect(
      buildNightRecap(
        [match(1), unresolved, match(3), match(4)],
        "night",
      ).awards.some((a) => a.kind === "streak"),
    ).toBe(false);
    expect(
      buildNightRecap(
        [match(1), unresolved, match(3), match(4), match(5)],
        "night",
      ).awards.find((a) => a.kind === "streak")?.matchIds,
    ).toEqual([3, 4, 5]);
  });
  it("withholds history claims affected by incomplete earlier results", () => {
    const earlier = match(1, "a", null);
    earlier.match_players = [earlier.match_players![0]];
    earlier.match_players[0].score = 100;
    const recap = buildNightRecap(
      [earlier, match(2, "a", null), match(3)],
      "night",
    );
    expect(
      recap.awards.some(
        (a) => ["first", "best"].includes(a.kind) && a.playerId === "a",
      ),
    ).toBe(false);
    expect(recap.incompleteHistory).toBe(1);
  });
  it("withholds competitive awards when incomplete history changes rating confidence", () => {
    const rows = Array.from({ length: 12 }, (_, i) => match(i + 1, "a", null));
    const unknown = match(13, "nobody", null);
    const result = buildNightRecap(
      [...rows, unknown, match(14, "b"), match(15, "b"), match(16, "b")],
      "night",
    );
    expect(result.awards.some((a) => ["surge", "upset"].includes(a.kind))).toBe(
      false,
    );
    expect(result.ratingMoves.length).toBeGreaterThan(0);
  });
  it("uses explicit night membership across recorders and excludes invalid results", () => {
    const result = buildNightRecap(
      [
        match(1),
        match(2, "b", "other"),
        match(3, "b", "night", { created_by: "other" }),
        match(4, "nobody"),
      ],
      "night",
    );
    expect(result.matches.map((m) => m.id)).toEqual([1, 3]);
    expect(result.standings.map((p) => [p.games, p.wins])).toEqual([
      [2, 1],
      [2, 1],
    ]);
    expect(result.ignored).toBe(1);
  });
  it("does not invent personal bests on first scores or ties", () => {
    expect(
      buildNightRecap([match(1)], "night").awards.filter(
        (a) => a.kind === "best",
      ),
    ).toEqual([]);
    expect(
      buildNightRecap([match(1, "a", null), match(2)], "night").awards.filter(
        (a) => a.kind === "best",
      ),
    ).toEqual([]);
  });
  it("compares personal bests against earlier same-format/board scores", () => {
    const previous = match(1, "a", null);
    previous.match_players![0].score = 40;
    const incompatible = match(2, "a", null, { game_type: "301" });
    incompatible.match_players![0].score = 100;
    const award = buildNightRecap(
      [previous, incompatible, match(3)],
      "night",
    ).awards.find((a) => a.kind === "best");
    expect(award?.playerId).toBe("a");
    expect(award?.reason).toContain("previously 40.00");
  });
  it("requires a real run of three wins and resets at losses", () => {
    expect(
      buildNightRecap([match(1), match(2), match(3)], "night").awards.find(
        (a) => a.kind === "streak",
      )?.matchIds,
    ).toEqual([1, 2, 3]);
    expect(
      buildNightRecap(
        [match(1), match(2, "b"), match(3), match(4)],
        "night",
      ).awards.filter((a) => a.kind === "streak"),
    ).toEqual([]);
  });
  it("withholds streak claims when appearance order is ambiguous", () => {
    const list = [match(1), match(2), match(3)];
    list[1].played_at = list[0].played_at;
    expect(
      buildNightRecap(list, "night").awards.some((a) => a.kind === "streak"),
    ).toBe(false);
  });
  it("finds first recorded wins across formats and does not repeat them", () => {
    const first = match(1, "a", null, { game_type: "Cricket" });
    expect(
      buildNightRecap([first, match(2)], "night").awards.some(
        (a) => a.kind === "first" && a.playerId === "a",
      ),
    ).toBe(false);
    expect(
      buildNightRecap([first, match(2, "b")], "night").awards.find(
        (a) => a.kind === "first",
      )?.playerId,
    ).toBe("b");
  });
  it("never promotes provisional ratings into competitive awards", () => {
    const awards = buildNightRecap(
      [match(1), match(2), match(3)],
      "night",
    ).awards;
    expect(awards.some((a) => ["surge", "upset"].includes(a.kind))).toBe(false);
  });
  it("uses full earlier history and excludes interleaved other-night rating contributions", () => {
    const before = Array.from({ length: 12 }, (_, i) =>
      match(i + 1, "a", null),
    );
    const night = [match(13, "b"), match(15, "b"), match(16, "b")];
    const result = buildNightRecap(
      [...before, ...night, match(14, "a", "other")],
      "night",
    );
    const b = result.ratingMoves.find((p) => p.playerId === "b")!;
    expect(b.gain).toBeGreaterThan(48);
    expect(b.games).toBe(3);
    expect(b.provisional).toBe(false);
    expect(result.awards.find((a) => a.kind === "upset")?.matchIds).toEqual([
      13,
    ]);
    expect(result.awards.find((a) => a.kind === "surge")?.playerId).toBe("b");
    const corrected = night.map((m) => ({
      ...m,
      match_players: m.match_players!.map((p) => ({
        ...p,
        is_winner: p.player_id === "a",
      })),
    }));
    expect(
      buildNightRecap([...before, ...corrected], "night").awards.some(
        (a) => a.kind === "surge" && a.playerId === "b",
      ),
    ).toBe(false);
  });
  it("supports unknown discipline results without claiming comparable scores", () => {
    const result = buildNightRecap(
      [match(1, "a", null), match(2, "b", "night", { game_type: null })],
      "night",
    );
    expect(result.standings).toHaveLength(2);
    expect(result.ratingMoves).toHaveLength(0);
    expect(result.awards.every((a) => a.kind === "first")).toBe(true);
  });
});
