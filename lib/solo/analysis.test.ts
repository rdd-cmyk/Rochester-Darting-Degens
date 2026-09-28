import { describe, it, expect } from "vitest";
import {
  localDay,
  shiftDay,
  soloScore,
  soloEligible,
  leagueEligible,
  profileSummary,
  practicePerformance,
} from "./analysis";
import type { SoloFilter, SoloGame } from "./types";
import type { NightMatch, LeagueNight } from "@/lib/league-night/types";
import { defaultConfig } from "@/lib/games/catalog";
const filter: SoloFilter = {
  game: "501",
  board: "Steel Tip",
  preset: "501-double-v1",
};
const solo = (extra: Partial<SoloGame> = {}): SoloGame => ({
  id: "solo",
  owner_id: "a",
  session_id: "s",
  played_at: "2026-03-02T23:00:00Z",
  completed_at: null,
  timezone: "America/New_York",
  game_type: "501",
  board_type: "Steel Tip",
  preset: "501-double-v1",
  status: "completed",
  score: 20,
  score_unit: "PPD",
  raw_total: null,
  darts: null,
  include_in_stats: true,
  night_id: null,
  share_with_night: false,
  notes: "",
  location: "",
  revision: 1,
  deleted_at: null,
  ...extra,
});
const match = (extra: Partial<NightMatch> = {}): NightMatch => ({
  id: 1,
  played_at: "2026-03-05T23:00:00Z",
  game_type: "501",
  board_type: "Steel Tip",
  game_config: { ...defaultConfig(), preset: "501-double-v1" },
  night_id: "n",
  venue: null,
  notes: null,
  created_by: "a",
  revision: 1,
  match_players: [
    { id: 1, player_id: "a", score: 40, points_scored: null, is_winner: true },
    { id: 2, player_id: "b", score: 30, points_scored: null, is_winner: false },
  ],
  ...extra,
});
const night = (date = "2026-03-05", id = "n"): LeagueNight => ({
  id,
  night_date: date,
  title: id,
  venue: null,
  created_by: "a",
  created_at: date,
});
describe("solo score cohorts and chronology", () => {
  it("normalizes PPD while preserving no-score and zero", () => {
    expect(soloScore(solo())).toBe(60);
    expect(soloScore(solo({ score: null }))).toBeNull();
    expect(soloScore(solo({ score: 0, score_unit: "3DA" }))).toBe(0);
  });
  it("uses local dates at DST and midnight boundaries", () => {
    expect(localDay("2026-03-08T04:30:00Z")).toBe("2026-03-07");
    expect(localDay("invalid")).toBe("");
    expect(shiftDay("2026-03-08", -7)).toBe("2026-03-01");
  });
  it("excludes deleted, stopped, unshared-to-stats and incompatible practice", () => {
    for (const extra of [
      { deleted_at: "2026-01-01" },
      { status: "stopped" as const },
      { include_in_stats: false },
      { game_type: "301" as const },
      { board_type: "Soft Tip" as const },
      { preset: "unspecified" },
    ])
      expect(soloEligible(solo(extra), filter)).toBe(false);
    expect(soloEligible(solo({ night_id: "n" }), filter)).toBe(true);
  });
  it("does not admit practice, team, handicapped, inconsistent or wrong-rule matches", () => {
    for (const config of [
      {
        ...defaultConfig(),
        preset: filter.preset,
        context: "practice" as const,
      },
      { ...defaultConfig(), preset: filter.preset, handicap: true },
      { ...defaultConfig(), preset: filter.preset, format: "2v2" as const },
      defaultConfig(),
    ])
      expect(leagueEligible(match({ game_config: config }), filter)).toBe(
        false,
      );
    expect(leagueEligible(match({ match_players: null }), filter)).toBe(false);
    expect(leagueEligible(match({ played_at: "invalid" }), filter)).toBe(false);
    const duplicate = match();
    duplicate.match_players![1].player_id = "a";
    expect(leagueEligible(duplicate, filter)).toBe(false);
    expect(
      leagueEligible(match({ game_config: null }), {
        ...filter,
        preset: "unspecified",
      }),
    ).toBe(true);
  });
  it("weights combined reported averages by scored games and never by population", () => {
    const cohorts = [
      {
        game_type: "501",
        board_type: "Steel Tip",
        preset: filter.preset,
        games: 3,
        scored: 2,
        score_sum: 120,
        best: 70,
      },
    ];
    expect(
      profileSummary(cohorts, [match()], "a", filter, "all"),
    ).toMatchObject({
      games: 4,
      scored: 3,
      average: 160 / 3,
      soloGames: 3,
      leagueGames: 1,
      best: null,
    });
    expect(profileSummary(cohorts, [match()], "a", filter, "solo").best).toBe(
      70,
    );
    expect(
      profileSummary(cohorts, [match()], "a", filter, "league").games,
    ).toBe(1);
    expect(profileSummary([], [], "a", filter, "solo").average).toBeNull();
  });
  it("keeps exact raw averages separate from the summary population", () => {
    const cohorts = [
      {
        game_type: "501",
        board_type: "Steel Tip",
        preset: filter.preset,
        games: 4,
        scored: 3,
        score_sum: 180,
        best: 70,
        raw_games: 2,
        raw_total_sum: 1002,
        darts_sum: 54,
      },
    ];
    const summary = profileSummary(cohorts, [match()], "a", filter, "all");
    expect(summary.average).toBe(55);
    expect(summary.exactSoloAverage).toBeCloseTo((3 * 1002) / 54);
    expect(summary.rawSoloGames).toBe(2);
    expect(
      profileSummary(cohorts, [match()], "a", filter, "league")
        .exactSoloAverage,
    ).toBeNull();
  });
  it("counts only preceding dates and tracks ambiguous completion separately", () => {
    const games = [
      solo({ score: null }),
      solo({
        played_at: "2026-03-05T21:00:00Z",
        completed_at: "2026-03-05T21:15:00Z",
      }),
      solo({ played_at: "2026-03-05T22:00:00Z" }),
      solo({ played_at: "2026-03-06T22:00:00Z" }),
      solo({ played_at: "2026-02-25T22:00:00Z" }),
    ];
    const data = practicePerformance(games, [match()], [night()], "a", filter);
    expect(data.points[0]).toMatchObject({
      practice: 1,
      sameDayBeforeResult: 1,
      chronologyUnknown: 1,
      baseline: null,
      score: 40,
    });
    expect(data.timeline.find((d) => d.date === "2026-03-02")?.solo).toBeNull();
    expect(data.message).toBe("Not enough comparable nights yet.");
  });
  it("withholds baseline on missing scores and never treats null as zero", () => {
    const m = match();
    m.match_players![0].score = null;
    const data = practicePerformance([], [m], [night()], "a", filter);
    expect(data.points[0].score).toBeNull();
    expect(data.points[0].scored).toBe(0);
  });
  it("keeps mismatched night dates out of night comparisons and uses actual dates in the timeline", () => {
    const wrongDate = match({ played_at: "2026-03-26T23:00:00Z" });
    const data = practicePerformance([solo()], [wrongDate], [night()], "a", filter);
    expect(data.points).toEqual([]);
    expect(data.timeline.find((d) => d.date === "2026-03-26")).toMatchObject({
      league: 40,
      leagueGames: 1,
    });
  });
  it.each([
    ["501", "501-double-v1", 181, 180],
    ["301", "301-double-v1", -1, 180],
    ["Cricket", "cricket-v1", 10, 9],
  ])("excludes invalid %s scores from averages and coverage without dropping games", (game, preset, invalid, cap) => {
    const cohortFilter = { ...filter, game, preset };
    const history = [invalid, null, 0, cap, NaN, Infinity].map((score, id) => {
      const row = match({ id, game_type: game, game_config: { ...defaultConfig(), preset } });
      row.match_players![0].score = score;
      return row;
    });
    expect(profileSummary([], history, "a", cohortFilter, "all")).toMatchObject({
      games: 6, scored: 2, average: cap / 2,
    });
    const data = practicePerformance([], history, [night()], "a", cohortFilter);
    expect(data.points[0]).toMatchObject({ games: 6, scored: 2, score: cap / 2 });
    expect(data.timeline[0]).toMatchObject({ leagueGames: 6, leagueScored: 2, league: cap / 2 });
  });
  it("includes historical ranked games without a night in the timeline only", () => {
    const data = practicePerformance([], [match({ night_id: null })], [], "a", filter);
    expect(data.points).toEqual([]);
    expect(data.timeline).toEqual([{
      date: "2026-03-05", solo: null, league: 40, practice: 0,
      soloScored: 0, leagueGames: 1, leagueScored: 1,
    }]);
  });
  it("uses prior five eligible nights and returns a descriptive comparison only with both groups", () => {
    const nights: LeagueNight[] = [],
      history: NightMatch[] = [],
      games: SoloGame[] = [];
    for (let i = 0; i < 20; i++) {
      const date = shiftDay("2026-03-05", i * 7),
        id = String(i);
      nights.push(night(date, id));
      for (let j = 0; j < 3; j++) {
        const m = match({
          id: i * 3 + j,
          night_id: id,
          played_at: `${date}T23:00:00Z`,
        });
        m.match_players![0].score = 50 + i * 0.1 + (i % 2 ? 3 : 0);
        history.push(m);
      }
      for (let j = 0; j < (i % 2 ? 4 : i % 4 === 0 ? 0 : 1); j++)
        games.push(
          solo({
            id: `${i}-${j}`,
            played_at: `${shiftDay(date, -2)}T22:00:00Z`,
          }),
        );
    }
    const data = practicePerformance(games, history, nights, "a", filter);
    expect(data.points[4].baseline).toBeNull();
    expect(data.points[5].baselineNights).toBe(5);
    expect(data.points[5].baseline).toBeCloseTo(51.4);
    expect(data.difference).not.toBeNull();
    expect(data.message).toContain("Recorded comparison");
    expect(data.highNights).toBeGreaterThanOrEqual(5);
    const sameCount = games.filter((g) => g.id.endsWith("-0"));
    expect(
      practicePerformance(sameCount, history, nights, "a", filter).difference,
    ).toBeNull();
    expect(
      practicePerformance(games, history, nights, "someone-else", filter)
        .points,
    ).toEqual([]);
  });
});
