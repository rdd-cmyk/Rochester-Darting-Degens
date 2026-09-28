import { gameDefinition, ratingExclusion } from "@/lib/games/catalog";
import type { LeagueNight, NightMatch } from "@/lib/league-night/types";
import type { SoloCohort, SoloFilter, SoloGame } from "./types";

export const SOLO_TIMEZONE = "America/New_York";
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SOLO_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function localDay(instant: string, timezone = SOLO_TIMEZONE): string {
  if (!Number.isFinite(Date.parse(instant))) return "";
  const formatter =
    timezone === SOLO_TIMEZONE
      ? dayFormatter
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
  return formatter.format(new Date(instant));
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function soloScore(game: Pick<SoloGame, "score" | "score_unit">) {
  return game.score == null
    ? null
    : Number(game.score) * (game.score_unit === "PPD" ? 3 : 1);
}
export function soloEligible(game: SoloGame, filter: SoloFilter) {
  return (
    !game.deleted_at &&
    game.include_in_stats &&
    game.status === "completed" &&
    game.game_type === filter.game &&
    game.board_type === filter.board &&
    game.preset === filter.preset
  );
}
export function leagueEligible(match: NightMatch, filter: SoloFilter) {
  const players = match.match_players ?? [];
  return (
    Number.isFinite(Date.parse(match.played_at)) &&
    match.game_type === filter.game &&
    match.board_type === filter.board &&
    !ratingExclusion(match.game_config) &&
    (match.game_config?.format ?? "individual") === "individual" &&
    (match.game_config?.preset ?? "unspecified") === filter.preset &&
    players.length >= 2 &&
    players.length <= 10 &&
    new Set(players.map((p) => p.player_id)).size === players.length &&
    players.every((p) => !!p.player_id) &&
    match.match_players?.filter((p) => p.is_winner).length === 1
  );
}
function average(values: (number | null)[]) {
  const scored = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  return scored.length
    ? scored.reduce((a, b) => a + b, 0) / scored.length
    : null;
}
function leagueScore(score: number | null | undefined, game: string) {
  const cap = gameDefinition(game)?.cap;
  return score != null &&
    Number.isFinite(score) &&
    cap !== undefined &&
    score >= 0 &&
    score <= cap
    ? score
    : null;
}
export function profileSummary(
  cohorts: SoloCohort[],
  history: NightMatch[],
  owner: string,
  filter: SoloFilter,
  scope: "league" | "solo" | "all",
) {
  const solo = cohorts.find(
    (c) =>
      c.game_type === filter.game &&
      c.board_type === filter.board &&
      c.preset === filter.preset,
  );
  const league = history
    .filter((m) => leagueEligible(m, filter))
    .flatMap((m) =>
      (m.match_players ?? []).filter((p) => p.player_id === owner),
    );
  const leagueScores = league
    .map((p) => leagueScore(p.score, filter.game))
    .filter((v): v is number => v !== null);
  const soloGames = scope === "league" ? 0 : Number(solo?.games ?? 0),
    leagueGames = scope === "solo" ? 0 : league.length;
  const soloScored = scope === "league" ? 0 : Number(solo?.scored ?? 0),
    leagueScored = scope === "solo" ? 0 : leagueScores.length;
  const scored = soloScored + leagueScored,
    sum =
      (scope === "league" ? 0 : Number(solo?.score_sum ?? 0)) +
      (scope === "solo" ? 0 : leagueScores.reduce((a, b) => a + b, 0));
  return {
    games: soloGames + leagueGames,
    soloGames,
    leagueGames,
    invalidLeagueScores:
      scope === "solo"
        ? 0
        : league.filter(
            (p) => p.score != null && leagueScore(p.score, filter.game) === null,
          ).length,
    scored,
    average: scored ? sum / scored : null,
    best: scope === "solo" ? (solo?.best ?? null) : null,
    rawSoloGames: scope === "league" ? 0 : Number(solo?.raw_games ?? 0),
    exactSoloAverage:
      scope !== "league" && Number(solo?.darts_sum) > 0
        ? (3 * Number(solo?.raw_total_sum)) / Number(solo?.darts_sum)
        : null,
  };
}
export type PracticePoint = {
  nightId: string;
  date: string;
  practice: number;
  games: number;
  scored: number;
  score: number | null;
  baseline: number | null;
  baselineNights: number;
  delta: number | null;
  sameDayBeforeResult: number;
  chronologyUnknown: number;
  ids: string[];
  practiceIds: string[];
  baselineDates: string[];
  windowStart: string;
};
export function practicePerformance(
  games: SoloGame[],
  history: NightMatch[],
  nights: LeagueNight[],
  owner: string,
  filter: SoloFilter,
) {
  const practice = games.filter((g) => soloEligible(g, filter));
  const practiceDates = practice.map((game) => ({
    game,
    date: localDay(game.played_at),
  }));
  const soloByDate = new Map<string, SoloGame[]>();
  for (const { game, date } of practiceDates) {
    const rows = soloByDate.get(date) ?? [];
    rows.push(game);
    soloByDate.set(date, rows);
  }
  const eligible = history.filter(
    (m) =>
      leagueEligible(m, filter) &&
      m.match_players?.some((p) => p.player_id === owner),
  );
  const nightDates = new Map(nights.map((n) => [n.id, n.night_date]));
  let mismatchedNightGames = 0;
  const byNight = new Map<string, NightMatch[]>();
  const leagueByDate = new Map<string, NightMatch[]>();
  for (const match of eligible) {
    const date = localDay(match.played_at),
      dayRows = leagueByDate.get(date) ?? [];
    dayRows.push(match);
    leagueByDate.set(date, dayRows);
    if (match.night_id && nightDates.has(match.night_id)) {
      if (date !== nightDates.get(match.night_id)) {
        mismatchedNightGames++;
        continue;
      }
      const rows = byNight.get(match.night_id) ?? [];
      rows.push(match);
      byNight.set(match.night_id, rows);
    }
  }
  const points: PracticePoint[] = [];
  for (const night of [...nights].sort(
    (a, b) =>
      a.night_date.localeCompare(b.night_date) || a.id.localeCompare(b.id),
  )) {
    const rows = byNight.get(night.id);
    if (!rows?.length) continue;
    const scores = rows.map(
      (m) =>
        leagueScore(
          m.match_players!.find((p) => p.player_id === owner)?.score,
          filter.game,
        ),
    );
    const score = average(scores),
      previous = points
        .filter(
          (p) =>
            p.date < night.night_date &&
            p.score !== null &&
            p.scored >= 3 &&
            p.scored / p.games >= 0.8,
        )
        .slice(-5);
    const baseline =
      previous.length === 5 ? average(previous.map((p) => p.score)) : null;
    const start = shiftDay(night.night_date, -7);
    const preceding = practiceDates
      .filter(({ date }) => date >= start && date < night.night_date)
      .map(({ game }) => game);
    const firstResult = Math.min(...rows.map((m) => Date.parse(m.played_at)));
    const sameDay = soloByDate.get(night.night_date) ?? [];
    points.push({
      nightId: night.id,
      date: night.night_date,
      practice: preceding.length,
      games: rows.length,
      scored: scores.filter((s) => s !== null).length,
      score,
      baseline,
      baselineNights: previous.length,
      delta: score !== null && baseline !== null ? score - baseline : null,
      sameDayBeforeResult: sameDay.filter(
        (g) => g.completed_at && Date.parse(g.completed_at) < firstResult,
      ).length,
      chronologyUnknown: sameDay.filter((g) => !g.completed_at).length,
      ids: rows.map((m) => String(m.id)),
      practiceIds: preceding.map((g) => g.id),
      baselineDates: previous.map((p) => p.date),
      windowStart: start,
    });
  }
  // One descriptive observation per night; exclude duplicate dates and overlapping
  // prior-week windows from the insight sample. The full timeline still shows all.
  const independent: PracticePoint[] = [];
  for (const p of points)
    if (
      p.delta !== null &&
      p.scored >= 3 &&
      p.scored / p.games >= 0.8 &&
      (!independent.length || p.date >= shiftDay(independent.at(-1)!.date, 7))
    )
      independent.push(p);
  const low = independent.filter((p) => p.practice <= 2),
    high = independent.filter((p) => p.practice >= 3);
  let message = "Not enough comparable nights yet.";
  let difference: number | null = null;
  if (
    low.length >= 5 &&
    high.length >= 5 &&
    new Set(independent.map((p) => p.practice)).size >= 3
  ) {
    difference =
      average(high.map((p) => p.delta))! - average(low.map((p) => p.delta))!;
    const unit = filter.game === "Cricket" ? "MPR" : "3DA";
    message =
      Math.abs(difference) < 0.005
        ? `No recorded difference at this precision: the two practice groups had the same mean change from your recent league baseline (${unit}).`
        : `Recorded comparison: after 3+ logged games, the change from your recent league baseline averaged ${Math.abs(difference).toFixed(2)} ${unit} ${difference >= 0 ? "higher" : "lower"} than after 0–2 logged games.`;
  } else if (low.length >= 5 && high.length >= 5) {
    message =
      "More variation in logged practice is needed before showing a comparison.";
  }
  const days = [
    ...new Set([...soloByDate.keys(), ...leagueByDate.keys()]),
  ].sort();
  const timeline = days.map((date) => {
    const solo = soloByDate.get(date) ?? [];
    const league = leagueByDate.get(date) ?? [];
    return {
      date,
      solo: average(solo.map(soloScore)),
      league: average(
        league.map(
          (m) =>
            leagueScore(
              m.match_players!.find((p) => p.player_id === owner)?.score,
              filter.game,
            ),
        ),
      ),
      practice: solo.length,
      soloScored: solo.filter((g) => g.score !== null).length,
      leagueGames: league.length,
      leagueScored: league.filter(
        (m) =>
          leagueScore(
            m.match_players!.find((p) => p.player_id === owner)?.score,
            filter.game,
          ) !== null,
      ).length,
    };
  });
  return {
    points,
    timeline,
    message,
    difference,
    lowNights: low.length,
    highNights: high.length,
    mismatchedNightGames,
    invalidLeagueScores: eligible.filter((m) => {
      const score = m.match_players!.find((p) => p.player_id === owner)?.score;
      return score != null && leagueScore(score, filter.game) === null;
    }).length,
  };
}
