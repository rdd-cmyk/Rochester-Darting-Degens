"use client";
import { ActionButton } from "@/components/ui/ActionButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { practicePerformance, soloScore } from "@/lib/solo/analysis";
import type { SoloFilter, SoloGame } from "@/lib/solo/types";
import type { LeagueNight, NightMatch } from "@/lib/league-night/types";
export function PracticePerformance({
  games,
  history,
  nights,
  owner,
  filter,
}: {
  games: SoloGame[];
  history: NightMatch[];
  nights: LeagueNight[];
  owner: string;
  filter: SoloFilter;
}) {
  const data = useMemo(
    () => practicePerformance(games, history, nights, owner, filter),
    [games, history, nights, owner, filter],
  );
  const hasTimeline = data.timeline.length > 0;
  const ref = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(620),
    [selected, setSelected] = useState("");
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setWidth(Math.max(240, node.clientWidth)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasTimeline]);
  const days = data.timeline.slice(-30),
    height = 200,
    unit = filter.game === "Cricket" ? "MPR" : "3DA";
  const values = days
    .flatMap((d) => [d.solo, d.league])
    .filter((n): n is number => n !== null);
  const max = Math.max(1, ...values) * 1.1,
    min = 0;
  const start = days.length ? Date.parse(days[0].date) : 0,
    end = days.length ? Date.parse(days.at(-1)!.date) : 1;
  const x = (date: string) =>
    42 +
    ((Date.parse(date) - start) / Math.max(86400000, end - start)) *
      (width - 62);
  const y = (value: number) => 165 - ((value - min) / (max - min)) * 135;
  function paths(key: "solo" | "league") {
    let path = "",
      last: string | null = null;
    for (const d of days) {
      const val = d[key];
      if (val === null) {
        if ((key === "solo" ? d.practice : d.leagueGames) > 0) last = null;
        continue;
      }
      const near =
        last && Date.parse(d.date) - Date.parse(last) <= 14 * 86400000;
      path += `${near ? "L" : "M"}${x(d.date)},${y(val)} `;
      last = d.date;
    }
    return path;
  }
  const detail = data.points.find((p) => p.nightId === selected);
  return (
    <section
      className="rdd-content-panel solo-panel solo-performance"
      aria-labelledby="practice-title"
    >
      <p className="rdd-title-eyebrow">PRACTICE &amp; PERFORMANCE</p>
      <h2 className="rdd-section-title" id="practice-title">Does it carry over?</h2>
      <p className="solo-muted">
        Your solo rhythm alongside your league scoring. Personal analysis ·{" "}
        {unit} · Individual games
      </p>
      <div className="solo-insight" role="status">
        <strong>{data.message}</strong>
        <p>
          {data.lowNights} eligible nights after 0–2 logged games ·{" "}
          {data.highNights} after 3+.
        </p>
        <p className="solo-small">
          A recorded association, not evidence that practice caused the
          difference. No logged practice does not mean no practice.
        </p>
      </div>
      <h3>Am I improving?</h3>
      {data.invalidLeagueScores > 0 && (
        <p className="solo-small">
          {data.invalidLeagueScores} league scores outside the valid {unit}
          {" "}range are excluded from averages and scored coverage. The games still count.
        </p>
      )}
      <div className="solo-legend">
        <span>
          <b className="solo-swatch" />
          Solo
        </span>
        <span>
          <b className="solo-swatch league" />
          League
        </span>
      </div>
      {!days.length ? (
        <p>Log compatible solo or league games to start your timeline.</p>
      ) : (
        <div ref={ref} className="solo-chart">
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Solo and league ${unit} over the last ${days.length} active dates; exact scores and counts are in the table below.`}
          >
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line
                  x1="42"
                  x2={width - 20}
                  y1={165 - t * 135}
                  y2={165 - t * 135}
                  className="solo-gridline"
                />
                <text x="34" y={169 - t * 135} textAnchor="end">
                  {(max * t).toFixed(1)}
                </text>
              </g>
            ))}
            <text x="42" y="15">
              {unit}
            </text>
            <path d={paths("solo")} className="solo-line" />
            <path d={paths("league")} className="solo-line league" />
            {days.map((d) => (
              <g key={d.date}>
                {d.solo !== null && (
                  <circle
                    cx={x(d.date)}
                    cy={y(d.solo)}
                    r="3.5"
                    className="solo-dot"
                  />
                )}
                {d.league !== null && (
                  <rect
                    x={x(d.date) - 3}
                    y={y(d.league) - 3}
                    width="6"
                    height="6"
                    className="solo-dot league"
                  />
                )}
              </g>
            ))}
            <text x="42" y="191">
              {days[0].date.slice(5)}
            </text>
            <text x={width - 20} y="191" textAnchor="end">
              {days.length > 1 ? days.at(-1)!.date.slice(5) : ""}
            </text>
          </svg>
          <p className="solo-small">
            Last {days.length} active dates · averages of reported game averages
            · gaps remain gaps.
          </p>
          <svg
            width="100%"
            height="78"
            viewBox={`0 0 ${width} 78`}
            role="img"
            aria-label="Logged practice games, aligned to the scoring dates above"
          >
            <line
              x1="42"
              x2={width - 20}
              y1="50"
              y2="50"
              className="solo-gridline"
            />
            {days.map((d) => (
              <g key={d.date}>
                <title>
                  {d.date}: {d.practice} logged practice games
                </title>
                {d.practice > 0 && (
                  <rect
                    x={x(d.date) - 3}
                    y={
                      50 -
                      (40 * d.practice) /
                        Math.max(1, ...days.map((t) => t.practice))
                    }
                    width="6"
                    height={
                      (40 * d.practice) /
                      Math.max(1, ...days.map((t) => t.practice))
                    }
                    className="solo-dot"
                  />
                )}
              </g>
            ))}
            <text x="42" y="72">
              {days[0].date.slice(5)}
            </text>
            <text x={width - 20} y="72" textAnchor="end">
              {days.length > 1 ? days.at(-1)!.date.slice(5) : ""}
            </text>
          </svg>
          <p className="solo-small">
            Logged practice games · scale 0–
            {Math.max(1, ...days.map((t) => t.practice))} · same dates as
            scoring
          </p>
          <details>
            <summary>Exact timeline scores and coverage</summary>
            <div className="solo-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Solo {unit}</th>
                    <th>League {unit}</th>
                    <th>Logged practice</th>
                  </tr>
                </thead>
                <tbody>
                  {data.timeline.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>
                        {d.solo?.toFixed(2) ?? "—"}
                        <small>
                          {d.soloScored}/{d.practice} scored
                        </small>
                      </td>
                      <td>
                        {d.league?.toFixed(2) ?? "—"}
                        <small>
                          {d.leagueScored}/{d.leagueGames} scored
                        </small>
                      </td>
                      <td>{d.practice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
      <h3>Practice before league night</h3>
      {data.mismatchedNightGames > 0 && (
        <p className="solo-small">
          {data.mismatchedNightGames} league games have a played date that differs
          from their linked night. They appear on their actual dates in the
          timeline and are excluded from night comparisons.
        </p>
      )}
      <p className="solo-small">
        Seven calendar days before the night · same-day games counted
        separately.
      </p>
      {!data.points.length ? (
        <p>No comparable league nights recorded yet.</p>
      ) : (
        <div className="solo-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Night</th>
                <th>Practice</th>
                <th>League {unit}</th>
                <th>Vs baseline</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map((p) => (
                <tr key={p.nightId}>
                  <td>
                    <ActionButton variant="quiet"
                      type="button"
                      onClick={() => setSelected(p.nightId)}
                    >
                      {p.date}
                    </ActionButton>
                  </td>
                  <td>
                    {p.practice}
                    <small>logged games</small>
                  </td>
                  <td>
                    {p.score?.toFixed(2) ?? "—"}
                    <small>
                      {p.scored}/{p.games} scored
                    </small>
                  </td>
                  <td>
                    {p.delta === null
                      ? "—"
                      : `${p.delta >= 0 ? "+" : ""}${p.delta.toFixed(2)}`}
                    <small>{p.baselineNights}/5 baseline nights</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <div className="solo-insight" aria-live="polite">
          <strong>{detail.date} · Comparison details</strong>
          <p>
            {detail.practice} games logged from {detail.windowStart} through the
            day before {detail.date}. League:{" "}
            {detail.score?.toFixed(2) ?? "no score"} {unit}; baseline:{" "}
            {detail.baseline?.toFixed(2) ?? "not enough earlier nights"}.
          </p>
          <p>
            {detail.sameDayBeforeResult} same-day solo games completed before
            your first recorded league result; {detail.chronologyUnknown} have
            unknown completion order. League start times are not recorded, so
            these are not confirmed pre-game warmups.
          </p>
          <p className="solo-small">
            League games: {detail.ids.map((id) => `#${id}`).join(", ")}
          </p>
          <p className="solo-small">
            Baseline nights: {detail.baselineDates.join(", ") || "None yet"}.
          </p>
          {detail.practiceIds.length > 0 && (
            <details>
              <summary>
                Practice games counted ({detail.practiceIds.length})
              </summary>
              <ul>
                {games
                  .filter((g) => detail.practiceIds.includes(g.id))
                  .map((g) => (
                    <li key={g.id}>
                      <time dateTime={g.played_at}>
                        {new Date(g.played_at).toLocaleString("en-US", {
                          timeZone: "America/New_York",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>{" "}
                      · {g.game_type} ·{" "}
                      {soloScore(g)?.toFixed(2) ?? "No reported score"}{" "}
                      {g.score === null ? "" : unit}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <details>
        <summary>How this comparison works</summary>
        <p>
          We match format, board and rule preset, and exclude practice matches,
          team games, handicaps, unfinished and inconsistent league results. The
          baseline is the mean of your previous five eligible night averages;
          each needs three scored games and at least 80% score coverage.
        </p>
        <p>
          The descriptive insight needs five eligible nights in each fixed group
          (0–2 and 3+ logged games), at least three distinct practice counts, a
          complete baseline, and nonoverlapping seven-day windows. It reports a
          difference, without a significance or causal claim. Opponents,
          ordinary improvement and selective logging can affect it.
        </p>
        <p>
          Solo volume includes completed, included games even without scores.
          Scoring averages exclude missing or invalid scores. Linking a game to a night
          never counts it twice. Dates use America/New_York. Incomplete history
          is never presented as a complete comparison.
        </p>
      </details>
    </section>
  );
}
