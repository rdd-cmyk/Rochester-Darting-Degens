"use client";
import { previewCorrection } from '@/lib/games/correction';
import { GameOptions, GameResultDetails } from '@/components/GameOptions';
import { defaultConfig, gameUnit, isX01, hasCricketPoints } from '@/lib/games/catalog';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/league-night/use-current-user";
import { formatPlayerName } from "@/lib/playerName";
import { toLocalDateTimeInput, resolvePlayedAtIso } from "@/lib/dateTime";
import {
  loadAttendees,
  loadMatches,
  loadNight,
  loadNights,
  loadProfiles,
  setAttendance,
} from "@/lib/league-night/api";
import {
  decodeDraft,
  draftKey,
  freshDraft,
  nightEntryKey,
  nightOperationKey,
  readNightRecovery,
  readNightSavedEntries,
  retainNightEntry,
  type SavedNightEntry,
  type StoredDraft,
} from "@/lib/league-night/draft";
import {
  GAME_TYPES,
  isDefiniteSaveRejection,
  parseCricketPoints,
  parseScore,
  saveErrorMessage,
  saveMatch,
  validateMatchWrite,
} from "@/lib/league-night/match-write";
import { participantName, scoreSummary } from "@/lib/league-night/recap";
import type {
  Attendee,
  LeagueNight,
  NightDraft,
  NightMatch,
  PlayerProfile,
} from "@/lib/league-night/types";
import {
  NightRecapPanel,
  nightDate,
} from "@/components/league-night/NightRecapPanel";
import "./night.css";
import { NextPlannedNight } from "@/components/planning/NextPlannedNight";

export default function LeagueNightPage() {
  const { user, loading } = useCurrentUser();
  if (loading)
    return (
      <main className="night-shell">
        <p>Opening League Night…</p>
      </main>
    );
  if (!user)
    return (
      <main className="night-shell">
        <div className="night-panel">
          <h1>League Night</h1>
          <p>Sign in to join tonight, enter matches and see the recap.</p>
          <Link href="/auth">Sign in</Link>
        </div>
      </main>
    );
  return <NightLobby key={user.id} user={user} />;
}

function NightLobby({ user }: { user: User }) {
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [nights, setNights] = useState<LeagueNight[]>([]);
  const [night, setNight] = useState<LeagueNight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("League night");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState(() =>
    toLocalDateTimeInput(new Date()).slice(0, 10),
  );
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const creation = useRef<{
    id: string;
    title: string;
    venue: string;
    date: string;
  } | null>(null);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const [players, list] = await Promise.all([loadProfiles(), loadNights()]);
      const id = new URLSearchParams(window.location.search).get("night");
      const selected = id
        ? (list.find((n) => n.id === id) ?? (await loadNight(id)))
        : null;
      if (mounted.current) {
        setProfiles(players);
        setNights(list);
        setNight(selected);
      }
    } catch (cause) {
      if (mounted.current) setError(saveErrorMessage(cause));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load external data on mount; response updates follow the request.
    void refresh();
    const pop = () => void refresh();
    window.addEventListener("popstate", pop);
    return () => {
      mounted.current = false;
      window.removeEventListener("popstate", pop);
    };
  }, [refresh]);
  function open(n: LeagueNight | null) {
    window.history.pushState(
      {},
      "",
      n ? `/league-night?night=${n.id}` : "/league-night",
    );
    setNight(n);
  }
  async function create() {
    if (creating) return;
    setCreating(true);
    setError("");
    const prior = creation.current;
    const request =
      prior &&
      prior.title === title &&
      prior.venue === venue &&
      prior.date === date
        ? prior
        : { id: crypto.randomUUID(), title, venue, date };
    creation.current = request;
    try {
      const { data, error: failure } = await supabase.rpc("rdd_create_night", {
        p_id: request.id,
        p_title: request.title,
        p_venue: request.venue,
        p_date: request.date,
      });
      if (failure) throw failure;
      if (mounted.current) {
        setNights((list) => [data, ...list.filter((n) => n.id !== data.id)]);
        open(data);
        setShowCreate(false);
        creation.current = null;
      }
    } catch (cause) {
      if (mounted.current) setError(saveErrorMessage(cause));
    } finally {
      if (mounted.current) setCreating(false);
    }
  }
  if (night)
    return (
      <NightSession
        key={night.id}
        night={night}
        profiles={profiles}
        userId={user.id}
        onLeave={() => {
          open(null);
          void refresh();
        }}
      />
    );
  return (
    <main className="night-shell">
      <header className="night-hero">
        <p className="night-eyebrow">Rochester Darting Degens</p>
        <h1>
          Good darts.
          <br />
          Better company.
        </h1>
        <p>Open tonight’s night. Bring your game.</p>
      </header>
      <NextPlannedNight />
      {error && (
        <div className="night-warning" role="alert">
          {error} <button onClick={() => void refresh()}>Try again</button>
        </div>
      )}
      <div className="night-section-heading">
        <div>
          <h2>Find your night</h2>
          <p className="night-small">
            Anyone signed in can start a night or record results.
          </p>
        </div>
        <button
          className="night-primary"
          onClick={() => setShowCreate((value) => !value)}
        >
          Start a night
        </button>
      </div>
      {showCreate && (
        <form
          className="night-panel night-create"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <h2>Set the scene</h2>
          <label>
            Night name
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={60}
            />
          </label>
          <div className="night-form-row">
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label>
              Venue <span className="night-small">optional</span>
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                maxLength={49}
              />
            </label>
          </div>
          {nights.some((n) => n.night_date === date) && (
            <p className="night-warning">
              There’s already a night on this date. Check the list below before
              starting another.
            </p>
          )}
          <button className="night-primary" disabled={creating}>
            {creating ? "Starting…" : "Start night & choose who’s here"}
          </button>
        </form>
      )}
      {loading ? (
        <p role="status">Loading nights…</p>
      ) : nights.length ? (
        <div className="night-list">
          {nights.map((n) => (
            <button
              className="night-list-item"
              key={n.id}
              onClick={() => open(n)}
            >
              <span>
                <strong>{n.title}</strong>
                {n.planning_status === "cancelled" && (
                  <span className="night-warning">Cancelled</span>
                )}
                <span className="night-small">
                  {nightDate(n.night_date)}
                  {n.venue ? ` · ${n.venue}` : ""}
                </span>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      ) : (
        !error && (
          <div className="night-panel">
            <h2>Make tonight the first.</h2>
            <p>
              Start a night, choose who’s here, and everyone can enter their
              games.
            </p>
          </div>
        )
      )}
      <p className="night-small">
        Showing up to 40 recent nights. A shared night link also opens older
        nights. <Link href="/matches">Browse all matches</Link>.
      </p>
    </main>
  );
}

function NightSession({
  night,
  profiles: initialProfiles,
  userId,
  onLeave,
}: {
  night: LeagueNight;
  profiles: PlayerProfile[];
  userId: string;
  onLeave: () => void;
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [matches, setMatches] = useState<NightMatch[]>([]);
  const [history, setHistory] = useState<NightMatch[]>([]);
  const [draft, setDraft] = useState<NightDraft>(freshDraft);
  const [restore, setRestore] = useState<StoredDraft | null>(null);
  const [savedEntries, setSavedEntries] = useState<SavedNightEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [tabConflict, setTabConflict] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [correction, setCorrection] = useState<{key: string; result: ReturnType<typeof previewCorrection>} | null>(null);
  const [view, setView] = useState<"entry" | "recap">("entry");
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<number[]>([]);
  const [busyAttendance, setBusyAttendance] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [manage, setManage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");
  const mounted = useRef(true);
  const requestRevision = useRef(0);
  const historyRevision = useRef(0);
  const saveLock = useRef(false);
  const tabId = useRef("");
  const dirty = useRef(false);
  const storedKey = useRef("");
  const firstScore = useRef<HTMLInputElement>(null);
  const names = useMemo(() => new Map(
    profiles.map((p) => [
      p.id,
      formatPlayerName(
        p.display_name,
        p.first_name,
        p.include_first_name_in_display,
      ),
    ]),
  ), [profiles]);
  const locked =
    saving ||
    Boolean(draft.pending) ||
    Boolean(restore) ||
    tabConflict ||
    !ready;
  const refresh = useCallback(async () => {
    const version = ++requestRevision.current;
    setRefreshing(true);
    try {
      const [attendance, results, players] = await Promise.all([
        loadAttendees(night.id),
        loadMatches(night.id),
        loadProfiles(),
      ]);
      if (mounted.current && version === requestRevision.current) {
        setAttendees((current) =>
          attendance
            .map((row) => {
              const newer = current.find(
                (item) =>
                  item.player_id === row.player_id &&
                  item.revision > row.revision,
              );
              return newer ?? row;
            })
            .concat(
              current.filter(
                (row) =>
                  !attendance.some((item) => item.player_id === row.player_id),
              ),
            ),
        );
        setMatches(results);
        setProfiles(players);
        setRefreshError("");
        setRefreshedAt(
          new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        );
      }
    } catch (cause) {
      if (mounted.current && version === requestRevision.current)
        setRefreshError(saveErrorMessage(cause));
    } finally {
      if (mounted.current && version === requestRevision.current)
        setRefreshing(false);
    }
  }, [night.id]);
  const refreshHistory = useCallback(async () => {
    const version = ++historyRevision.current;
    setHistoryLoading(true);
    try {
      const rows = await loadMatches();
      if (mounted.current && version === historyRevision.current) {
        setHistory(rows);
        setHistoryError("");
      }
    } catch (cause) {
      if (mounted.current && version === historyRevision.current)
        setHistoryError(saveErrorMessage(cause));
    } finally {
      if (mounted.current && version === historyRevision.current)
        setHistoryLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Start the remote-results subscription and its loading indicator.
    void refresh();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20000);
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch complete remote history and show loading while it is in flight.
    if (view === "recap") void refreshHistory();
  }, [view, matches, refreshHistory]);
  // Browser recovery state is read after hydration; it cannot be read on the server.
  useEffect(() => {
    tabId.current = crypto.randomUUID();
    storedKey.current = draftKey(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? window.location.origin,
      userId,
      night.id,
    );
    try {
      const stored = readNightRecovery(localStorage, storedKey.current);
      if (stored) setRestore(stored);
      setSavedEntries(readNightSavedEntries(localStorage, storedKey.current));
    } catch {
      setStorageError(
        "This browser cannot store a recovery draft. Keep this page open until your save is confirmed.",
      );
    }
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith(storedKey.current + ":entry:")) {
        try {
          setSavedEntries(readNightSavedEntries(localStorage, storedKey.current));
        } catch {
          setStorageError("Saved entries could not refresh. Keep this page open until your save is confirmed.");
        }
      }
      if (
        event.key === storedKey.current ||
        event.key?.startsWith(storedKey.current + ":save:")
      ) {
        const stored = decodeDraft(event.newValue);
        if (stored && stored.tabId !== tabId.current) {
          setTabConflict(true);
          setRestore(stored);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [night.id, userId]);
  useEffect(() => {
    if (!ready || restore || tabConflict || !dirty.current) return;
    try {
      const stored: StoredDraft = {
        version: 1, savedAt: Date.now(), tabId: tabId.current, draft,
      };
      if (draft.recoveredEntryId && !draft.pending)
        localStorage.setItem(nightEntryKey(storedKey.current, draft.recoveredEntryId), JSON.stringify(stored));
      localStorage.setItem(storedKey.current, JSON.stringify(stored));
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Report an actual external-storage failure.
      setStorageError(
        "Recovery storage is unavailable. Keep this page open until your save is confirmed.",
      );
    }
  }, [draft, ready, restore, tabConflict]);
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, []);
  const releaseEntry = useCallback((submitted: NightDraft) => {
    const pending = submitted.pending;
    if (!pending) return;
    try {
      const retained = retainNightEntry(localStorage, storedKey.current, {
        version: 1, savedAt: Date.now(), tabId: tabId.current, draft: submitted,
      });
      setDraft({ ...retained.draft });
      setSavedEntries(readNightSavedEntries(localStorage, storedKey.current));
    } catch {
      // Leave the pending record and retry action intact if it cannot be retained.
      setStorageError("Could not retain this unsaved entry safely. Keep this page open and retry after freeing browser storage.");
    }
  }, []);
  function restoreEntry(entry: SavedNightEntry) {
    if (locked || !window.confirm("Replace the visible scorecard with this saved entry?")) return;
    try {
      // Reload the latest retained version, including any edits made before switching.
      const current = readNightSavedEntries(localStorage, storedKey.current)
        .find((item) => item.draft.recoveredEntryId === entry.draft.recoveredEntryId);
      setSavedEntries(readNightSavedEntries(localStorage, storedKey.current));
      if (!current) {
        setError("This saved entry expired or was discarded in another tab.");
        return;
      }
      dirty.current = true;
      setDraft({ ...current.draft });
      setDuplicates([]);
      setReceipt("");
      setError("Your unsaved entry is restored. Review it before saving; conflicted edits still need the latest saved match.");
    } catch {
      setStorageError("Saved entries are unavailable. Keep this scorecard open.");
    }
  }
  function discardEntry(entry: SavedNightEntry) {
    if (locked || !window.confirm("Discard this saved unsent entry? This does not delete any saved match.")) return;
    const id = entry.draft.recoveredEntryId;
    try {
      localStorage.removeItem(nightEntryKey(storedKey.current, id));
      const common = decodeDraft(localStorage.getItem(storedKey.current));
      if (!common?.draft.pending && common?.draft.recoveredEntryId === id)
        localStorage.removeItem(storedKey.current);
      if (draft.recoveredEntryId === id) {
        dirty.current = false;
        setDraft(freshDraft());
        setError("");
      }
      setSavedEntries(readNightSavedEntries(localStorage, storedKey.current));
    } catch {
      setStorageError("The saved entry could not be discarded. Keep this page open.");
    }
  }
  function update(change: Partial<NightDraft>) {
    dirty.current = true;
    setDraft((current) => ({ ...current, ...change }));
    setError("");
    setDuplicates([]);
  }
  function choosePlayer(id: string) {
    if (locked) return;
    const selected = draft.players.some((p) => p.playerId === id);
    if (!selected && draft.players.length >= 10) {
      setError("A match can have up to ten players.");
      return;
    }
    update({
      players: selected
        ? draft.players.filter((p) => p.playerId !== id)
        : [...draft.players, { playerId: id, score: "", points: "" }],
      winnerId: selected && draft.winnerId === id ? "" : draft.winnerId,
      gameConfig: draft.gameConfig ? {...draft.gameConfig, sides:Object.fromEntries(Object.entries(draft.gameConfig.sides).filter(([key]) => !selected || key !== id))} : null,
    });
  }
  async function attendance(playerId: string, present: boolean) {
    if (busyAttendance.includes(playerId)) return;
    setBusyAttendance((ids) => [...ids, playerId]);
    setError("");
    try {
      const previous = attendees.find((a) => a.player_id === playerId);
      const row = await setAttendance(
        night.id,
        playerId,
        present,
        previous?.revision ?? 0,
      );
      if (mounted.current)
        setAttendees((list) => {
          const newer = list.find(
            (a) => a.player_id === playerId && a.revision > row.revision,
          );
          return [
            ...list.filter((a) => a.player_id !== playerId),
            newer ?? row,
          ];
        });
    } catch (cause) {
      if (mounted.current) {
        setError(saveErrorMessage(cause));
        void refresh();
      }
    } finally {
      if (mounted.current)
        setBusyAttendance((ids) => ids.filter((id) => id !== playerId));
    }
  }
  function edit(match: NightMatch) {
    if (locked) return;
    setCorrection(null);
    if (
      dirty.current &&
      !window.confirm("Replace this unsaved scorecard with the saved match?")
    )
      return;
    update({
      players: (match.match_players ?? []).map((p) => ({
        playerId: p.player_id,
        score: p.score === null ? "" : String(p.score),
        points: p.points_scored === null ? "" : String(p.points_scored),
      })),
      winnerId: match.match_players?.find((p) => p.is_winner)?.player_id ?? "",
      game: match.game_type ?? "",
      gameConfig: match.game_config ?? null,
      board: match.board_type ?? "",
      mode: "3da",
      notes: match.notes ?? "",
      playedAt: toLocalDateTimeInput(match.played_at),
      liveTime: false,
      editId: match.id,
      revision: match.revision,
      recoveredEntryId: null,
      original: { playedAt: match.played_at, venue: match.venue },
      pending: null,
    });
    setView("entry");
    setReceipt("");
    firstScore.current?.focus();
  }
  const submit = useCallback(async (
    intent: "rematch" | "finish" | "edit",
    allowDuplicate = false,
  ) => {
    if (saveLock.current || restore || tabConflict) return;
    let pending = draft.pending;
    try {
      if (!pending) {
        if (draft.editId && !draft.original)
          throw new Error(
            "Reload the saved match before editing. Your draft is still here.",
          );
        const payload = validateMatchWrite({
          match_id: draft.editId,
          expected_revision: draft.revision,
          night_id: night.id,
          played_at: draft.liveTime
            ? new Date().toISOString()
            : resolvePlayedAtIso(
                draft.playedAt,
                draft.original?.playedAt ?? null,
              ),
          game_type: draft.game || null,
          game_config: draft.gameConfig ?? null,
          board_type: draft.board || null,
          venue: draft.editId ? draft.original!.venue : night.venue,
          notes: draft.notes || null,
          allow_duplicate: false,
          players: draft.players.map((p) => ({
            player_id: p.playerId,
            score: parseScore(p.score, draft.game, draft.mode),
            points_scored:
              hasCricketPoints(draft.game) ? parseCricketPoints(p.points) : null,
            is_winner: draft.gameConfig?.status && draft.gameConfig.status !== 'completed' ? false : draft.gameConfig && draft.gameConfig.format !== 'individual' ? Boolean(draft.gameConfig.sides[draft.winnerId] && draft.gameConfig.sides[p.playerId] === draft.gameConfig.sides[draft.winnerId]) : p.playerId === draft.winnerId,
          })),
        });
        if (draft.editId && matches.find(m => m.id === draft.editId)?.game_type !== draft.game && correction?.key !== JSON.stringify(payload)) {
          const history = await loadMatches();
          setCorrection({key: JSON.stringify(payload), result: previewCorrection(history, payload)});
          setError('Review the correction preview, then save again to apply it.');
          return;
        }
        pending = { operationId: crypto.randomUUID(), payload, intent };
      }
      if (allowDuplicate)
        pending = {
          ...pending,
          payload: { ...pending.payload, allow_duplicate: true },
        };
      // Persist the exact submission before sending, so refresh/retry uses its ID.
      const submitting = { ...draft, pending };
      dirty.current = true;
      setDraft(submitting);
      try {
        localStorage.setItem(
          nightOperationKey(storedKey.current, pending.operationId),
          JSON.stringify({
            version: 1,
            savedAt: Date.now(),
            tabId: tabId.current,
            draft: submitting,
          }),
        );
        localStorage.setItem(
          storedKey.current,
          JSON.stringify({
            version: 1,
            savedAt: Date.now(),
            tabId: tabId.current,
            draft: submitting,
          }),
        );
      } catch {
        setStorageError(
          "Recovery storage is unavailable. Keep this page open while checking the save.",
        );
      }
      saveLock.current = true;
      setSaving(true);
      setError("");
      // Once an override is sent, its result is unknown until acknowledged.
      // Do not leave an old duplicate response's discard action available.
      setDuplicates([]);
      const result = await saveMatch(
        pending.operationId,
        pending.payload,
        userId,
      );
      if (!mounted.current) return;
      if (result.status === "possible_duplicate") {
        setDuplicates(result.match_ids);
        void refresh();
        return;
      }
      const winnerNames = pending.payload.players.filter(p => p.is_winner).map(p => names.get(p.player_id) ?? "Player").join(" + ");
      setReceipt(
        `Saved match #${result.match_id} — ${winnerNames ? `${winnerNames} won.` : "Result recorded."}${result.replayed ? " Previous save confirmed." : ""}`,
      );
      setDuplicates([]);
      dirty.current = false;
      try {
        localStorage.removeItem(
          nightOperationKey(storedKey.current, pending.operationId),
        );
        const current = decodeDraft(localStorage.getItem(storedKey.current));
        if (current?.draft.pending?.operationId === pending.operationId)
          localStorage.removeItem(storedKey.current);
        // Only confirmation of this entry's own replacement clears its retained copy.
        if (draft.recoveredEntryId)
          localStorage.removeItem(nightEntryKey(storedKey.current, draft.recoveredEntryId));
        setSavedEntries(readNightSavedEntries(localStorage, storedKey.current));
        setRestore(readNightRecovery(localStorage, storedKey.current));
      } catch {
        /* Confirmation is still authoritative when storage is unavailable. */
      }
      setDraft((current) => ({
        ...freshDraft(),
        game: current.game,
        // Result status belongs to the saved game, not the next scorecard.
        gameConfig: current.gameConfig ? { ...current.gameConfig, status: "completed", sides: pending!.intent === "rematch" ? current.gameConfig.sides : {}, teamScores: {}, finish: "ordinary" } : null,
        board: current.board,
        mode: current.mode,
        players:
          pending!.intent === "rematch"
            ? current.players.map((p) => ({ ...p, score: "", points: "" }))
            : [],
      }));
      if (pending.intent === "finish") setView("recap");
      void refresh();
      requestAnimationFrame(() => firstScore.current?.focus());
    } catch (cause) {
      if (mounted.current) {
        setError(saveErrorMessage(cause));
        if (pending && isDefiniteSaveRejection(cause))
          releaseEntry({ ...draft, pending });
      }
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [draft, restore, tabConflict, night.id, night.venue, names, userId, refresh, releaseEntry, matches, correction]);
  const present = attendees.filter((a) => a.present);
  const pool = profiles.filter(
    (p) =>
      present.some((a) => a.player_id === p.id) ||
      draft.players.some((s) => s.playerId === p.id),
  );
  const recent = [...matches]
    .sort(
      (a, b) =>
        Date.parse(b.played_at) - Date.parse(a.played_at) || b.id - a.id,
    )
    .slice(0, 5);
  const currentUnit = isX01(draft.game) && draft.mode === 'ppd' ? 'PPD' : gameUnit(draft.game);
  const teamGame = Boolean(draft.gameConfig && draft.gameConfig.format !== 'individual');
  const needsWinner = !draft.gameConfig || draft.gameConfig.status === 'completed';
  return (
    <main className="night-shell">
      <header className="night-hero">
        <div className="night-section-heading">
          <p className="night-eyebrow">Rochester Darting Degens</p>
          <button
            className="night-hero-button"
            onClick={() => {
              if (
                !dirty.current ||
                window.confirm(
                  "Leave this night? Your recovery draft stays on this device.",
                )
              )
                onLeave();
            }}
          >
            Change night
          </button>
        </div>
        <h1>{night.title}</h1>
        {night.planning_status === "cancelled" && (
          <p className="night-warning" role="status">
            This league night was cancelled.
          </p>
        )}
        <p>
          {nightDate(night.night_date)}
          {night.venue ? ` · ${night.venue}` : ""}
        </p>
        <p className="night-hero-hint">Good darts. Better company.</p>
      </header>
      <div className="night-tabs">
        <button
          aria-pressed={view === "entry"}
          onClick={() => setView("entry")}
        >
          Record a match
        </button>
        <button
          aria-pressed={view === "recap"}
          onClick={() => setView("recap")}
        >
          Night recap
        </button>
        <span className="night-small">Everyone can enter results</span>
      </div>
      {error && (
        <div className="night-warning" role="alert">
          {error}
        </div>
      )}
      {refreshError && (
        <div className="night-warning" role="alert">
          Results may be out of date. {refreshError}{" "}
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
      )}
      {receipt && (
        <div className="night-receipt" role="status">
          ✓ {receipt}
        </div>
      )}
      {view === "recap" ? (
        <NightRecapPanel
          night={night}
          history={history}
          loading={historyLoading}
          error={historyError}
          onRefresh={() => void refreshHistory()}
        />
      ) : (
        <div className="night-main-grid">
          <section className="night-panel night-entry">
            <div className="night-section-heading">
              <h2>
                {draft.editId ? `Edit match #${draft.editId}` : "Next up."}
              </h2>
              <span className="night-small">Draft on this device</span>
            </div>
            <p className="night-small">
              Pick your players. Record the result. Go again.
            </p>
            <p className="night-small">
              Unsent drafts expire after 24 hours. Submitted saves stay on this
              device until checked.
            </p>
            {(restore || tabConflict) && (
              <div className="night-warning">
                <h3>
                  {tabConflict
                    ? "This draft changed in another tab."
                    : "Pick up where you left off?"}
                </h3>
                <p>
                  {restore
                    ? `Draft saved ${new Date(restore.savedAt).toLocaleString()}.`
                    : ""}
                </p>
                <div className="night-actions">
                  <button
                    disabled={saving}
                    onClick={() => {
                      if (restore) {
                        setDraft(restore.draft);
                        dirty.current = true;
                      }
                      setRestore(null);
                      setTabConflict(false);
                    }}
                  >
                    Restore draft
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => {
                      if (restore?.draft.pending) {
                        setDraft(restore.draft);
                        setError(
                          "Check the pending save before starting another match.",
                        );
                        dirty.current = true;
                      } else {
                        setDraft(freshDraft());
                        dirty.current = false;
                        try {
                          localStorage.removeItem(storedKey.current);
                        } catch {}
                      }
                      setRestore(null);
                      setTabConflict(false);
                    }}
                  >
                    {restore?.draft.pending
                      ? "Check pending save first"
                      : "Start fresh"}
                  </button>
                </div>
              </div>
            )}
            {storageError && <p className="night-warning">{storageError}</p>}
            {savedEntries.length > 0 && (
              <section className="night-warning" aria-label="Saved unsent entries">
                <h3>Saved unsent entries</h3>
                <p className="night-small">Rejected or released entries stay separately on this device for 24 hours. Checking another save will not erase them.</p>
                {savedEntries.map((entry) => (
                  <div key={entry.draft.recoveredEntryId}>
                    <p>
                      {entry.draft.editId ? `Corrections to match #${entry.draft.editId}` : "Unsent match"}
                      {" · "}{entry.draft.game || "Unknown format"}{" · "}
                      {entry.draft.players.map((p) => names.get(p.playerId) ?? "Unknown player").join(" / ")}
                    </p>
                    <div className="night-actions">
                      <button disabled={locked || draft.recoveredEntryId === entry.draft.recoveredEntryId} onClick={() => restoreEntry(entry)}>Restore saved entry</button>
                      <button disabled={locked} onClick={() => discardEntry(entry)}>Discard saved entry</button>
                    </div>
                  </div>
                ))}
              </section>
            )}
            <fieldset disabled={locked} className="night-fields">
              <legend className="night-sr-only">Match details</legend>
              <div className="night-form-row">
                <label>
                  Game
                  <select
                    value={draft.game}
                    onChange={(e) => {
                      if (
                        draft.players.some((p) => p.score || p.points) &&
                        !window.confirm(
                          "Changing game type clears entered scores. Continue?",
                        )
                      )
                        return;
                      update({
                        game: e.target.value,
                        gameConfig: { ...(draft.gameConfig ?? defaultConfig()), preset: "unspecified", teamScores: {}, finish: "ordinary" },
                        players: draft.players.map((p) => ({
                          ...p,
                          score: "",
                          points: "",
                        })),
                        mode: "3da",
                      });
                    }}
                  >
                    {!GAME_TYPES.includes(
                      draft.game as (typeof GAME_TYPES)[number],
                    ) && <option value={draft.game}>Unknown / legacy</option>}
                    {GAME_TYPES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Board
                  <select
                    value={draft.board}
                    onChange={(e) => update({ board: e.target.value })}
                  >
                    <option value="">Unspecified</option>
                    <option>Soft Tip</option>
                    <option>Steel Tip</option>
                  </select>
                </label>
              </div>
              <div className="night-section-heading">
                <h3>Who’s playing?</h3>
                <span className="night-small">
                  {draft.players.length} selected
                </span>
              </div>
              <div className="night-player-pool">
                {pool.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    value={p.id}
                    aria-pressed={draft.players.some(
                      (s) => s.playerId === p.id,
                    )}
                    onClick={() => choosePlayer(p.id)}
                  >
                    {draft.players.some((s) => s.playerId === p.id) ? "✓ " : ""}
                    {names.get(p.id)}
                  </button>
                ))}
                <button type="button" onClick={() => setManage(true)}>
                  + Add someone
                </button>
              </div>
              <GameOptions game={draft.game} value={draft.gameConfig ?? null} players={draft.players.map(p => ({id:p.playerId,name:names.get(p.playerId) ?? 'Player'}))} winner={draft.winnerId} onWinner={winnerId => update({winnerId})} onChange={gameConfig => update({gameConfig, ...(gameConfig.format !== (draft.gameConfig?.format ?? 'individual') ? {players:draft.players.map(p => ({...p,score:'',points:''}))} : {})})} />
              {isX01(draft.game) && (
                <label className="night-unit">
                  Enter averages as
                  <select
                    value={draft.mode}
                    onChange={(e) => {
                      const next = e.target.value as "3da" | "ppd";
                      const factor = next === "ppd" ? 1 / 3 : 3;
                      update({
                        mode: next,
                        players: draft.players.map((p) => ({
                          ...p,
                          score:
                            p.score && Number.isFinite(Number(p.score))
                              ? String(
                                  Number((Number(p.score) * factor).toFixed(6)),
                                )
                              : p.score,
                        })),
                      });
                    }}
                  >
                    <option value="3da">3-dart average (3DA)</option>
                    <option value="ppd">Points per dart (PPD)</option>
                  </select>
                </label>
              )}
              <div className="night-scorecards">
                {draft.players.map((p, index) => (
                  <article
                    className={`night-scorecard ${draft.winnerId === p.playerId ? "night-winner" : ""}`}
                    key={p.playerId}
                  >
                    <h3>{names.get(p.playerId) ?? "Unknown player"}</h3>
                    <label>
                      {currentUnit}{" "}
                      <span className="night-small">optional</span>
                      <input
                        ref={index === 0 ? firstScore : undefined}
                        type="text"
                        inputMode="decimal"
                        disabled={teamGame && !['3DA','MPR'].includes(gameUnit(draft.game))}
                        value={p.score}
                        placeholder="—"
                        onChange={(e) =>
                          update({
                            players: draft.players.map((s) =>
                              s.playerId === p.playerId
                                ? { ...s, score: e.target.value }
                                : s,
                            ),
                          })
                        }
                      />
                    </label>
                    {hasCricketPoints(draft.game) && (
                      <label>
                        {draft.game === 'Cut-Throat Cricket' ? 'Penalty points' : 'Points'} <span className="night-small">optional</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={p.points}
                          onChange={(e) =>
                            update({
                              players: draft.players.map((s) =>
                                s.playerId === p.playerId
                                  ? { ...s, points: e.target.value }
                                  : s,
                              ),
                            })
                          }
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      aria-pressed={draft.winnerId === p.playerId}
                      hidden={teamGame || !needsWinner}
                      aria-label={`${names.get(p.playerId) ?? "Player"} is the winner`}
                      onClick={() =>
                        update({
                          winnerId:
                            draft.winnerId === p.playerId ? "" : p.playerId,
                        })
                      }
                    >
                      {draft.winnerId === p.playerId
                        ? "✓ Winner"
                        : "Mark as winner"}
                    </button>
                  </article>
                ))}
              </div>
              <details className="night-more">
                <summary>Match time & notes</summary>
                <label className="night-check">
                  <input
                    type="checkbox"
                    checked={draft.liveTime}
                    onChange={(e) =>
                      update({
                        liveTime: e.target.checked,
                        playedAt:
                          draft.playedAt || toLocalDateTimeInput(new Date()),
                      })
                    }
                  />
                  Playing now
                </label>
                {!draft.liveTime && (
                  <label>
                    Played at (your local time)
                    <input
                      type="datetime-local"
                      value={draft.playedAt}
                      onChange={(e) => update({ playedAt: e.target.value })}
                    />
                  </label>
                )}
                <label>
                  Match notes <span className="night-small">optional</span>
                  <textarea
                    maxLength={99}
                    value={draft.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                  />
                </label>
              </details>
            </fieldset>
            {duplicates.length > 0 && (
              <div className="night-warning">
                <h3>This might already be saved.</h3>
                <p>
                  Matching result{duplicates.length === 1 ? "" : "s"}:{" "}
                  {duplicates.map((id) => `#${id}`).join(", ")}. Check the
                  recent results before recording another game.
                </p>
                {duplicates.map((id) => {
                  const existing = matches.find((m) => m.id === id);
                  return existing ? (
                    <details key={id}>
                      <summary>Review saved match #{id}</summary>
                      <p>{scoreSummary(existing)}</p>
                      <p className="night-small">
                        {existing.game_type || "Unknown format"} ·{" "}
                        {existing.board_type || "Unspecified board"} ·{" "}
                        {new Date(existing.played_at).toLocaleString()} ·
                        Entered by{" "}
                        {names.get(existing.created_by ?? "") ??
                          "another player"}
                      </p>
                    </details>
                  ) : (
                    <p key={id}>
                      Match #{id} is awaiting refresh.{" "}
                      <button onClick={() => void refresh()}>
                        Refresh saved result
                      </button>
                    </p>
                  );
                })}
                <div className="night-actions">
                  <button
                    disabled={saving}
                    onClick={() =>
                      void submit(draft.pending?.intent ?? "rematch", true)
                    }
                  >
                    This is another game
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => {
                      releaseEntry(draft);
                      setDuplicates([]);
                      setReceipt(
                        "Existing result kept. This unsaved scorecard is still here.",
                      );
                      void refresh();
                    }}
                  >
                    Keep existing result
                  </button>
                </div>
              </div>
            )}
            {draft.editId && correction && <section aria-label="Correction preview" className="night-warning">
              <h3>Correction preview</h3>
              <p>{correction.result.from} → {correction.result.to}</p>
              {correction.result.changes.length ? <ul>{correction.result.changes.map(p => <li key={p.id}>{p.name}: {p.before.toFixed(1)} → {p.after.toFixed(1)}</li>)}</ul> : <p>No overall rating change. Discipline views and score groups will be recalculated.</p>}
              <p>Saving keeps the original values in the audit.</p>
            </section>}
            <div className="night-save-bar">
              <p className="night-small">
                {draft.liveTime ? "Playing now" : "Recorded time"} ·{" "}
                {draft.game || "Unknown format"} /{" "}
                {draft.board || "Unspecified board"}
              </p>
              <div className="night-actions">
                {draft.pending && !duplicates.length ? (
                  <button
                    className="night-primary"
                    disabled={saving || tabConflict || Boolean(restore)}
                    onClick={() => void submit(draft.pending!.intent)}
                  >
                    {saving ? "Checking save…" : "Check / retry this save"}
                  </button>
                ) : draft.editId ? (
                  <button
                    className="night-primary"
                    disabled={locked || (needsWinner && !draft.winnerId)}
                    onClick={() => void submit("edit")}
                  >
                    Save changes
                  </button>
                ) : (
                  <>
                    <button
                      className="night-primary"
                      disabled={
                        locked || draft.players.length < 2 || (needsWinner && !draft.winnerId)
                      }
                      onClick={() => void submit("rematch")}
                    >
                      {saving ? "Saving…" : "Save & Rematch"}
                    </button>
                    <button
                      disabled={
                        locked || draft.players.length < 2 || (needsWinner && !draft.winnerId)
                      }
                      onClick={() => void submit("finish")}
                    >
                      Save & Finish
                    </button>
                  </>
                )}
              </div>
              <p className="night-small night-save-note">
                {draft.pending
                  ? "Your submission is kept until its result is confirmed."
                  : draft.winnerId
                    ? "Winner selected. Ready when you are."
                    : "Choose at least two players and mark the winner."}
              </p>
            </div>
          </section>
          <aside className="night-sidebar">
            <section className="night-panel">
              <div className="night-section-heading">
                <h2>Who’s here?</h2>
                <span className="night-small">{present.length} players</span>
              </div>
              <p className="night-small">Shared with everyone in this night.</p>
              <div className="night-attendee-chips">
                {present.map((a) => (
                  <span key={a.player_id}>
                    {names.get(a.player_id) ?? "Unknown player"}
                  </span>
                ))}
              </div>
              <button
                className="night-text-button"
                aria-expanded={manage}
                onClick={() => setManage((open) => !open)}
              >
                {manage ? "−" : "+"} Manage attendance
              </button>
              {manage && (
                <div className="night-attendance-editor">
                  <label>
                    Find a player
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search names"
                    />
                  </label>
                  <div className="night-attendance-list">
                  {profiles
                    .filter((p) =>
                      (names.get(p.id) ?? "")
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((p) => (
                      <label className="night-check" key={p.id}>
                        <input
                          type="checkbox"
                          value={p.id}
                          checked={present.some((a) => a.player_id === p.id)}
                          disabled={busyAttendance.includes(p.id)}
                          onChange={(e) =>
                            void attendance(p.id, e.target.checked)
                          }
                        />
                        {names.get(p.id)}
                      </label>
                    ))}
                  </div>
                  <p className="night-small">
                    Missing a player? They’ll appear after creating a site
                    account. Attendance doesn’t change saved games.
                  </p>
                </div>
              )}
            </section>
            <section className="night-panel">
              <div className="night-section-heading">
                <h2>Just played</h2>
                <span className="night-small">{matches.length} matches</span>
              </div>
              <p className="night-small">Results from everyone tonight</p>
              {recent.length ? (
                recent.map((m) => (
                  <article className="night-result" key={m.id}>
                    <div>
                      <strong>
                        {m.match_players?.find((p) => p.is_winner)
                          ? `${m.match_players.filter(p => p.is_winner).map(participantName).join(" + ")} won`
                          : m.game_config?.status === "tied" ? "Unresolved tie" : m.game_config?.status === "abandoned" ? "Abandoned result" : "Result needs review"}
                      </strong>
                      <p className="night-small">
                        {m.match_players?.map(participantName).join(" · ")} ·{" "}
                        {m.game_type || "Unknown"}
                      </p>
                      <p className="night-small">
                        #{m.id} · {scoreSummary(m)}<GameResultDetails game={m.game_type} config={m.game_config} />
                      </p>
                      <p className="night-small">
                        Entered by{" "}
                        {m.created_by === userId
                          ? "you"
                          : (names.get(m.created_by ?? "") ??
                            "another player")}{" "}
                        ·{" "}
                        {new Date(m.played_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {m.created_by === userId && (
                      <button disabled={locked} onClick={() => edit(m)}>
                        Edit
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <p className="night-small">
                  The first result will appear here.
                </p>
              )}
              <div className="night-section-heading">
                <span className="night-small">
                  {refreshedAt ? `Updated ${refreshedAt}` : "Loading results…"}
                </span>
                <button disabled={refreshing} onClick={() => void refresh()}>
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </section>
            <button onClick={() => setView("recap")}>
              See tonight’s recap ↗
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setReceipt(
                    "Night link copied. Anyone signed in can open it.",
                  );
                } catch {
                  setError("Copy this page’s address to share the night.");
                }
              }}
            >
              Copy night link
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
