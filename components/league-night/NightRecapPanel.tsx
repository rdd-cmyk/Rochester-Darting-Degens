"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatLabel } from '@/lib/games/catalog';
import {
  buildNightRecap,
  participantName,
  scoreSummary,
  type NightAward,
} from "@/lib/league-night/recap";
import type { LeagueNight, NightMatch } from "@/lib/league-night/types";
import { drawShareCard } from "@/lib/league-night/share-card";

export function nightDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function AwardCard({ award }: { award: NightAward }) {
  return (
    <article className="night-award">
      <span className="night-award-medal" aria-hidden="true">
        {award.kind === "streak"
          ? "🔥"
          : award.kind === "best"
            ? "★"
            : award.kind === "upset"
              ? "⚡"
              : "🏅"}
      </span>
      <p className="night-eyebrow">{award.title}</p>
      <h3>{award.playerName}</h3>
      <p>{award.reason}</p>
      <p className="night-small">{award.scope}</p>
      <details>
        <summary>Why this award?</summary>
        <p>{award.rule}</p>
        <p className="night-small">
          Recorded match{award.matchIds.length === 1 ? "" : "es"}:{" "}
          {award.matchIds.join(", ")}
        </p>
      </details>
    </article>
  );
}
export function NightRecapPanel({
  night,
  history,
  loading,
  error,
  onRefresh,
}: {
  night: LeagueNight;
  history: NightMatch[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const recap = useMemo(
    () => buildNightRecap(history, night.id),
    [history, night.id],
  );
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const featured = useMemo(
    () =>
      recap.awards
        .filter((a) =>
          (chosen ?? recap.awards.slice(0, 3).map((a) => a.id)).includes(a.id),
        )
        .slice(0, 3),
    [recap.awards, chosen],
  );
  useEffect(() => {
    if (canvasRef.current)
      drawShareCard(
        canvasRef.current,
        nightDate(night.night_date),
        recap.matches.length,
        recap.standings.length,
        featured,
      );
  }, [
    featured,
    night.night_date,
    recap.matches.length,
    recap.standings.length,
    shareOpen,
    loading,
    error,
  ]);
  const shareText = [
    `Rochester Darting Degens — ${nightDate(night.night_date)}`,
    `${recap.matches.length} recorded games · ${recap.standings.length} players · So far tonight`,
    ...featured.map(
      (a) => `${a.title}: ${a.playerName} — ${a.reason} (${a.scope})`,
    ),
    "Based on confirmed site results; awards use recorded history.",
  ].join("\n");
  async function downloadCard() {
    try {
      const canvas = canvasRef.current;
      if (
        !canvas ||
        !drawShareCard(
          canvas,
          nightDate(night.night_date),
          recap.matches.length,
          recap.standings.length,
          featured,
        )
      )
        throw new Error(
          "Image export is unavailable. The text version is still here.",
        );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Could not create the share image.")),
          "image/png",
        ),
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rdd-night-${night.night_date}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setShareNotice("Your recap image is ready.");
    } catch (cause) {
      setShareNotice(
        cause instanceof Error
          ? cause.message
          : "Image export failed. Your recap is still here.",
      );
    }
  }
  if (loading)
    return (
      <section className="night-panel" aria-live="polite">
        Loading the full recorded history for tonight’s highlights…
      </section>
    );
  if (error)
    return (
      <section className="night-panel">
        <h2>Highlights are waiting on the full history.</h2>
        <p role="alert">{error}</p>
        <button onClick={onRefresh}>Try again</button>
      </section>
    );
  return (
    <section className="night-recap">
      <div className="night-recap-banner">
        <p className="night-eyebrow">The night so far</p>
        <h2>
          A few good games.
          <br />A lot to talk about.
        </h2>
        <p>
          {recap.matches.length} confirmed games · {recap.standings.length}{" "}
          players in action
        </p>
      </div>
      {recap.incompleteHistory > 0 && (
        <p className="night-small">
          Some recorded history is incomplete. Affected awards are withheld;
          rating changes use complete results only.
        </p>
      )}
      {recap.ignored > 0 && (
        <p className="night-warning">
          {recap.ignored} incomplete or inconsistent result
          {recap.ignored === 1 ? " is" : "s are"} excluded from highlights.
        </p>
      )}
      <div className="night-section-heading">
        <div>
          <h2>Tonight’s awards</h2>
          <p className="night-small">
            Earned bragging rights. Updated as results come in.
          </p>
        </div>
        {recap.matches.length > 0 && (
          <button onClick={() => setShareOpen((open) => !open)}>
            Preview share card
          </button>
        )}
      </div>
      {recap.awards.length === 0 ? (
        <div className="night-panel">
          <h3>
            {recap.matches.length
              ? "The night is still young."
              : "Your story starts with the first game."}
          </h3>
          <p>
            {recap.matches.length
              ? "No awards qualify yet. Personal milestones and streaks will appear when the recorded results support them."
              : "Record a match to start tonight’s results and highlights."}
          </p>
        </div>
      ) : (
        <>
          <div className="night-award-grid">
            {recap.awards.slice(0, 3).map((a) => (
              <AwardCard key={a.id} award={a} />
            ))}
          </div>
          {recap.awards.length > 3 && (
            <details className="night-panel">
              <summary>All awards ({recap.awards.length})</summary>
              <div className="night-award-grid">
                {recap.awards.slice(3).map((a) => (
                  <AwardCard key={a.id} award={a} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
      {shareOpen && (
        <section className="night-panel night-share">
          <h3>Choose up to three awards to share</h3>
          <p className="night-small">
            Includes display names and results. Venue and private notes are
            omitted.
          </p>
          <div className="night-share-choices">
            {recap.awards.map((a) => (
              <label key={a.id}>
                <input
                  type="checkbox"
                  checked={featured.some((f) => f.id === a.id)}
                  disabled={
                    featured.length >= 3 && !featured.some((f) => f.id === a.id)
                  }
                  onChange={(e) =>
                    setChosen(
                      e.target.checked
                        ? [...featured.map((f) => f.id), a.id]
                        : featured
                            .filter((f) => f.id !== a.id)
                            .map((f) => f.id),
                    )
                  }
                />
                {a.title} · {a.playerName}
              </label>
            ))}
          </div>
          <div className="night-share-preview">
            <canvas ref={canvasRef} role="img" aria-label={shareText} />
          </div>
          <details>
            <summary>Text version</summary>
            <pre className="night-share-text">{shareText}</pre>
          </details>
          <div className="night-actions">
            <button className="night-primary" onClick={downloadCard}>
              Download image
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareText);
                  setShareNotice("Recap copied.");
                } catch {
                  setShareNotice(
                    "Open Text version above to select and copy the recap.",
                  );
                }
              }}
            >
              Copy text
            </button>
          </div>
          <p role="status">{shareNotice}</p>
        </section>
      )}
      <div className="night-recap-columns">
        <section className="night-panel">
          <h2>Tonight’s results</h2>
          <table className="night-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Wins</th>
                <th>Games</th>
              </tr>
            </thead>
            <tbody>
              {recap.standings.map((p) => (
                <tr key={p.playerId}>
                  <td>{p.name}</td>
                  <td>{p.wins}</td>
                  <td>{p.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="night-panel">
          <h2>Rating movement</h2>
          <p className="night-small">
            Only tonight’s contribution, using earlier recorded games for
            context.
          </p>
          {recap.ratingMoves.length ? (
            recap.ratingMoves.map((p) => (
              <div
                className="night-rating-row"
                key={`${p.scope}:${p.playerId}`}
              >
                <div>
                  <strong>{p.name}</strong>
                  <p className="night-small">
                    {p.scope} · {p.games} game{p.games === 1 ? "" : "s"}
                    {p.provisional ? " · Provisional" : ""}
                  </p>
                </div>
                <strong>
                  {p.gain > 0 ? "+" : ""}
                  {p.gain.toFixed(1)}
                </strong>
              </div>
            ))
          ) : (
            <p>No supported discipline ratings yet.</p>
          )}
        </section>
      </div>
      <section className="night-panel">
        <h2>Every game, in order</h2>
        {recap.matches.map((m) => (
          <div className="night-result" key={m.id}>
            <div>
              <strong>
                {m.match_players!.filter((p) => p.is_winner).map(participantName).join(' + ')}{' '}
                won{m.game_config?.format && m.game_config.format !== 'individual'
                  ? ` as ${formatLabel(m.game_config.format)}` : ''}
              </strong>
              <p className="night-small">
                {m.match_players!.map(participantName).join(" · ")} ·{" "}
                {m.game_type || "Unknown format"} ·{" "}
                {m.board_type || "Unknown board"}
              </p>
              <p className="night-small">
                #{m.id} · {scoreSummary(m)}
              </p>
            </div>
            <time dateTime={m.played_at}>
              {new Date(m.played_at).toLocaleTimeString("en-US", {
                timeZone: "America/New_York",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </div>
        ))}
        <p className="night-small">
          Times shown in America/New_York.{" "}
          <Link href="/stats">Explore the full League Lab</Link>.
        </p>
      </section>
    </section>
  );
}
