"use client";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/league-night/use-current-user";
import { gameDefinition } from "@/lib/games/catalog";
import { loadMatches } from "@/lib/league-night/api";
import { loadSoloProfile, soloError } from "@/lib/solo/api";
import { profileSummary } from "@/lib/solo/analysis";
import type { SoloCohort, SoloFilter } from "@/lib/solo/types";
import type { NightMatch } from "@/lib/league-night/types";
import "@/app/solo/solo.css";
export function ProfileSoloStats({
  owner,
  scope,
  onScopeChange,
}: {
  owner: string;
  scope: "league" | "solo" | "all";
  onScopeChange: (scope: "league" | "solo" | "all") => void;
}) {
  const { user } = useCurrentUser();
  const [data, setData] = useState<SoloCohort[] | null>(null),
    [history, setHistory] = useState<NightMatch[]>([]),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<SoloFilter>({
    game: "501",
    board: "Steel Tip",
    preset: "unspecified",
  });
  const viewerId = user?.id;
  // Every scope activation gets its own envelope, including a return to a
  // previously loaded scope. Cached consent cannot stand in for this request.
  const request = useMemo(
    () => ({ owner, viewerId, scope, retry }),
    [owner, viewerId, scope, retry],
  );
  const [receivedRequest, setReceivedRequest] = useState<typeof request | null>(
    null,
  );
  useEffect(() => {
    if (scope === "league" || !viewerId) return;
    let active = true;
    void Promise.all([
      loadSoloProfile(owner),
      scope === "all" ? loadMatches() : Promise.resolve([]),
    ])
      .then(([solo, matches]) => {
        if (active) {
          setData(solo);
          setHistory(matches);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(soloError(cause));
      })
      .finally(() => {
        if (active) setReceivedRequest(request);
      });
    return () => {
      active = false;
    };
  }, [owner, scope, viewerId, request]);
  const stats = profileSummary(data ?? [], history, owner, filter, scope);
  return (
    <div className="solo-profile">
      <nav className="solo-scope" aria-label="Profile statistics scope">
        {(["league", "solo", "all"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={scope === s}
            onClick={() => onScopeChange(s)}
          >
            {s === "all" ? "All play" : s === "league" ? "League" : "Solo"}
          </button>
        ))}
      </nav>
      {scope !== "league" && (
        <section className="solo-panel">
          <h3>{scope === "solo" ? "Solo scoring" : "All play scoring"}</h3>
          {!user ? (
            <p>Sign in to view shared solo summaries.</p>
          ) : receivedRequest !== request ? (
            <p role="status">Loading scoring summary…</p>
          ) : error ? (
            <>
              <p role="alert">{error}</p>
              <button onClick={() => setRetry((r) => r + 1)}>
                Retry solo summary
              </button>
            </>
          ) : data === null ? (
            <p>This player’s solo summary is private.</p>
          ) : (
            <>
              <div className="solo-form-row">
                <label>
                  Game
                  <select
                    aria-label="Game"
                    value={filter.game}
                    onChange={(e) =>
                      setFilter((f) => ({
                        ...f,
                        game: e.target.value,
                        preset: "unspecified",
                      }))
                    }
                  >
                    {["301", "501", "701", "Cricket"].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Board
                  <select
                    aria-label="Board"
                    value={filter.board}
                    onChange={(e) =>
                      setFilter((f) => ({ ...f, board: e.target.value }))
                    }
                  >
                    <option>Steel Tip</option>
                    <option>Soft Tip</option>
                  </select>
                </label>
              </div>
              <label>
                Rules
                <select
                  aria-label="Rules"
                  value={filter.preset}
                  onChange={(e) =>
                    setFilter((f) => ({ ...f, preset: e.target.value }))
                  }
                >
                  <option value="unspecified">Rules unspecified</option>
                  {gameDefinition(filter.game)?.presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="solo-metrics">
                <div>
                  <small>Games</small>
                  <strong>{stats.games}</strong>
                  <small>
                    {stats.leagueGames} league + {stats.soloGames} solo
                  </small>
                </div>
                <div>
                  <small>Average of game averages</small>
                  <strong>{stats.average?.toFixed(2) ?? "—"}</strong>
                  <small>
                    {filter.game === "Cricket" ? "MPR" : "3DA"} · {stats.scored}
                    /{stats.games} scored
                  </small>
                </div>
              </div>
              {stats.rawSoloGames > 0 && (
                <p className="solo-small">
                  Exact solo {filter.game === "Cricket" ? "MPR" : "3DA"}:{" "}
                  <strong>{stats.exactSoloAverage?.toFixed(2)}</strong> ·{" "}
                  {stats.rawSoloGames}/{stats.soloGames} solo games with
                  complete raw totals. Separate from reported game averages.
                </p>
              )}
              {stats.invalidLeagueScores > 0 && (
                <p className="solo-small">
                  {stats.invalidLeagueScores} league scores outside the valid
                  {" "}{filter.game === "Cricket" ? "MPR" : "3DA"} range are
                  excluded from averages and scored coverage. The games still count.
                </p>
              )}
              <p className="solo-small">
                Compatible individual games only. Solo games count once and
                contribute no wins, losses or rating. Personal practice analysis
                and individual solo history stay private.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
