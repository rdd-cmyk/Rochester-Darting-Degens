"use client";
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionLink } from '@/components/ui/ActionLink';
import { ActionButton } from '@/components/ui/ActionButton';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/league-night/use-current-user";
import { loadMatches, loadProfiles } from "@/lib/league-night/api";
import type { NightMatch, PlayerProfile } from "@/lib/league-night/types";
import { formatPlayerName } from "@/lib/playerName";
import { gameDefinition, presetLabel } from "@/lib/games/catalog";
import {
  buildRivalry,
  discoverRivalries,
  scoreCohorts,
} from "@/lib/rivalries/engine";
import { repairCandidates } from "@/lib/rivalries/repair";
import { buildRivalryPowerRatings } from "@/lib/rivalries/power-ratings";
import { STARTING_RATING } from "@/lib/stats/engine";
import { loadRivalryFeed, rivalryError } from "@/lib/rivalries/api";
import type { RivalryFeed } from "@/lib/rivalries/types";
import { useRivalryOperation } from "@/lib/rivalries/use-operation";
import { PlayerAvatar, PlayerAvatarName } from "@/components/avatars/PlayerAvatar";
import { RivalryPoster } from "./RivalryPoster";
import "./rivalries.css";
const nameOf = (p: PlayerProfile | undefined) =>
  p
    ? formatPlayerName(
        p.display_name,
        p.first_name,
        p.include_first_name_in_display,
      )
    : "Former player";
const statusLabel = (state: string) =>
  state.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export function RivalryRoom({
  challengeId,
  pair,
}: {
  challengeId?: string;
  pair?: [string, string];
}) {
  const { user, loading } = useCurrentUser();
  if (loading)
    return (
      <main className="rdd-page-shell rr-shell rr-consistent rdd-form-controls">
        <PageHeader title={challengeId ? "The challenge" : pair ? "Head to head" : "The Rivalry Room"} eyebrow="Rochester Darting Degens" /><p role="status">Opening the Rivalry Room…</p>
      </main>
    );
  if (!user)
    return (
      <main className="rdd-page-shell rr-shell rr-consistent rdd-form-controls">
        <PageHeader title={challengeId ? "The challenge" : pair ? "Head to head" : "The Rivalry Room"} eyebrow="Rochester Darting Degens" description="Find your rival. Set the stakes. Write the next chapter." />
        <ActionLink variant="primary"
          href={`/auth?next=${encodeURIComponent(challengeId ? `/rivalries/challenges/${challengeId}` : pair ? `/rivalries/pair/${pair[0]}/${pair[1]}` : "/rivalries")}`}
        >
          Sign in to the league
        </ActionLink>
      </main>
    );
  return (
    <Room
      key={user.id}
      userId={user.id}
      challengeId={challengeId}
      pair={pair}
    />
  );
}
function Room({
  userId,
  challengeId,
  pair,
}: {
  userId: string;
  challengeId?: string;
  pair?: [string, string];
}) {
  const router = useRouter();
  const [data, setData] = useState<{
    feed: RivalryFeed;
    profiles: PlayerProfile[];
    matches: NightMatch[];
  } | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState("");
  const [opponent, setOpponent] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [boardFilter, setBoardFilter] = useState("");
  const [modal, setModal] = useState<"challenge" | "poster" | null>(null);
  const [tv, setTv] = useState(false);
  const [game, setGame] = useState("501");
  const [preset, setPreset] = useState("501-double-v1");
  const [board, setBoard] = useState("Steel Tip");
  const [bestOf, setBestOf] = useState(5);
  const [night, setNight] = useState("");
  const [reason, setReason] = useState("");
  const [repairId, setRepairId] = useState("");
  const mounted = useRef(false);
  const generation = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const poster = useRef<HTMLDivElement>(null);
  const powerRatings = useMemo(
    () => buildRivalryPowerRatings(data?.matches ?? []),
    [data?.matches],
  );
  function ratingOf(playerId: string) {
    return powerRatings.get(playerId) ?? { rating: STARTING_RATING, provisional: true };
  }
  function ratingLabel(playerId: string) {
    const player = ratingOf(playerId);
    return `Power Rating ${Math.round(player.rating).toLocaleString("en-US")}${player.provisional ? " (Provisional)" : ""}`;
  }
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setRefreshing(true);
    try {
      const [feed, profiles, matches] = await Promise.all([
        loadRivalryFeed(),
        loadProfiles(),
        loadMatches(),
      ]);
      if (mounted.current && current === generation.current) {
        setData({ feed, profiles, matches });
        setError("");
        setStale(false);
        setLoadedAt(
          new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        );
      }
    } catch (cause) {
      if (mounted.current && current === generation.current) {
        setError(rivalryError(cause));
        setStale(true);
        if ((cause as { code?: string })?.code === "42501") setData(null);
      }
    } finally {
      if (mounted.current && current === generation.current)
        setRefreshing(false);
    }
  }, []);
  const op = useRivalryOperation(userId, "room", (receipt) => {
    setModal(null);
    if (receipt.challenge) {
      setData((current) =>
        current
          ? {
              ...current,
              feed: {
                ...current.feed,
                challenges: [
                  receipt.challenge!,
                  ...current.feed.challenges.filter(
                    (c) => c.id !== receipt.challenge!.id,
                  ),
                ],
              },
            }
          : null,
      );
      if (receipt.challenge.id !== challengeId && receipt.challenge.created_at)
        router.push(`/rivalries/challenges/${receipt.challenge.id}`);
    }
    void refresh();
  });
  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Begin the remote subscription and loading state after hydration.
    void refresh();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20000);
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      mounted.current = false;
      clearInterval(poll);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  useEffect(() => {
    const element = dialog.current;
    if (!modal || !element) return;
    const opener = document.activeElement;
    element.showModal();
    return () => {
      // The conditional dialog is removed on dismissal; restore focus explicitly.
      element.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [modal]);
  useEffect(() => {
    const change = () => setTv(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  const selectedChallenge =
    data?.feed.challenges.find((c) => c.id === challengeId) ?? null;
  const candidates = selectedChallenge && data
    ? repairCandidates(data.matches, selectedChallenge, data.feed.challenges) : [];
  const incoming = data?.feed.challenges.filter((c) => c.recipient === userId && c.state === "pending") ?? [];
  const left = selectedChallenge?.sender ?? pair?.[0] ?? userId;
  const rivals = data
    ? discoverRivalries(
        data.matches,
        left,
        data.profiles
          .filter((p) => data.feed.active_users.includes(p.id))
          .map((p) => p.id),
      )
    : [];
  const right = selectedChallenge?.recipient ?? pair?.[1] ?? opponent ?? "";
  const actualRight = right || rivals[0]?.opponent || "";
  const pairHistory = buildRivalry(data?.matches ?? [], left, actualRight);
  const rivalry = buildRivalry(
    data?.matches ?? [],
    left,
    actualRight,
    gameFilter || undefined,
    boardFilter || undefined,
  );
  const names: [string, string] = [
    nameOf(data?.profiles.find((p) => p.id === left)),
    nameOf(data?.profiles.find((p) => p.id === actualRight)),
  ];
  const choices = new Map(
    data?.feed.avatars.map((a) => [a.user_id, a.avatar_id]),
  );
  const avatarIds: [string | null, string | null] = [
    choices.get(left) ?? null,
    choices.get(actualRight) ?? null,
  ];
  const personal = left === userId || actualRight === userId;
  const challengeRecipient = left === userId ? actualRight : left;
  const score = selectedChallenge?.wins ?? rivalry.wins;
  const safeWinner = !stale ? selectedChallenge?.winner : null;
  const heading = selectedChallenge
    ? safeWinner
      ? "THE CHAPTER IS WON."
      : selectedChallenge.state === "completed"
        ? "RECORDED SERIES."
        : "TIME TO SETTLE IT."
    : rivalry.headline;
  const terms = selectedChallenge
    ? `${selectedChallenge.game} · ${presetLabel(selectedChallenge.game, { preset: selectedChallenge.preset } as Parameters<typeof presetLabel>[1])} · ${selectedChallenge.board} · Best of ${selectedChallenge.best_of} games`
    : "Recorded competitive singles · lifetime series";
  const locked = op.busy || !!op.pending || !op.ready || stale;
  function act(action: string, extra: Record<string, unknown> = {}) {
    if (selectedChallenge)
      void op.submit({
        action,
        id: selectedChallenge.id,
        expected_revision: selectedChallenge.revision,
        event_revision: selectedChallenge.schedule.event_revision,
        ...extra,
      });
  }
  async function television() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await poster.current?.requestFullscreen();
    } catch {
      setError("Fullscreen is unavailable in this browser.");
    }
  }
  if (!data)
    return (
      <main className="rdd-page-shell rr-shell rr-consistent rdd-form-controls">
        <PageHeader title={challengeId ? "The challenge" : pair ? "Head to head" : "The Rivalry Room"} eyebrow="Rochester Darting Degens" />
        <p>{error || "Finding your next chapter…"}</p>
        {error && (
          <ActionButton disabled={refreshing} onClick={() => void refresh()}>
            Retry
          </ActionButton>
        )}
      </main>
    );
  if (challengeId && !selectedChallenge)
    return (
      <main className="rdd-page-shell rr-shell rr-consistent rdd-form-controls">
        <PageHeader title="Challenge unavailable" eyebrow="The Rivalry Room" />
        <p>This challenge is no longer available to your league.</p>
        <Link href="/rivalries">Back to the Rivalry Room</Link>
      </main>
    );
  return (
    <main className="rdd-page-shell rr-shell rr-consistent rdd-form-controls">
      <PageHeader title={challengeId ? "The challenge" : pair ? "Head to head" : "The Rivalry Room"} eyebrow="Rochester Darting Degens"
        description={challengeId ? "Set the stakes. Follow the series. Write the next chapter." : pair ? "The tale of the tape. Every game leaves a mark." : "Your history. Your rivals. Your next chapter."}
        actions={<>{(pair || challengeId) && <ActionLink variant="quiet" href="/rivalries">Back to the Rivalry Room</ActionLink>}
          <ActionLink variant="quiet" href="/profile">Choose your avatar ↗</ActionLink>
          <ActionButton disabled={refreshing} onClick={() => void refresh()}>{refreshing ? "Refreshing…" : "Refresh"}</ActionButton></>} />
      {incoming.length > 0 && (
        <section className="rr-incoming" aria-label="Incoming challenges">
          <h2 className="rdd-section-title">{incoming.length === 1 ? "A challenge is waiting for you" : `${incoming.length} challenges are waiting for you`}</h2>
          {incoming.map((c) => (
            <Link key={c.id} href={`/rivalries/challenges/${c.id}`}>
              {nameOf(data.profiles.find((p) => p.id === c.sender))} challenged you · {c.game} · Best of {c.best_of} · Review challenge ↗
            </Link>
          ))}
        </section>
      )}
      <div className="rr-sync" role="status">
        {stale
          ? "Showing the last loaded data. Refresh before taking action."
          : `Updated ${loadedAt} · Recorded league results`}
      </div>
      {error && (
        <p className="rr-error" role="alert">
          {error}
        </p>
      )}
      {!actualRight ? (
        <section className="rr-empty">
          <h2 className="rdd-section-title">A rivalry is waiting to happen.</h2>
          <p>Another active league player will appear here when they join.</p>
          <Link href="/profiles">See league profiles</Link>
        </section>
      ) : (
        <>
          <div ref={poster} className={`rr-fight rdd-inverse-actions ${tv ? "rr-tv" : ""}`}>
            <div className="rr-fight-top">
              <span className="rr-eyebrow">
                {selectedChallenge
                  ? statusLabel(selectedChallenge.state)
                  : "Your featured rivalry"}
              </span>
              <ActionButton onClick={() => void television()}>
                {tv ? "Exit TV view" : "TV view ⛶"}
              </ActionButton>
            </div>
            <div className="rr-headline">
              <span>
                {selectedChallenge ? "THE NEXT CHAPTER" : "THE STORY SO FAR"}
              </span>
              <h2>{heading}</h2>
              <p>
                {selectedChallenge
                  ? `${selectedChallenge.schedule.title} · ${new Date(selectedChallenge.schedule.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
                  : rivalry.story}
              </p>
            </div>
            <div className="rr-faceoff">
              <div className="rr-contender">
                <PlayerAvatar
                  playerId={left}
                  name={names[0]}
                  avatarId={avatarIds[0]}
                  size={360}
                  portrait
                />
                <div className="rr-player-name">
                  <small>{left === userId ? "YOU" : "CONTENDER"}</small>
                  <Link href={`/profiles/${left}`}>{names[0]}</Link>
                  <PlayerAvatarName avatarId={avatarIds[0]} className="rr-avatar-name" />
                </div>
              </div>
              <div className="rr-score">
                <span>{selectedChallenge ? "GAMES WON" : "LIFETIME WINS"}</span>
                <strong>
                  {score[0]}
                  <i>:</i>
                  {score[1]}
                </strong>
                <b>VS</b>
              </div>
              <div className="rr-contender rr-right">
                <PlayerAvatar
                  playerId={actualRight}
                  name={names[1]}
                  avatarId={avatarIds[1]}
                  size={360}
                  portrait
                  flip
                />
                <div className="rr-player-name">
                  <small>{actualRight === userId ? "YOU" : "THE RIVAL"}</small>
                  <Link href={`/profiles/${actualRight}`}>{names[1]}</Link>
                  <PlayerAvatarName avatarId={avatarIds[1]} className="rr-avatar-name" />
                </div>
              </div>
            </div>
            <div className="rr-fight-bottom">
              <p>{terms}</p>
              <div className="rr-actions">
                {!selectedChallenge && personal && (
                  <ActionButton
                    variant="primary"
                    disabled={locked}
                    onClick={() => setModal("challenge")}
                  >
                    Challenge {left === userId ? names[1] : names[0]}{" "}
                    <span>↗</span>
                  </ActionButton>
                )}
                <ActionButton
                  className="rr-poster-button"
                  onClick={() => setModal("poster")}
                >
                  Make a fight poster
                </ActionButton>
              </div>
            </div>
          </div>
          {selectedChallenge ? (
            <section className="rr-panel rr-series">
              <div>
                <span className="rr-eyebrow">
                  Best of {selectedChallenge.best_of} games · first to{" "}
                  {selectedChallenge.target}
                </span>
                <h2 className="rdd-section-title">
                  {safeWinner
                    ? `${nameOf(data.profiles.find((p) => p.id === safeWinner))} takes the series.`
                    : statusLabel(selectedChallenge.state)}
                </h2>
                <p>{terms}</p>
                <p>
                  {selectedChallenge.schedule.venue ?? "Venue to be confirmed"}{" "}
                  ·{" "}
                  {selectedChallenge.schedule.status === "cancelled"
                    ? "Scheduled night cancelled"
                    : new Date(
                        selectedChallenge.schedule.starts_at,
                      ).toLocaleString()}
                </p>
              </div>
              <div className="rr-actions">
                {personal &&
                  selectedChallenge.state === "pending" &&
                  (userId === selectedChallenge.recipient ? (
                    <>
                      <ActionButton
                        variant="primary"
                        disabled={locked}
                        onClick={() => act("accept")}
                      >
                        Accept challenge
                      </ActionButton>
                      <ActionButton disabled={locked} onClick={() => act("decline")}>
                        Decline
                      </ActionButton>
                    </>
                  ) : (
                    <ActionButton disabled={locked} onClick={() => act("withdraw")}>
                      Withdraw invitation
                    </ActionButton>
                  ))}
                {personal &&
                  ["accepted", "in_progress"].includes(
                    selectedChallenge.state,
                  ) &&
                  !selectedChallenge.abandonment_by &&
                  !stale && (
                    <ActionLink variant="primary"
                      href={`/league-night?night=${selectedChallenge.night_id}&challenge=${selectedChallenge.id}`}
                    >
                      Record the next game ↗
                    </ActionLink>
                  )}
                {personal &&
                  selectedChallenge.state === "needs_reconfirmation" && (
                    <ActionButton
                      variant="primary"
                      disabled={
                        locked ||
                        selectedChallenge.schedule.status !== "scheduled"
                      }
                      onClick={() => act("reconfirm")}
                    >
                      I confirm the updated night
                    </ActionButton>
                  )}
                {personal &&
                  selectedChallenge.stored_state === "accepted" &&
                  selectedChallenge.games.length === 0 &&
                  selectedChallenge.state !== "completed" && (
                    <ActionButton disabled={locked} onClick={() => act("cancel")}>
                      Cancel this series
                    </ActionButton>
                  )}
              </div>
              {selectedChallenge.state === "needs_reconfirmation" && (
                <p>
                  Night details changed. Both players must review and confirm
                  the new details before continuing.{" "}
                  {selectedChallenge.sender_confirmed ===
                  selectedChallenge.schedule.event_revision
                    ? `${names[0]} confirmed. `
                    : ""}
                  {selectedChallenge.recipient_confirmed ===
                  selectedChallenge.schedule.event_revision
                    ? `${names[1]} confirmed.`
                    : ""}
                </p>
              )}
              <ol className="rr-game-list">
                {selectedChallenge.games.map((g, i) => (
                  <li key={g.id}>
                    <span className="rr-game-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>
                        {g.issue ??
                          `${nameOf(data.profiles.find((p) => p.id === g.winner))} won`}
                      </strong>
                      <small>{new Date(g.played_at).toLocaleString()}</small>
                    </div>
                    <Link
                      href={`/league-night?night=${selectedChallenge.night_id}`}
                    >
                      Match #{g.id}
                    </Link>
                    {personal && (
                      <ActionButton
                        disabled={locked}
                        onClick={() =>
                          act("unlink", {
                            match_id: g.id,
                            match_revision: g.revision,
                          })
                        }
                      >
                        Unlink result
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ol>
              {personal &&
                selectedChallenge.stored_state === "accepted" &&
                selectedChallenge.state !== "completed" && (
                  <details>
                    <summary>Series repair and resolution</summary>
                    <p>
                      Participants can repair the links in this series. Only the
                      original recorder can edit the underlying results.
                    </p>
                    <label>
                      Recorded game to link
                      <select value={repairId} disabled={locked} onChange={(e) => setRepairId(e.target.value)}>
                        <option value="">Choose an eligible recorded game</option>
                        {candidates.map((m) => (
                          <option key={m.id} value={m.id}>
                            {new Date(m.played_at).toLocaleString()} · {m.game_type} · {nameOf(data.profiles.find((p) => p.id === m.match_players?.find((player) => player.is_winner)?.player_id))} won · #{m.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <ActionButton
                      disabled={locked || !candidates.some((m) => m.id === Number(repairId))}
                      onClick={() => {
                        const match = candidates.find(
                          (m) => m.id === Number(repairId),
                        );
                        if (!match)
                          setError("Refresh and choose a recorded match.");
                        else
                          act("link", {
                            match_id: match.id,
                            match_revision: match.revision,
                          });
                      }}
                    >
                      Link recorded game
                    </ActionButton>
                    {!candidates.length && <p>No unlinked games match this challenge’s players, night and rules. Record a game from this challenge or refresh.</p>}
                    {selectedChallenge.abandonment_by ? (
                      <>
                        <p>
                          Abandonment proposed:{" "}
                          {selectedChallenge.abandonment_reason}
                        </p>
                        {selectedChallenge.abandonment_by !== userId && (
                          <ActionButton
                            disabled={locked}
                            onClick={() => act("confirm_abandon")}
                          >
                            Agree to abandon series
                          </ActionButton>
                        )}
                        <ActionButton
                          disabled={locked}
                          onClick={() =>
                            act(
                              selectedChallenge.abandonment_by === userId
                                ? "withdraw_abandon"
                                : "decline_abandon",
                            )
                          }
                        >
                          {selectedChallenge.abandonment_by === userId
                            ? "Withdraw abandonment proposal"
                            : "Continue the series"}
                        </ActionButton>
                      </>
                    ) : (
                      <>
                        <label>
                          Reason to stop this series
                          <textarea
                            maxLength={300}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </label>
                        <ActionButton
                          disabled={locked || !reason.trim()}
                          onClick={() => act("propose_abandon", { reason })}
                        >
                          Propose abandonment
                        </ActionButton>
                      </>
                    )}
                  </details>
                )}
              <Link href={`/rivalries/pair/${left}/${actualRight}`}>
                View lifetime rivalry ↗
              </Link>
              {data.feed.organizer &&
                selectedChallenge.stored_state === "accepted" &&
                selectedChallenge.state !== "completed" && (
                  <details>
                    <summary>Organizer resolution</summary>
                    <p>
                      Abandon the series with an audited reason. Recorded games
                      are kept and no series winner is assigned.
                    </p>
                    <label>
                      Resolution reason
                      <textarea
                        maxLength={300}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <ActionButton
                      disabled={locked || !reason.trim()}
                      onClick={() => act("resolve", { reason })}
                    >
                      Resolve as abandoned
                    </ActionButton>
                  </details>
                )}
            </section>
          ) : (
            <section className="rr-panel">
              <div className="rr-section-heading">
                <div>
                  <span className="rr-eyebrow">Every game leaves a mark</span>
                  <h2 className="rdd-section-title">The last encounters</h2>
                </div>
                <Link href={`/rivalries/pair/${left}/${actualRight}`}>
                  Open this rivalry ↗
                </Link>
              </div>
              <div className="rr-actions">
                <label>
                  Game
                  <select
                    value={gameFilter}
                    onChange={(e) => setGameFilter(e.target.value)}
                  >
                    <option value="">All singles games</option>
                    {[
                      ...new Set(
                        pairHistory.meetings
                          .map((m) => m.match.game_type)
                          .filter(Boolean),
                      ),
                    ].map((g) => (
                      <option key={g!}>{g}</option>
                    ))}
                    {gameFilter &&
                      !pairHistory.meetings.some(
                        (m) => m.match.game_type === gameFilter,
                      ) && <option>{gameFilter}</option>}
                  </select>
                </label>
                <label>
                  Board
                  <select
                    value={boardFilter}
                    onChange={(e) => setBoardFilter(e.target.value)}
                  >
                    <option value="">All boards, including unknown</option>
                    <option>Steel Tip</option>
                    <option>Soft Tip</option>
                  </select>
                </label>
              </div>
              {!rivalry.meetings.length ? (
                <p>
                  No recorded competitive singles meetings in this view. Start a
                  new chapter together.
                </p>
              ) : (
                <ol className="rr-game-list">
                  {rivalry.meetings
                    .slice(-5)
                    .reverse()
                    .map(({ match, winner }) => (
                      <li key={match.id}>
                        <PlayerAvatar
                          playerId={winner}
                          name={nameOf(
                            data.profiles.find((p) => p.id === winner),
                          )}
                          size={48}
                        />
                        <div>
                          <strong>
                            {nameOf(data.profiles.find((p) => p.id === winner))}{" "}
                            won
                          </strong>
                          <small>
                            {match.game_type ?? "Unknown game"} ·{" "}
                            {match.board_type ?? "Unknown board"} ·{" "}
                            {presetLabel(match.game_type, match.game_config)} ·{" "}
                            {new Date(match.played_at).toLocaleDateString()}
                          </small>
                        </div>
                        <span>#{match.id}</span>
                      </li>
                    ))}
                </ol>
              )}
              {scoreCohorts(rivalry, left).some((c) => c.average !== null) && (
                <details>
                  <summary>Your averages by game, board and rules</summary>
                  {scoreCohorts(rivalry, left).map((c) => (
                    <p key={c.label}>
                      {c.label}:{" "}
                      {c.average === null
                        ? "No recorded scores"
                        : `${c.average.toFixed(2)} from ${c.scores.length} recorded scores`}
                    </p>
                  ))}
                </details>
              )}
              <p className="rr-muted">
                Team games, practice, handicaps and unresolved results stay
                outside this series. Unknown historical rules remain unknown.
              </p>
            </section>
          )}
        </>
      )}
      {!selectedChallenge && !pair && (
        <section className="rr-rivals">
          <div className="rr-section-heading">
            <div>
              <span className="rr-eyebrow">Who’s next?</span>
              <h2 className="rdd-section-title">Your cast of rivals</h2>
            </div>
            <label>
              Find a player
              <select
                aria-label="Choose rival"
                value={actualRight}
                onChange={(e) => setOpponent(e.target.value)}
              >
                {data.profiles
                  .filter(
                    (p) =>
                      p.id !== left && data.feed.active_users.includes(p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {nameOf(p)} · {ratingLabel(p.id)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="rr-muted">
            Current Power Rating across all games and boards. Provisional until
            10 evidence games; players without rated matches start at 1,500.
          </p>
          <div className="rr-rival-grid">
            {rivals.slice(0, 6).map((r) => (
              <ActionButton
                className={`rr-rival ${actualRight === r.opponent ? "rr-selected" : ""}`}
                key={r.opponent}
                onClick={() => setOpponent(r.opponent)}
                aria-pressed={actualRight === r.opponent}
                aria-label={`${nameOf(data.profiles.find((p) => p.id === r.opponent))} · ${ratingLabel(r.opponent)} · ${r.wins[0]} to ${r.wins[1]} recorded singles wins`}
              >
                <PlayerAvatar
                  playerId={r.opponent}
                  name={nameOf(data.profiles.find((p) => p.id === r.opponent))}
                  size={88}
                />
                <strong>
                  {nameOf(data.profiles.find((p) => p.id === r.opponent))}
                </strong>
                <span className="rr-rival-rating">
                  Power Rating <b>{Math.round(ratingOf(r.opponent).rating).toLocaleString("en-US")}</b>
                  {ratingOf(r.opponent).provisional && <small>Provisional</small>}
                </span>
                <span>
                  {r.wins[0]} : {r.wins[1]} <small>recorded singles wins</small>
                </span>
              </ActionButton>
            ))}
          </div>
        </section>
      )}
      <section className="rr-panel">
        <div className="rr-section-heading">
          <div>
            <span className="rr-eyebrow">Settle it on the board</span>
            <h2 className="rdd-section-title">Your challenges</h2>
          </div>
          <Link href="/league-night/plan">Plan a league night ↗</Link>
        </div>
        {data.feed.challenges.filter((c) =>
          [c.sender, c.recipient].includes(userId),
        ).length ? (
          data.feed.challenges
            .filter((c) => [c.sender, c.recipient].includes(userId))
            .map((c) => (
              <Link
                className="rr-challenge-row"
                key={c.id}
                href={`/rivalries/challenges/${c.id}`}
              >
                <div>
                  <strong>
                    {nameOf(data.profiles.find((p) => p.id === c.sender))} vs{" "}
                    {nameOf(data.profiles.find((p) => p.id === c.recipient))}
                  </strong>
                  <small>
                    {c.game} · Best of {c.best_of} games · {c.schedule.title}
                  </small>
                </div>
                <span>
                  {statusLabel(c.state)} · {c.wins.join(" : ")} ↗
                </span>
              </Link>
            ))
        ) : (
          <p>
            No challenges yet. Pick a rival and invite them to a scheduled
            League Night.
          </p>
        )}
      </section>
      {op.pending && (
        <section className="rr-panel" role="status">
          <h2 className="rdd-section-title">Check your pending action</h2>
          <p>
            Your {op.pending.payload.action.replaceAll("_", " ")} action needs
            confirmation. Its original details are kept.
          </p>
          <ActionButton
            variant="primary"
            disabled={op.busy}
            onClick={() => void op.submit()}
          >
            Check the same attempt
          </ActionButton>
        </section>
      )}
      {op.error && (
        <p role="alert" className="rr-error">
          {op.error}{" "}
          <ActionButton onClick={() => void refresh()}>Refresh latest details</ActionButton>
        </p>
      )}
      <footer className="rr-footnote">
        Real rivalries. Recorded results. No extra rating points for a
        challenge.
      </footer>
      {modal && (
        <dialog
          ref={dialog}
          className="rr-dialog rr-consistent rdd-form-controls"
          onCancel={() => setModal(null)}
        >
          <div className="rr-section-heading">
            <h2 className="rdd-section-title">
              {modal === "challenge"
                ? "Write the next chapter."
                : "Your fight poster."}
            </h2>
            <ActionButton aria-label="Close dialog" onClick={() => setModal(null)}>
              ✕
            </ActionButton>
          </div>
          {modal === "poster" ? (
            <RivalryPoster
              key={JSON.stringify([names, avatarIds, heading, score, terms])}
              userId={userId}
              names={names}
              avatars={avatarIds}
              headline={heading}
              score={score.join(" : ")}
              terms={terms}
              href={
                selectedChallenge
                  ? `/rivalries/challenges/${selectedChallenge.id}`
                  : `/rivalries/pair/${left}/${actualRight}`
              }
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void op.submit({
                  action: "create",
                  id: crypto.randomUUID(),
                  recipient: challengeRecipient,
                  night_id: night,
                  game,
                  preset,
                  board,
                  best_of: bestOf,
                });
              }}
            >
              <p>{names.join(" vs ")} · Competitive singles</p>
              <div className="rr-form-grid">
                <label>
                  Game
                  <select
                    disabled={locked}
                    value={game}
                    onChange={(e) => {
                      setGame(e.target.value);
                      setPreset(gameDefinition(e.target.value)!.presets[0].id);
                    }}
                  >
                    <option>501</option>
                    <option>301</option>
                    <option>Cricket</option>
                  </select>
                </label>
                <label>
                  Rules
                  <select
                    disabled={locked}
                    value={preset}
                    onChange={(e) => setPreset(e.target.value)}
                  >
                    {gameDefinition(game)!.presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Board
                  <select
                    disabled={locked}
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                  >
                    <option>Steel Tip</option>
                    <option>Soft Tip</option>
                  </select>
                </label>
                <label>
                  Series
                  <select
                    disabled={locked}
                    value={bestOf}
                    onChange={(e) => setBestOf(Number(e.target.value))}
                  >
                    {[3, 5, 7].map((n) => (
                      <option key={n} value={n}>
                        Best of {n} games · first to {(n + 1) / 2}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rr-full-field">
                  Scheduled League Night
                  <select
                    required
                    disabled={locked}
                    value={night}
                    onChange={(e) => setNight(e.target.value)}
                  >
                    <option value="">Choose an upcoming night</option>
                    {data.feed.nights.map((n) => (
                      <option key={n.night_id} value={n.night_id}>
                        {n.title} · {new Date(n.starts_at).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="rr-muted">
                The invitation expires in seven days or when the night starts.
                Acceptance keeps RSVP and attendance separate.
              </p>
              <ActionButton type="submit" variant="primary" disabled={locked || !night}>
                Send challenge ↗
              </ActionButton>
              {!data.feed.nights.length && (
                <p>
                  No upcoming scheduled nights.{" "}
                  <Link href="/league-night/plan">Plan one first</Link>.
                </p>
              )}
              {op.error && <p role="alert">{op.error}</p>}
            </form>
          )}
        </dialog>
      )}
    </main>
  );
}
