"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/league-night/use-current-user";
import { loadMatches } from "@/lib/league-night/api";
import { gameDefinition, parseGameScore } from "@/lib/games/catalog";
import { resolvePlayedAtIso, toLocalDateTimeInput } from "@/lib/dateTime";
import {
  loadSoloGames,
  loadSoloNights,
  loadSoloProfile,
  soloVisibility,
  setSoloVisibility,
  writeSolo,
  definiteRejection,
  soloError,
} from "@/lib/solo/api";
import {
  clearOperation,
  draftStorageKey,
  readOperations,
  retainOperation,
} from "@/lib/solo/recovery";
import {
  localDay,
  profileSummary,
  soloEligible,
  soloScore,
} from "@/lib/solo/analysis";
import type {
  SoloCohort,
  SoloFilter,
  SoloGame,
  SoloGameType,
  SoloOperation,
  SoloWrite,
} from "@/lib/solo/types";
import type { LeagueNight, NightMatch } from "@/lib/league-night/types";
import { PracticePerformance } from "./PracticePerformance";
import "@/app/solo/solo.css";
type Draft = {
  entryId: string;
  game: SoloGameType;
  board: "Steel Tip" | "Soft Tip";
  preset: string;
  score: string;
  unit: "3DA" | "PPD" | "MPR";
  status: "completed" | "stopped";
  played: string;
  completed: string;
  raw: string;
  darts: string;
  include: boolean;
  night: string;
  share: boolean;
  notes: string;
  location: string;
  id: string | null;
  revision: number | null;
  session: string;
  original: string | null;
  completionOriginal?: string | null;
  timezone?: string;
};
const fresh = (): Draft => ({
  entryId: crypto.randomUUID(),
  game: "501",
  board: "Steel Tip",
  preset: "unspecified",
  score: "",
  unit: "3DA",
  status: "completed",
  played: toLocalDateTimeInput(new Date()),
  completed: "",
  raw: "",
  darts: "",
  include: true,
  night: "",
  share: false,
  notes: "",
  location: "",
  id: null,
  revision: null,
  session: crypto.randomUUID(),
  original: null,
});
export default function SoloPage() {
  const { user, loading } = useCurrentUser();
  return (
    <main className="solo-shell">
      <header className="solo-hero">
        <p className="solo-eyebrow">THE GAME BETWEEN GAME NIGHTS</p>
        <h1>Solo Play.</h1>
        <p>
          Your board. Your pace. Log your games, find your rhythm, and make the
          next game a little better.
        </p>
        <div className="solo-hero-tags">
          <span>Anywhere, anytime</span>
          <span>Personal progress</span>
          <span>Always unranked</span>
        </div>
      </header>
      {loading ? (
        <p role="status">Opening your practice space…</p>
      ) : user ? (
        <SoloEditor key={user.id} owner={user.id} />
      ) : (
        <section className="solo-panel">
          <h2>Get a game in.</h2>
          <p>
            Sign in to keep your personal practice history and explore how your
            solo and league play change over time.
          </p>
          <Link className="solo-primary" href="/auth">
            Sign in to log a game
          </Link>
        </section>
      )}
    </main>
  );
}
function SoloEditor({ owner }: { owner: string }) {
  const [draft, setDraft] = useState<Draft>(fresh),
    [restored, setRestored] = useState(false),
    [tab, setTab] = useState("log");
  const [games, setGames] = useState<SoloGame[]>([]),
    [nights, setNights] = useState<LeagueNight[]>([]),
    [history, setHistory] = useState<NightMatch[]>([]),
    [cohorts, setCohorts] = useState<SoloCohort[]>([]);
  const [error, setError] = useState(""),
    [analysisError, setAnalysisError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [soloReady, setSoloReady] = useState(false),
    [contextReady, setContextReady] = useState(false),
    [receipt, setReceipt] = useState(""),
    [shared, setShared] = useState(false),
    [visibilityKnown, setVisibilityKnown] = useState(false),
    [operations, setOperations] = useState<SoloOperation[]>([]),
    [undo, setUndo] = useState<{ id: string; revision: number } | null>(null),
    [scope, setScope] = useState<"league" | "solo" | "all">("solo");
  const [filter, setFilter] = useState<SoloFilter>({
    game: "501",
    board: "Steel Tip",
    preset: "unspecified",
  });
  const live = useRef(true),
    loadGeneration = useRef(0),
    visibilityWriting = useRef(false),
    scoreRef = useRef<HTMLInputElement>(null),
    submitting = useRef(false),
    storageKey = useRef("");
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  const refresh = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const current = () => live.current && generation === loadGeneration.current;
    setLoading(true);
    setSoloReady(false);
    setContextReady(false);
    setError("");
    setAnalysisError("");
    try {
      const [solo, profile, visibility] = await Promise.all([
        loadSoloGames(owner),
        loadSoloProfile(owner),
        soloVisibility(),
      ]);
      if (!current()) return;
      setGames(solo);
      setCohorts(profile ?? []);
      if (!visibilityWriting.current) {
        setShared(visibility);
        setVisibilityKnown(true);
      }
      setSoloReady(true);
    } catch (cause) {
      if (current()) setError(soloError(cause));
    } finally {
      if (current()) setLoading(false);
    }
    try {
      const [allNights, matches] = await Promise.all([
        loadSoloNights(),
        loadMatches(),
      ]);
      if (!current()) return;
      setNights(allNights);
      setHistory(matches);
      setAnalysisError("");
      setContextReady(true);
    } catch (cause) {
      if (current())
        setAnalysisError(
          `League context could not be loaded. ${soloError(cause)}`,
        );
    }
  }, [owner]);
  useEffect(() => {
    live.current = true;
    try {
      storageKey.current = draftStorageKey(owner);
      const saved = JSON.parse(
        localStorage.getItem(storageKey.current) ?? "null",
      );
      if (
        saved?.version === 1 &&
        saved.owner === owner &&
        Date.now() - saved.savedAt < 86400000 &&
        ["501", "301", "701", "Cricket"].includes(saved.draft?.game) &&
        typeof saved.draft.score === "string"
      )
        setDraft({
          ...saved.draft,
          entryId: saved.draft.entryId ?? crypto.randomUUID(),
        });
      setOperations(readOperations(owner));
    } catch {
      setError(
        "Device storage is unavailable. Save recovery needs working browser storage.",
      );
    }
    setRestored(true);
    void refresh();
    const onFocus = () => {
      void refresh();
      try {
        setOperations(readOperations(owner));
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    const onStorage = () => {
      try {
        setOperations(readOperations(owner));
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [owner, refresh]);
  useEffect(() => {
    if (!restored || !storageKey.current) return;
    try {
      localStorage.setItem(
        storageKey.current,
        JSON.stringify({ version: 1, owner, savedAt: Date.now(), draft }),
      );
    } catch {
      // A browser storage failure is an external-system error that must be visible.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        "Could not keep this draft on the device. Check browser storage before saving.",
      );
    }
  }, [draft, restored, owner]);
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  const active = useMemo(
    () =>
      games
        .filter((g) => !g.deleted_at)
        .sort(
          (a, b) =>
            b.played_at.localeCompare(a.played_at) || b.id.localeCompare(a.id),
        ),
    [games],
  );
  const benchmark = active
    .filter((g) =>
      soloEligible(g, {
        game: draft.game,
        board: draft.board,
        preset: draft.preset,
      }),
    )
    .map(soloScore)
    .filter((v): v is number => v !== null);
  async function submit(operation: SoloOperation) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      retainOperation(owner, operation);
      setOperations(readOperations(owner));
      const result = await writeSolo(operation);
      if (!live.current) return;
      clearOperation(owner, operation.operationId);
      setOperations(readOperations(owner));
      setReceipt(
        `${result.replayed ? "Previous operation confirmed" : "Saved"} · ${operation.payload.action === "delete" ? "Game deleted" : operation.payload.action === "restore" ? "Game restored" : result.deleted ? "This game has since been deleted" : `${operation.payload.game_type} · ${operation.payload.score ?? "No score"} ${operation.payload.score_unit}`} · League rankings unchanged.`,
      );
      if (operation.payload.action === "delete")
        setUndo({ id: result.id, revision: result.revision });
      if (operation.payload.action === "restore") setUndo(null);
      if (operation.payload.action === "save") {
        setDraft((d) =>
          operation.payload.id === (d.id ?? d.entryId)
            ? {
                ...d,
                entryId: crypto.randomUUID(),
                // Completion is a per-game outcome; preserve practice settings.
                status: "completed",
                score: "",
                raw: "",
                darts: "",
                completed: "",
                notes: "",
                id: null,
                revision: null,
                original: null,
                completionOriginal: null,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                played: toLocalDateTimeInput(new Date()),
              }
            : d,
        );
        if (operation.again) scoreRef.current?.focus();
      }
      await refresh();
    } catch (cause) {
      if (!live.current) return;
      if (definiteRejection(cause)) {
        clearOperation(owner, operation.operationId);
        setOperations(readOperations(owner));
      }
      setError(
        `${soloError(cause)}${definiteRejection(cause) ? "" : " Checking save: use Check / retry below before starting another operation."}`,
      );
    } finally {
      submitting.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function save(again: boolean) {
    try {
      const normalized = parseGameScore(
        draft.score,
        draft.game,
        draft.unit === "PPD" ? "ppd" : "3da",
      );
      const score =
        normalized === null
          ? null
          : draft.unit === "PPD"
            ? normalized / 3
            : normalized;
      const played = resolvePlayedAtIso(draft.played, draft.original);
      const completed =
        draft.completed && draft.status === "completed"
          ? resolvePlayedAtIso(
              draft.completed,
              draft.completionOriginal ?? null,
            )
          : null;
      if (completed && Date.parse(completed) < Date.parse(played))
        throw Error("Completion time must be after the time played.");
      if (
        draft.night &&
        !nights.some(
          (n) => n.id === draft.night && n.night_date === localDay(played),
        )
      )
        throw Error(
          "The selected night has a different date. Change the played time or keep the game unlinked.",
        );
      if (
        (draft.raw !== "" && draft.darts === "") ||
        (draft.raw === "" && draft.darts !== "")
      )
        throw Error("Raw totals and darts must be supplied together.");
      const payload: SoloWrite = {
        action: "save",
        submitted_by: owner,
        id: draft.id ?? draft.entryId,
        expected_revision: draft.revision,
        session_id: draft.session,
        played_at: played,
        completed_at: draft.status === "completed" ? completed : null,
        timezone:
          draft.original === played && draft.timezone
            ? draft.timezone
            : Intl.DateTimeFormat().resolvedOptions().timeZone,
        game_type: draft.game,
        board_type: draft.board,
        preset: draft.preset,
        status: draft.status,
        score,
        score_unit: draft.unit,
        raw_total: draft.raw === "" ? null : Number(draft.raw),
        darts: draft.darts === "" ? null : Number(draft.darts),
        include_in_stats: draft.include,
        night_id: draft.night || null,
        share_with_night: !!draft.night && draft.share,
        notes: draft.notes,
        location: draft.location,
      };
      await submit({ operationId: crypto.randomUUID(), payload, again });
    } catch (cause) {
      setError(soloError(cause));
    }
  }
  function edit(g: SoloGame) {
    if (operations.length || busy) return;
    setDraft({
      entryId: g.id,
      game: g.game_type,
      board: g.board_type,
      preset: g.preset,
      score: g.score === null ? "" : String(g.score),
      unit: g.score_unit,
      status: g.status,
      played: toLocalDateTimeInput(g.played_at),
      completed: g.completed_at ? toLocalDateTimeInput(g.completed_at) : "",
      raw: g.raw_total === null ? "" : String(g.raw_total),
      darts: g.darts === null ? "" : String(g.darts),
      include: g.include_in_stats,
      night: g.night_id ?? "",
      share: g.share_with_night,
      notes: g.notes,
      location: g.location,
      id: g.id,
      revision: g.revision,
      session: g.session_id,
      original: g.played_at,
      completionOriginal: g.completed_at,
      timezone: g.timezone,
    });
    setTab("log");
    setReceipt("");
  }
  const stats = profileSummary(cohorts, history, owner, filter, scope);
  const disabled = busy || operations.length > 0;
  return (
    <>
      <nav className="solo-tabs" aria-label="Solo Play">
        <button aria-pressed={tab === "log"} onClick={() => setTab("log")}>
          Log a game
        </button>
        <button
          aria-pressed={tab === "progress"}
          onClick={() => setTab("progress")}
        >
          Your progress
        </button>
        <button
          aria-pressed={tab === "history"}
          onClick={() => setTab("history")}
        >
          History
        </button>
        <button
          className="solo-refresh"
          onClick={() => void refresh()}
          disabled={busy}
        >
          Refresh
        </button>
      </nav>
      {error && (
        <p className="solo-alert" role="alert">
          {error}
        </p>
      )}
      {receipt && (
        <p className="solo-receipt" role="status">
          {receipt}
        </p>
      )}
      {!!operations.length && (
        <section className="solo-panel">
          <h2>Check your previous save</h2>
          <p>
            These submitted entries stay on this device until their outcome is
            confirmed. Return with the same account to reconcile them.
          </p>
          {operations.map((op) => (
            <div key={op.operationId} className="solo-history-row">
              <span>
                {op.payload.game_type ?? op.payload.action} ·{" "}
                {op.payload.score ?? "No score"}
              </span>
              <button onClick={() => void submit(op)} disabled={busy}>
                Check / retry save
              </button>
            </div>
          ))}
        </section>
      )}
      {undo && (
        <p className="solo-receipt">
          Game deleted.{" "}
          <button
            disabled={disabled}
            onClick={() =>
              void submit({
                operationId: crypto.randomUUID(),
                payload: {
                  action: "restore",
                  submitted_by: owner,
                  id: undo.id,
                  expected_revision: undo.revision,
                },
                again: false,
              })
            }
          >
            Undo deletion
          </button>
        </p>
      )}
      {tab === "log" && (
        <div className="solo-layout">
          <form
            className="solo-panel"
            onSubmit={(e) => {
              e.preventDefault();
              void save(false);
            }}
          >
            <div className="solo-heading">
              <h2>{draft.id ? "Edit your game" : "Get a game in."}</h2>
              <span className="solo-tag">SOLO · UNRANKED</span>
            </div>
            <fieldset disabled={disabled} className="solo-fields">
              <div>
                <span id="solo-game-label">What did you play?</span>
                <div
                  className="solo-games"
                  role="group"
                  aria-labelledby="solo-game-label"
                >
                  {(["501", "301", "701", "Cricket"] as SoloGameType[]).map((game) => (
                    <button
                      type="button"
                      key={game}
                      aria-pressed={draft.game === game}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          game,
                          preset: "unspecified",
                          unit: game === "Cricket" ? "MPR" : "3DA",
                          score: "",
                          raw: "",
                          darts: "",
                        }))
                      }
                    >
                      {game}
                    </button>
                  ))}
                </div>
              </div>
              <div className="solo-form-row">
                <label>
                  Board
                  <select
                    aria-label="Board"
                    value={draft.board}
                    onChange={(e) =>
                      change("board", e.target.value as Draft["board"])
                    }
                  >
                    <option>Steel Tip</option>
                    <option>Soft Tip</option>
                  </select>
                </label>
                <label>
                  Rule preset
                  <select
                    aria-label="Rule preset"
                    value={draft.preset}
                    onChange={(e) => change("preset", e.target.value)}
                  >
                    <option value="unspecified">Rules unspecified</option>
                    {gameDefinition(draft.game)?.presets.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Game average
                <div className="solo-score-field">
                  <input
                    aria-label="Game average"
                    ref={scoreRef}
                    value={draft.score}
                    onChange={(e) => change("score", e.target.value)}
                    placeholder={
                      draft.game === "Cricket" ? "e.g. 2.4" : "e.g. 58.4"
                    }
                    inputMode="decimal"
                    type="number"
                    min="0"
                    max={
                      draft.unit === "MPR" ? 9 : draft.unit === "PPD" ? 60 : 180
                    }
                    step="any"
                  />
                  <span>{draft.unit}</span>
                </div>
                <small>No average? You can still log the game.</small>
              </label>
              {draft.game !== "Cricket" && (
                <label className="solo-inline">
                  Input units
                  <select
                    aria-label="Input units"
                    value={draft.unit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        unit: e.target.value as Draft["unit"],
                        score: "",
                      }))
                    }
                  >
                    <option>3DA</option>
                    <option>PPD</option>
                  </select>
                </label>
              )}
              <div className="solo-context">
                <h3>Where are you throwing?</h3>
                <label>
                  League night (optional)
                  <select
                    aria-label="League night (optional)"
                    value={draft.night}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        night: e.target.value,
                        share: Boolean(e.target.value),
                      }))
                    }
                  >
                    <option value="">On my own · no night link</option>
                    {[...nights]
                      .sort((a, b) => b.night_date.localeCompare(a.night_date))
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.night_date} · {n.title} ·{" "}
                          {n.venue ?? "Venue unspecified"}
                        </option>
                      ))}
                  </select>
                </label>
                {draft.night && (
                  <>
                    <label className="solo-check">
                      <input
                        type="checkbox"
                        checked={draft.share}
                        onChange={(e) => change("share", e.target.checked)}
                      />
                      <span>
                        Show in this night’s practice activity
                        <small>
                          Your name, game, board, score and time are visible to
                          signed-in players who can view the night.
                        </small>
                      </span>
                    </label>
                    <Link href={`/league-night?night=${draft.night}`}>
                      Open league night →
                    </Link>
                  </>
                )}
              </div>
              <details>
                <summary>When, result &amp; extra details</summary>
                <label>
                  When played ·{" "}
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  <input
                    type="datetime-local"
                    value={draft.played}
                    onChange={(e) => change("played", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Result
                  <select
                    aria-label="Result"
                    value={draft.status}
                    onChange={(e) =>
                      change("status", e.target.value as Draft["status"])
                    }
                  >
                    <option value="completed">Completed</option>
                    <option value="stopped">
                      Stopped early · history only
                    </option>
                  </select>
                </label>
                {draft.status === "completed" && (
                  <label>
                    Completed at (optional)
                    <input
                      type="datetime-local"
                      value={draft.completed}
                      onChange={(e) => change("completed", e.target.value)}
                    />
                    <small>
                      Only supply a known completion time. It helps distinguish
                      same-day practice chronology.
                    </small>
                  </label>
                )}
                <label>
                  General location (private)
                  <input
                    value={draft.location}
                    onChange={(e) => change("location", e.target.value)}
                    maxLength={60}
                    placeholder="e.g. Home board"
                  />
                </label>
                <label>
                  Private notes
                  <textarea
                    value={draft.notes}
                    onChange={(e) => change("notes", e.target.value)}
                    maxLength={500}
                  />
                </label>
                <div className="solo-form-row">
                  <label>
                    {draft.game === "Cricket"
                      ? "Raw marks"
                      : "Net points scored"}
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={draft.raw}
                      onChange={(e) => change("raw", e.target.value)}
                    />
                  </label>
                  <label>
                    Darts thrown
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={draft.darts}
                      onChange={(e) => change("darts", e.target.value)}
                    />
                  </label>
                </div>
                <small>
                  Optional recorded raw totals, including bust darts in the
                  darts count. Never inferred from the average.
                </small>
              </details>
              <label className="solo-check">
                <input
                  type="checkbox"
                  checked={draft.include}
                  onChange={(e) => change("include", e.target.checked)}
                />
                <span>
                  Include in my profile stats
                  <small>
                    Personal Solo and All play views. Stopped games stay in
                    history only.
                  </small>
                </span>
              </label>
              <p className="solo-destinations">
                {draft.include && draft.status === "completed"
                  ? "✓ Personal stats"
                  : "— History only"}{" "}
                ·{" "}
                {draft.night && draft.share
                  ? "✓ Night practice"
                  : "— No shared night activity"}{" "}
                · Never league rankings
              </p>
              <div className="solo-actions">
                {!draft.id && (
                  <button
                    className="solo-primary"
                    type="button"
                    onClick={() => void save(true)}
                  >
                    Save &amp; play again <span aria-hidden="true">↗</span>
                  </button>
                )}
                <button
                  className={draft.id ? "solo-primary" : ""}
                  type="submit"
                >
                  {busy ? "Saving…" : draft.id ? "Save changes" : "Save game"}
                </button>
                {draft.id && (
                  <button type="button" onClick={() => setDraft(fresh())}>
                    Cancel edit
                  </button>
                )}
              </div>
              <p className="solo-small">
                Drafts remain on this device for 24 hours; submitted saves
                remain until checked.
              </p>
            </fieldset>
          </form>
          <aside className="solo-sidebar">
            <section className="solo-best">
              <p className="solo-eyebrow">YOUR PERSONAL BENCHMARK</p>
              <strong>
                {soloReady && benchmark.length
                  ? Math.max(...benchmark).toFixed(1)
                  : "—"}{" "}
                <span>{draft.game === "Cricket" ? "MPR" : "3DA"}</span>
              </strong>
              <h3>
                {benchmark.length
                  ? "One good game to chase."
                  : "Your next game starts it."}
              </h3>
              <p>
                {draft.game} · {draft.board} · {benchmark.length} scored games
              </p>
              <p className="solo-small">
                Same rule preset · Best reported game average
              </p>
            </section>
            <section className="solo-panel">
              <h3>Recent solo games</h3>
              {loading ? (
                <p role="status">Loading practice…</p>
              ) : !soloReady ? (
                <p role="status">
                  Practice history is unavailable. Use Refresh to try again.
                </p>
              ) : !active.length ? (
                <p className="solo-muted">
                  A home session or a few throws at the venue—log your first
                  game to start.
                </p>
              ) : (
                active.slice(0, 3).map((g) => (
                  <div className="solo-history-row" key={g.id}>
                    <div>
                      <strong>{g.game_type}</strong>
                      <small>
                        {new Date(g.played_at).toLocaleString()} ·{" "}
                        {g.night_id && g.share_with_night
                          ? "Night practice"
                          : "Personal"}
                      </small>
                    </div>
                    <strong>
                      {soloScore(g)?.toFixed(1) ?? "—"}{" "}
                      <small>{g.game_type === "Cricket" ? "MPR" : "3DA"}</small>
                    </strong>
                  </div>
                ))
              )}
            </section>
            <p className="solo-muted">
              <strong>Same venue. Your own game.</strong>
              <br />
              Linked solo games appear separately in night activity. Competitive
              records and awards use league results.
            </p>
          </aside>
        </div>
      )}
      {tab === "history" && (
        <section className="solo-panel">
          <h2>Your solo history</h2>
          <p className="solo-muted">
            Every saved game, including scores excluded from profile stats.
          </p>
          {loading ? (
            <p>Loading history…</p>
          ) : !soloReady ? (
            <p role="status">
              History could not be loaded. Use Refresh to try again.
            </p>
          ) : !active.length ? (
            <p>No solo games yet.</p>
          ) : (
            active.map((g) => (
              <article className="solo-history-row" key={g.id}>
                <div>
                  <strong>
                    {g.game_type} · {soloScore(g)?.toFixed(2) ?? "No score"}{" "}
                    {g.game_type === "Cricket" ? "MPR" : "3DA"}
                  </strong>
                  <small>
                    {new Date(g.played_at).toLocaleString()} · {g.board_type} ·{" "}
                    {g.preset} · {g.status}
                    {!g.include_in_stats ? " · Stats excluded" : ""}
                  </small>
                  {g.notes && <p>{g.notes}</p>}
                </div>
                <div className="solo-actions">
                  <button disabled={disabled} onClick={() => edit(g)}>
                    Edit
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete this solo game? You can undo after confirmation.",
                        )
                      )
                        void submit({
                          operationId: crypto.randomUUID(),
                          payload: {
                            action: "delete",
                            submitted_by: owner,
                            id: g.id,
                            expected_revision: g.revision,
                          },
                          again: false,
                        });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      )}
      {tab === "progress" && (
        <>
          <section className="solo-panel">
            <p className="solo-eyebrow">YOUR GAME, IN PERSPECTIVE</p>
            <h2>Personal progress.</h2>
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
                  {["501", "301", "701", "Cricket"].map((g) => (
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
            <div className="solo-scope">
              {(["league", "solo", "all"] as const).map((s) => (
                <button
                  key={s}
                  aria-pressed={scope === s}
                  onClick={() => setScope(s)}
                >
                  {s === "all"
                    ? "All play"
                    : s === "league"
                      ? "League"
                      : "Solo"}
                </button>
              ))}
            </div>
            {!soloReady ? (
              <p role="status">
                {loading
                  ? "Loading your solo summary…"
                  : "Your solo summary is unavailable. Use Refresh to try again."}
              </p>
            ) : analysisError && scope !== "solo" ? (
              <p role="alert">{analysisError}</p>
            ) : !contextReady && scope !== "solo" ? (
              <p role="status">Loading league scoring…</p>
            ) : (
              <div className="solo-metrics">
                <div>
                  <small>
                    {scope === "all"
                      ? "Games across both scopes"
                      : scope === "league"
                        ? "League games"
                        : "Solo games"}
                  </small>
                  <strong>{stats.games}</strong>
                  <small>
                    {stats.leagueGames} league + {stats.soloGames} solo
                  </small>
                </div>
                <div>
                  <small>Average of game averages</small>
                  <strong>
                    {stats.average?.toFixed(2) ?? "—"}{" "}
                    <span>{filter.game === "Cricket" ? "MPR" : "3DA"}</span>
                  </strong>
                  <small>
                    {stats.scored}/{stats.games} games scored
                  </small>
                </div>
                <div>
                  <small>
                    {scope === "solo"
                      ? "Personal best"
                      : "Solo contribution to rankings"}
                  </small>
                  <strong>
                    {scope === "solo"
                      ? (stats.best?.toFixed(2) ?? "—")
                      : "None"}
                  </strong>
                  <small>Compatible format, board and rules only</small>
                </div>
              </div>
            )}
            {soloReady && scope !== "league" && stats.rawSoloGames > 0 && (
              <p className="solo-small">
                <strong>
                  Exact solo {filter.game === "Cricket" ? "MPR" : "3DA"}:{" "}
                  {stats.exactSoloAverage?.toFixed(2)}
                </strong>{" "}
                · {stats.rawSoloGames}/{stats.soloGames} solo games with
                complete raw totals. Kept separate from reported game averages.
              </p>
            )}
            <p className="solo-small">
              Solo games have no wins, losses or rating. All play counts each
              game once.
            </p>
            <label className="solo-check">
              <input
                type="checkbox"
                checked={shared}
                disabled={busy || !soloReady || !visibilityKnown}
                onChange={async (e) => {
                  const next = e.target.checked;
                  visibilityWriting.current = true;
                  setReceipt("");
                  setShared(next);
                  setVisibilityKnown(false);
                  setBusy(true);
                  try {
                    await setSoloVisibility(next);
                    if (live.current) {
                      setVisibilityKnown(true);
                      setReceipt(
                        next
                          ? "Profile summary sharing confirmed. Individual history and practice analysis remain private."
                          : "Profile summary is private. Sharing has been turned off.",
                      );
                    }
                  } catch (cause) {
                    if (!live.current) return;
                    setError(soloError(cause));
                    try {
                      const current = await soloVisibility();
                      if (
                        live.current &&
                        (current === next || definiteRejection(cause))
                      ) {
                        setShared(current);
                        setVisibilityKnown(true);
                      }
                    } catch {
                      /* Unknown responses require a fresh read before another change. */
                    }
                  } finally {
                    visibilityWriting.current = false;
                    if (live.current) setBusy(false);
                  }
                }}
              />
              <span>
                Share my solo summaries on my profile
                <small>
                  Signed-in players may see aggregate Solo / All play scores.
                  Notes, locations, individual history and Practice &amp;
                  Performance remain private.
                </small>
              </span>
            </label>
            {soloReady && !visibilityKnown && (
              <p role="status">
                {busy
                  ? "Confirming profile visibility…"
                  : "Profile visibility is unconfirmed. Use Refresh to check before changing it again."}
              </p>
            )}
            <Link href={`/profiles/${owner}`}>View my profile →</Link>
          </section>
          {!soloReady || !contextReady ? (
            <section className="solo-panel">
              <h2>Practice &amp; Performance</h2>
              {analysisError ? (
                <p role="alert">{analysisError}</p>
              ) : (
                <p role="status">
                  {loading || soloReady
                    ? "Loading practice and league history…"
                    : "Solo history is unavailable; a complete comparison cannot be shown."}
                </p>
              )}
              {(analysisError || (!loading && !soloReady)) && (
                <button onClick={() => void refresh()}>Retry comparison</button>
              )}
            </section>
          ) : (
            <PracticePerformance
              games={games}
              history={history}
              nights={nights}
              owner={owner}
              filter={filter}
            />
          )}
        </>
      )}
    </>
  );
}
