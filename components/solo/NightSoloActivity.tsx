"use client";
import { ActionLink } from "@/components/ui/ActionLink";
import { ActionButton } from "@/components/ui/ActionButton";
import { useEffect, useState } from "react";
import { loadSoloNight, soloError } from "@/lib/solo/api";
import { formatPlayerName } from "@/lib/playerName";
import type { SoloNightItem } from "@/lib/solo/types";
export function NightSoloActivity({
  nightId,
  refreshToken,
}: {
  nightId: string;
  refreshToken: unknown;
}) {
  const [items, setItems] = useState<SoloNightItem[] | null>(null),
    [error, setError] = useState(""),
    [received, setReceived] = useState<{
      nightId: string;
      refreshToken: unknown;
      retry: number;
    } | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void loadSoloNight(nightId)
      .then((rows) => {
        if (active) {
          setItems(rows);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(soloError(cause));
      })
      .finally(() => {
        if (active) setReceived({ nightId, refreshToken, retry });
      });
    return () => {
      active = false;
    };
  }, [nightId, refreshToken, retry]);
  return (
    <section className="night-panel solo-night-activity">
      <div className="night-section-heading">
        <h2 className="rdd-section-title">Solo at the venue</h2>
        <ActionLink href="/solo">Log a solo game</ActionLink>
      </div>
      <p className="night-small">
        Shared practice activity · Separate from league averages, rankings and
        awards.
      </p>
      {received?.nightId !== nightId ||
      received.refreshToken !== refreshToken ||
      received.retry !== retry ? (
        <p role="status">Loading solo activity…</p>
      ) : error ? (
        <>
          <p role="alert">Solo activity could not be loaded. {error}</p>
          <ActionButton onClick={() => setRetry((r) => r + 1)}>
            Retry solo activity
          </ActionButton>
        </>
      ) : items === null ? (
        <p role="status">Loading solo activity…</p>
      ) : !items.length ? (
        <p>No shared solo games for this night yet.</p>
      ) : (
        <>
          <p>
            {items.length} solo game{items.length === 1 ? "" : "s"} shared at
            this night.
          </p>
          <ul>
            {items.map((g) => (
              <li key={g.id}>
                <strong>
                  {formatPlayerName(
                    g.display_name,
                    g.first_name,
                    g.include_first_name_in_display,
                  )}
                </strong>{" "}
                · {g.game_type} ·{" "}
                {g.score === null
                  ? "No score"
                  : `${Number(g.score).toFixed(2)} ${g.score_unit}`}{" "}
                · {g.board_type} · {g.status} ·{" "}
                <time dateTime={g.played_at}>
                  {new Date(g.played_at).toLocaleTimeString("en-US", {
                    timeZone: "America/New_York",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
