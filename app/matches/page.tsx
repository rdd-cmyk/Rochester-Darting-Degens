'use client';

import { useCallback, useEffect, useRef, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';
import { LinkedPlayerName } from '@/components/LinkedPlayerName';
import { useCurrentUser } from '@/lib/league-night/use-current-user';
import { pendingSaveKey, readPendingSaves, readSavedEntries, type PendingMatchSave } from '@/lib/league-night/recovery';
import { formatRecordedScore } from '@/lib/matchScore';
import {
  resolvePlayedAtIso,
  toLocalDateTimeInput,
} from '@/lib/dateTime';
import type { User } from '@supabase/supabase-js';
import { isDefiniteSaveRejection, parseCricketPoints, parseScore, saveErrorMessage, saveMatch, validateMatchWrite } from '@/lib/league-night/match-write';
import type { MatchWrite } from '@/lib/league-night/types';

import { loadMatches } from '@/lib/league-night/api';
import { previewCorrection } from '@/lib/games/correction';
import { GameOptions, GameResultDetails } from '@/components/GameOptions';
import { GAME_TYPES, defaultConfig, gameDefinition, gameUnit, hasCricketPoints, isX01, type GameConfig } from '@/lib/games/catalog';

// Simple types
type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  include_first_name_in_display: boolean | null;
};

type MatchPlayerProfile = {
  display_name: string | null;
  first_name: string | null;
  include_first_name_in_display?: boolean | null;
};

type MatchPlayer = {
  id: number;
  match_id: number;
  player_id: string;
  score: number | null;
  points_scored: number | null;
  is_winner: boolean | null;
  // Supabase returns an ARRAY of profiles for this relation
  profiles?: MatchPlayerProfile[] | null;
};

type Match = {
  game_config?: GameConfig | null;
  id: number;
  played_at: string;
  game_type: string | null;
  notes: string | null;
  board_type: string | null;
  venue: string | null;
  created_by: string | null;
  revision: number;
  night_id: string | null;
  match_players: MatchPlayer[] | null;
};

type PlayerEntry = {
  playerId: string;
  stat: string; // raw string, parsed on save
  cricketPoints: string;
};

type MatchesError = { message?: string };

export default function MatchesPage() {
  const { user, loading } = useCurrentUser();
  if (loading) return <main className="page-shell matches-page"><header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">League play</p><h1>Matches</h1></header><p className="rdd-state" role="status">Loading matches…</p></main>;
  if (!user) return <main className="page-shell matches-page"><header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">League play</p><h1>Matches</h1></header><p className="rdd-state">You must be signed in to view and add matches.</p><Link href="/auth" className="rdd-action rdd-action--primary">Go to sign in</Link></main>;
  return <MatchesWorkspace key={user.id} user={user} />;
}

function MatchesWorkspace({ user }: { user: User }) {
  const createEmptyPlayerEntry = (): PlayerEntry => ({
    playerId: '',
    stat: '',
    cricketPoints: '',
  });

  const normalizePlayerEntry = (entry?: PlayerEntry): PlayerEntry => ({
    playerId: entry?.playerId ?? '',
    stat: entry?.stat ?? '',
    cricketPoints: entry?.cricketPoints ?? '',
  });

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [correction, setCorrection] = useState<ReturnType<typeof previewCorrection> | null>(null);
  const [correctionKey, setCorrectionKey] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ operationId: string; payload: MatchWrite } | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState(false);
  const [saveReceipt, setSaveReceipt] = useState('');
  const [otherRecoveries, setOtherRecoveries] = useState(0);
  const [savedEntries, setSavedEntries] = useState<PendingMatchSave[]>([]);
  const [recoveredEntryId, setRecoveredEntryId] = useState<string | null>(null);
  const saveLock = useRef(false);
  const mounted = useRef(true);
  const listRequest = useRef(0);
  const matchRecoveryKey = (id: string) => `rdd:match-save:${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'local'}:${id}`;

  // Form state
  const [playedAt, setPlayedAt] = useState(() =>
    toLocalDateTimeInput(new Date())
  );
  const [gameType, setGameType] = useState('501');
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const teamGame = Boolean(gameConfig && gameConfig.format !== 'individual');
  const [notes, setNotes] = useState('');
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerEntries, setPlayerEntries] = useState<PlayerEntry[]>([
    createEmptyPlayerEntry(),
    createEmptyPlayerEntry(),
  ]);
  const [winnerPlayerId, setWinnerPlayerId] = useState<string>('');
  const [boardType, setBoardType] = useState('');
  const [venue, setVenue] = useState('');
  const [o1StatInputMode, setO1StatInputMode] = useState<'3da' | 'ppd'>(
    '3da'
  );

  // Edit state
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<Pick<Match, 'revision' | 'night_id' | 'played_at' | 'created_by'> | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 10;

  const isCricket = hasCricketPoints(gameType);
  const isOther = gameType === 'Other';
  const isO1 = isX01(gameType);

  // Helper to resize playerEntries when numPlayers changes
  function ensurePlayerEntriesSize(targetSize: number) {
    setPlayerEntries((prev) => {
      const copy = prev.map((entry) => normalizePlayerEntry(entry));
      if (copy.length < targetSize) {
        const toAdd = targetSize - copy.length;
        for (let i = 0; i < toAdd; i++) {
          copy.push(createEmptyPlayerEntry());
        }
      } else if (copy.length > targetSize) {
        copy.length = targetSize;
      }
      return copy;
    });
  }

  function handleNumPlayersChange(value: string) {
    const newNum = parseInt(value, 10);
    if (Number.isNaN(newNum) || newNum < 2 || newNum > 10) return;
    setNumPlayers(newNum);
    ensurePlayerEntriesSize(newNum);

    // If current winner is no longer among players, clear it
    setWinnerPlayerId((prevWinner) => {
      const stillPresent = playerEntries
        .slice(0, newNum)
        .some((pe) => pe.playerId === prevWinner);
      return stillPresent ? prevWinner : '';
    });
  }

  function handlePlayerChange(index: number, playerId: string) {
    const previousId=playerEntries[index]?.playerId;
    if(previousId && previousId!==playerId) {setGameConfig(config=>config ? {...config,sides:Object.fromEntries(Object.entries(config.sides).filter(([id])=>id!==previousId))} : null);if(winnerPlayerId===previousId)setWinnerPlayerId('');}
    setPlayerEntries((prev) => {
      const copy = prev.map((entry) => normalizePlayerEntry(entry));
      if (!copy[index]) copy[index] = createEmptyPlayerEntry();
      copy[index] = { ...copy[index], playerId };
      return copy;
    });

    setWinnerPlayerId((prevWinner) => {
      const wasThisIndexWinner =
        prevWinner &&
        playerEntries[index] &&
        playerEntries[index].playerId === prevWinner;
      return wasThisIndexWinner ? playerId : prevWinner;
    });
  }

  function convertO1Stats(prevMode: '3da' | 'ppd', nextMode: '3da' | 'ppd') {
    if (prevMode === nextMode) return;

    const factor = prevMode === '3da' && nextMode === 'ppd' ? 1 / 3 : 3;

    setPlayerEntries((prev) =>
      prev.map((entry) => {
        const trimmed = entry.stat?.trim() ?? '';
        if (!trimmed) return entry;

        const num = parseFloat(trimmed);
        if (Number.isNaN(num)) return entry;

        const converted = num * factor;
        const normalized = Number.isFinite(converted)
          ? Number(converted.toFixed(2)).toString()
          : entry.stat;

        return { ...entry, stat: normalized };
      })
    );
  }

  function handleStatChange(index: number, stat: string) {
    setPlayerEntries((prev) => {
      const copy = prev.map((entry) => normalizePlayerEntry(entry));
      if (!copy[index]) copy[index] = createEmptyPlayerEntry();
      copy[index] = { ...copy[index], stat };
      return copy;
    });
  }

  function handleCricketPointsChange(index: number, cricketPoints: string) {
    setPlayerEntries((prev) => {
      const copy = prev.map((entry) => normalizePlayerEntry(entry));
      if (!copy[index]) copy[index] = createEmptyPlayerEntry();
      copy[index] = { ...copy[index], cricketPoints };
      return copy;
    });
  }

  // Helper to load matches list with pagination
  async function reloadMatches(page = 1) {
    const request = ++listRequest.current;
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: matchesData, error: matchesError, count } = await supabase
      .from('matches')
      .select(
        `
        id,
        played_at,
        game_type, game_config,
        notes,
        board_type,
        venue,
        created_by,
        revision,
        night_id,
        match_players (
          id,
          match_id,
          player_id,
          score,
          points_scored,
          is_winner,
          profiles (
            display_name,
            first_name,
            include_first_name_in_display
          )
        )
      `,
        { count: 'exact' }
      )
      .order('played_at', { ascending: false })
      .range(from, to);

    if (!mounted.current || request !== listRequest.current) return;
    if (matchesError) {
      throw matchesError;
    }

    setMatches((matchesData ?? []) as Match[]);

    if (typeof count === 'number') {
      const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
      setTotalPages(pages);
    }

    setCurrentPage(page);
  }

  const restoreSave = useCallback((stored: PendingMatchSave) => {
    const payload = validateMatchWrite(stored.payload as MatchWrite);
    setPendingSave(stored.released ? null : { operationId: stored.operationId, payload });
    // Keep the actual entry visible/editable after a definite rejection.
    setPlayedAt(toLocalDateTimeInput(payload.played_at));
    setGameType(payload.game_type ?? '');
    setGameConfig(payload.game_config ?? null);
    setBoardType(payload.board_type ?? '');
    setVenue(payload.venue ?? '');
    setNotes(payload.notes ?? '');
    setNumPlayers(payload.players.length);
    setPlayerEntries(payload.players.map(p => ({ playerId: p.player_id, stat: p.score == null ? '' : String(p.score), cricketPoints: p.points_scored == null ? '' : String(p.points_scored) })));
    setWinnerPlayerId(payload.players.find(p => p.is_winner)?.player_id ?? '');
    setO1StatInputMode('3da');
    setEditingMatchId(payload.match_id);
    setEditSnapshot(payload.match_id === null ? null : { revision: payload.expected_revision!, night_id: payload.night_id, played_at: payload.played_at, created_by: user.id });
    setRecoveredEntryId(stored.released ? stored.operationId : null);
    setSaveReceipt('');
    setDuplicateMatch(false);
    setErrorMessage(stored.released ? 'Your unsaved entry has been restored. Review it before saving.' : 'An earlier save needs confirmation. Check/retry it before entering another match.');
  }, [user.id]);

  function releaseSave(pending: PendingMatchSave) {
    // Definite no-write outcomes become editable drafts, not discarded scores.
    try {
      localStorage.setItem(pendingSaveKey(matchRecoveryKey(user.id),pending.operationId),JSON.stringify({...pending,released:true,savedAt:Date.now()}));
      setRecoveredEntryId(pending.operationId);
      setSavedEntries(readSavedEntries(localStorage,matchRecoveryKey(user.id)));
      setOtherRecoveries(readPendingSaves(localStorage,matchRecoveryKey(user.id)).length);
    } catch { setErrorMessage('Your entry is still here, but recovery storage is unavailable. Copy it before leaving this page.'); }
  }

  // Load current user, profiles, and recent matches
  useEffect(() => {
    mounted.current = true;
    let active = true;
    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const recoveries = readPendingSaves(localStorage, matchRecoveryKey(user.id));
        const stored = recoveries[0];
        setOtherRecoveries(Math.max(0,recoveries.length-1));
        setSavedEntries(readSavedEntries(localStorage,matchRecoveryKey(user.id)));
        if (stored) {
          restoreSave(stored);
        }
      } catch { /* The form still works when recovery storage is unavailable. */ }

      // 2) Load profiles (players)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, include_first_name_in_display')
        .order('display_name', { ascending: true });

      if (!active) return;
      if (profilesError) {
        setErrorMessage('Error loading profiles: ' + profilesError.message);
      } else {
        setProfiles(profilesData || []);
      }

      // 3) Load recent matches (with players) - first page
      try {
        await reloadMatches(1);
      } catch (matchesError: unknown) {
        if (!active) return;
        setErrorMessage((prev) =>
          (prev ? prev + ' | ' : '') +
          'Error loading matches: ' +
          (matchesError && typeof matchesError === 'object'
            ? (matchesError as MatchesError).message ?? String(matchesError)
            : String(matchesError))
        );
      }

      if (active) setLoading(false);
    }

    load();
    return () => { active = false; mounted.current = false; };
  }, [user.id, restoreSave]);

  function resetForm() {
    setPlayedAt(toLocalDateTimeInput(new Date()));
    setGameType('501');
    setGameConfig(null);
    setNotes('');
    setNumPlayers(2);
    setPlayerEntries([
      createEmptyPlayerEntry(),
      createEmptyPlayerEntry(),
    ]);
    setWinnerPlayerId('');
    setBoardType('');
    setVenue('');
    setO1StatInputMode('3da');
    setEditingMatchId(null); setCorrection(null); setCorrectionKey('');
    setEditSnapshot(null);
    setRecoveredEntryId(null);
  }

  function currentPayload(): MatchWrite {
        const original = editSnapshot;
        if (editingMatchId && original?.created_by !== user.id) throw new Error('You can only edit matches you created.');
        const selected = playerEntries.slice(0, numPlayers);
    return validateMatchWrite({
          match_id: editingMatchId, expected_revision: original?.revision ?? null,
          night_id: original?.night_id ?? null,
          played_at: resolvePlayedAtIso(playedAt, original?.played_at ?? null),
          game_type: gameType || null, game_config: gameConfig, board_type: boardType || null, venue: venue || null, notes: notes || null,
          players: selected.map(p => ({ player_id: p.playerId,
            score: parseScore(p.stat, gameType, o1StatInputMode),
            points_scored: isCricket ? parseCricketPoints(p.cricketPoints) : null,
            is_winner: gameConfig?.status && gameConfig.status !== 'completed' ? false : teamGame ? Boolean(gameConfig?.sides[winnerPlayerId] && gameConfig.sides[p.playerId] === gameConfig.sides[winnerPlayerId]) : p.playerId === winnerPlayerId })),
          allow_duplicate: false,
        });
  }
  async function previewEdit() {
    setPreviewing(true); setErrorMessage(null); setCorrection(null); setCorrectionKey('');
    try {
      const payload=currentPayload();
      const history=await loadMatches();
      setCorrection(previewCorrection(history,payload)); setCorrectionKey(JSON.stringify(payload));
    } catch(error) {setErrorMessage(saveErrorMessage(error));}
    finally {setPreviewing(false);}
  }

  async function handleSaveMatch(e: FormEvent) {
    e.preventDefault();
    if (saveLock.current || !user) return;
    setErrorMessage(null);
    let pending = pendingSave;
    try {
      if (!pending) {
        const payload = currentPayload();
        const originalGame = matches.find(m => m.id === editingMatchId)?.game_type;
        if (editingMatchId && originalGame !== gameType && correctionKey !== JSON.stringify(payload)) throw new Error('Preview this classification correction before saving.');
        pending = { operationId: crypto.randomUUID(), payload };
      }
      setPendingSave(pending);
      // Preserve the exact payload/ID for an interrupted response or reload.
      try {
        localStorage.setItem(pendingSaveKey(matchRecoveryKey(user.id),pending.operationId), JSON.stringify({ savedAt: Date.now(), ...pending }));
        // Replace an editable draft only AFTER the new operation is durable.
        if(recoveredEntryId) localStorage.removeItem(pendingSaveKey(matchRecoveryKey(user.id),recoveredEntryId));
        setRecoveredEntryId(null);
        setSavedEntries(readSavedEntries(localStorage,matchRecoveryKey(user.id)));
      }
      catch { setErrorMessage('Recovery storage is unavailable. Keep this page open until the save is confirmed.'); }
      saveLock.current = true;
      setSaving(true);
      setDuplicateMatch(false);
      const result = await saveMatch(pending.operationId, pending.payload, user.id);
      if (!mounted.current) return;
      if (result.status === 'possible_duplicate') {
        setErrorMessage('This may already be saved as match ' + result.match_ids.join(', ') + '. Review it below, or confirm another game.');
        setDuplicateMatch(true);
        return;
      }
      setSaveReceipt('Saved match #' + result.match_id + (result.replayed ? ' — previous save confirmed.' : '.'));
      try { localStorage.removeItem(pendingSaveKey(matchRecoveryKey(user.id),pending.operationId)); setOtherRecoveries(readPendingSaves(localStorage,matchRecoveryKey(user.id)).length); } catch { /* A confirmed save must remain successful. */ }
      setPendingSave(null);
      setDuplicateMatch(false);
      resetForm();
      try { await reloadMatches(1); }
      catch { if (mounted.current) setErrorMessage('Your match is saved, but the list could not refresh. Reload the page to see it.'); }
    } catch (cause) {
      if (!mounted.current) return;
      setErrorMessage(saveErrorMessage(cause));
      if (isDefiniteSaveRejection(cause)) {
        setPendingSave(null);
        if(pending) releaseSave(pending);
      }
    } finally { saveLock.current = false; if (mounted.current) setSaving(false); }
  }

  function handleEditClick(match: Match) {
    if (saving || pendingSave) return;
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('You must be signed in to edit matches.');
      return;
    }
    if (match.created_by !== user.id) {
      setErrorMessage('You can only edit matches you created.');
      return;
    }

    const players = match.match_players || [];
    if (players.length < 2) {
      setErrorMessage('This match does not have enough player data to edit.');
      return;
    }

    const clampedCount = Math.max(2, Math.min(players.length, 10));
    // Opening an independent saved match does not supersede a released draft.
    setRecoveredEntryId(null);
    setNumPlayers(clampedCount);

    const entries: PlayerEntry[] = players
      .slice(0, clampedCount)
      .map((mp) => ({
        playerId: mp.player_id,
        stat: mp.score != null ? mp.score.toString() : '',
        cricketPoints: mp.points_scored != null ? mp.points_scored.toString() : '',
      }));

    // If fewer than clampedCount, pad
    while (entries.length < clampedCount) {
      entries.push(createEmptyPlayerEntry());
    }

    setPlayerEntries(entries);

    const winnerMp = players.find((mp) => mp.is_winner);
    setWinnerPlayerId(winnerMp ? winnerMp.player_id : '');

    setEditingMatchId(match.id);
    setEditSnapshot({ revision: match.revision, night_id: match.night_id, played_at: match.played_at, created_by: match.created_by });
    setPlayedAt(toLocalDateTimeInput(match.played_at));
    setGameType(match.game_type || '');
    setGameConfig(match.game_config ?? null);
    setO1StatInputMode('3da');
    setNotes(match.notes || '');
    setBoardType(match.board_type || '');
    setVenue(match.venue || '');
  }

  useEffect(() => {
    if (!isO1 && o1StatInputMode !== '3da') {
      setO1StatInputMode('3da');
    }
  }, [isO1, o1StatInputMode]);

  if (loading) {
    return (
      <main className="page-shell matches-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">League play</p><h1>Matches</h1></header>
        <p className="rdd-state" role="status">Loading matches…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell matches-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">League play</p><h1>Matches</h1></header>
        <p className="rdd-state">You must be signed in to view and add matches.</p>
        <p>
          <Link href="/auth" className="rdd-action rdd-action--primary">
            Go to sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page-shell matches-page">
      <header className="rdd-page-header rdd-page-header--compact">
        <p className="rdd-eyebrow">League play</p>
        <h1>Darts Matches</h1>
        <p>Record a result or review recent games.</p>
        <p className="matches-account-line">Signed in as <strong>{user.email}</strong></p>
        <p><Link href="/league-night" className="rdd-action rdd-action--outline">Open League Night for shared attendance and quick rematches ↗</Link></p>
      </header>

      {errorMessage && (
        <div className="rdd-state rdd-state--error" role="alert">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
      {saveReceipt && <p role="status">✓ {saveReceipt}</p>}
      {otherRecoveries>0 && <p>{otherRecoveries} other save{otherRecoveries===1?'':'s'} still need checking on this device. <button type="button" disabled={saving || Boolean(pendingSave)} onClick={()=>{
        const waiting=readPendingSaves(localStorage,matchRecoveryKey(user.id));
        setOtherRecoveries(Math.max(0,waiting.length-1));
        if(waiting[0]) restoreSave(waiting[0]);
      }}>Review next pending save</button></p>}
      {savedEntries.length>0 && <section><h2>Saved unsent entries</h2><p>Rejected or released entries stay on this device for 24 hours. Restoring replaces the visible form only after confirmation.</p>{savedEntries.map(entry=><p key={entry.operationId}>
        {entry.payload.game_type || 'Unknown format'} · {new Date(entry.payload.played_at).toLocaleString()} · {entry.payload.players.length} players{' '}
        <button type="button" disabled={saving || Boolean(pendingSave) || otherRecoveries>0 || recoveredEntryId===entry.operationId} onClick={()=>{if(window.confirm('Replace the visible form with this saved entry?')) restoreSave(entry);}}>Restore saved entry</button>{' '}
        <button type="button" disabled={saving || Boolean(pendingSave)} onClick={()=>{if(window.confirm('Discard this saved unsent entry? This does not delete any match.')){localStorage.removeItem(pendingSaveKey(matchRecoveryKey(user.id),entry.operationId));setSavedEntries(readSavedEntries(localStorage,matchRecoveryKey(user.id)));if(recoveredEntryId===entry.operationId)setRecoveredEntryId(null);}}}>Discard saved entry</button>
      </p>)}</section>}
      {pendingSave && <section style={{ border: '1px solid var(--input-border)', padding: '1rem', borderRadius: '0.75rem' }}>
        <p>{duplicateMatch ? 'Review the matching result before recording another game.' : 'A submitted match is awaiting confirmation. Its details are kept for a safe retry.'}</p>
        <button type="button" disabled={saving} onClick={() => {
          if (duplicateMatch) setPendingSave(current => current ? { ...current, payload: { ...current.payload, allow_duplicate: true } } : null);
          setDuplicateMatch(false);
        }}>{duplicateMatch ? 'This is another game — enable save' : 'Keep this submission for retry'}</button>
        {duplicateMatch && <button type="button" disabled={saving} onClick={() => {
          // A duplicate response is a confirmed no-write outcome, so it is safe
          // to release this operation while keeping the entered scorecard.
          setPendingSave(null); setDuplicateMatch(false); setErrorMessage(null);
          releaseSave(pendingSave);
          setSaveReceipt('Existing result kept. Your unsaved entry is still here.');
        }}>Keep existing result / return to draft</button>}
      </section>}

      {/* Add / Edit Match Form */}
      <section className="rdd-panel matches-form-panel">
        <h2 className="rdd-section-title">
          {editingMatchId ? 'Edit Match' : 'Record a New Match'}
        </h2>
        {profiles.length < 2 && (
          <p className="rdd-state">
            You currently have fewer than 2 profiles. <Link href="/invites">Invite a league member</Link> so they can join and appear here.
          </p>
        )}

        <form onSubmit={handleSaveMatch} aria-busy={saving}>
          <fieldset disabled={saving || Boolean(pendingSave) || otherRecoveries > 0} className="matches-details">
          <legend className="sr-only">Match details</legend>
          <div className="form-row">
            <label htmlFor="playedAt" className="form-label">
              Match date and time
            </label>
            <input
              id="playedAt"
              type="datetime-local"
              value={playedAt}
              max={toLocalDateTimeInput(new Date())}
              onChange={(event) => setPlayedAt(event.target.value)}
              disabled={saving}
              required
              className="form-control"
            />
          </div>

          {/* Game type */}
          <div className="form-row">
            <label htmlFor="match-game-type" className="form-label">Game type</label>
            <select
              id="match-game-type" aria-label="Game type"
              value={gameType}
              onChange={(e) => {
                if (playerEntries.some(p => p.stat || p.cricketPoints) && !window.confirm('Changing game clears scores. Original saved values remain in the correction audit. Continue?')) return;
                setGameType(e.target.value); setGameConfig({ ...(gameConfig ?? defaultConfig()), preset: 'unspecified', teamScores: {}, finish: 'ordinary' });
                setPlayerEntries(prev => prev.map(p => ({...p, stat: '', cricketPoints: ''}))); setO1StatInputMode('3da');
              }}
              className="form-control"
            >
              {!GAME_TYPES.includes(gameType) && <option value={gameType}>{gameType || 'Unknown recorded format'}</option>}
              {GAME_TYPES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <GameOptions game={gameType} value={gameConfig} onChange={config => {
            if (config.format !== (gameConfig?.format ?? 'individual')) {
              setPlayerEntries(prev => prev.map(p => ({ ...p, stat: '', cricketPoints: '' })));
              if (config.format !== 'individual') handleNumPlayersChange(config.format === '2v2' ? '4' : '6');
            }
            setGameConfig(config);
          }} players={playerEntries.slice(0,numPlayers).map((p,i) => ({id:p.playerId, name:profiles.find(q => q.id === p.playerId)?.display_name ?? `Player ${i+1}`}))} winner={winnerPlayerId} onWinner={setWinnerPlayerId} />
          {editingMatchId && <section aria-label="Correction preview"><p>Changing the game clears incompatible scores and keeps their original values in the audit.</p><button type="button" disabled={previewing} onClick={previewEdit}>{previewing ? 'Calculating…' : 'Preview correction'}</button>{correction && <div role="status"><p>{correction.from} → {correction.to}. Affected overall ratings:</p>{correction.changes.length ? <ul>{correction.changes.map(p => <li key={p.id}>{p.name}: {p.before.toFixed(1)} → {p.after.toFixed(1)}</li>)}</ul> : <p>No overall rating change. Discipline views and score groups will be recalculated.</p>}<p>Save changes applies the correction; the original result remains in the audit.</p></div>}</section>}
          {/* Stat entry mode for 01 games */}
          {isO1 && (
            <div className="form-row">
              <label htmlFor="match-stat-entry" className="form-label">Stat entry</label>
              <div className="matches-stat-mode">
                <select
                  id="match-stat-entry" aria-label="Stat entry"
                  value={o1StatInputMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as '3da' | 'ppd';
                    convertO1Stats(o1StatInputMode, nextMode);
                    setO1StatInputMode(nextMode);
                  }}
                  disabled={saving}
                  className="form-control"
                >
                  <option value="3da">
                    3-Dart Average
                  </option>
                  <option value="ppd">
                    Points Per Dart (PPD)
                  </option>
                </select>
                {o1StatInputMode === 'ppd' && (
                  <span className="rdd-field-help">
                    PPD values are multiplied by 3 to store a 3-dart average for
                    leaderboards.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="form-row">
            <label htmlFor="match-notes" className="form-label">Notes</label>
            <input
              id="match-notes"
              type="text"
              aria-label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              placeholder="'Other' game type, e.g."
              className="form-control"
            />
          </div>

          {/* Number of players */}
          <div className="form-row">
            <label htmlFor="match-player-count" className="form-label">Number of players</label>
            <select
              id="match-player-count" aria-label="Number of players"
              disabled={saving || teamGame}
              value={numPlayers}
              onChange={(e) => handleNumPlayersChange(e.target.value)}
              className="form-control"
            >
              {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic players */}
          {playerEntries.slice(0, numPlayers).map((entry, index) => {
            const playerLabel = `Player ${index + 1}`;
            const statLabel = `${playerLabel} ${isO1 && o1StatInputMode === 'ppd' ? 'PPD' : gameUnit(gameType)}`;
            const allowPersonal = !teamGame || ['3DA','MPR'].includes(gameUnit(gameType));

            return (
              <fieldset
                key={index}
                className="matches-player-card"
              >
                <legend id={`match-player-group-${index}`}>{playerLabel}</legend>
                <div className="form-row">
                  <label
                    id={`match-player-label-${index}`}
                    htmlFor={`match-player-${index}`}
                    className="form-label"
                  >
                    Player
                  </label>
                  <select
                    id={`match-player-${index}`}
                    aria-label={playerLabel}
                    value={entry.playerId}
                    onChange={(e) => handlePlayerChange(index, e.target.value)}
                    disabled={saving}
                    className="form-control"
                  >
                    <option value="">
                      -- choose player --
                    </option>
                    {profiles.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {formatPlayerName(
                          p.display_name,
                          p.first_name,
                          p.include_first_name_in_display
                        )}
                      </option>
                    ))}
                  </select>
                </div>
                <div hidden={!allowPersonal} className="form-row matches-form-row--stat">
                  <label htmlFor={`match-stat-${index}`} className="form-label">{statLabel}</label>
                  <input
                    id={`match-stat-${index}`}
                    aria-label={statLabel}
                    type="number"
                    step={gameDefinition(gameType)?.whole ? 1 : 'any'}
                    min={0}
                    max={isOther ? 9999 : undefined}
                    value={entry.stat}
                    onChange={(e) => handleStatChange(index, e.target.value)}
                    disabled={saving}
                    placeholder={
                      isCricket
                        ? 'e.g. 3.25'
                        : isOther
                        ? 'e.g. 250'
                        : o1StatInputMode === 'ppd'
                        ? 'e.g. 29.17'
                        : 'e.g. 87.50'
                    }
                    className="form-control"
                  />
                </div>
                {isCricket && (
                  <div className="form-row matches-form-row--points">
                    <label htmlFor={`match-cricket-points-${index}`} className="form-label">
                      {playerLabel} {gameType === 'Cut-Throat Cricket' ? 'penalty points' : 'points scored'} (optional)
                    </label>
                    <input
                      id={`match-cricket-points-${index}`}
                      aria-label={`${playerLabel} ${gameType === 'Cut-Throat Cricket' ? 'penalty points' : 'points scored'} (optional)`}
                      type="number"
                      step={1}
                      min={0}
                      max={9999}
                      value={entry.cricketPoints}
                      onChange={(e) =>
                        handleCricketPointsChange(index, e.target.value)
                      }
                      disabled={saving}
                      placeholder="e.g. 120"
                      className="form-control"
                    />
                  </div>
                )}
              </fieldset>
            );
          })}

          {/* Winner selection */}
          <div hidden={teamGame || Boolean(gameConfig && gameConfig.status !== 'completed')} className="form-row">
            <label htmlFor="match-winner" className="form-label">Winner</label>
            <select
              id="match-winner" aria-label="Winner"
              value={winnerPlayerId}
              onChange={(e) => setWinnerPlayerId(e.target.value)}
              disabled={saving}
              className="form-control"
            >
              <option value="">
                -- select winner --
              </option>
              {playerEntries.slice(0, numPlayers).map((entry, index) => {
                const profile = profiles.find((p) => p.id === entry.playerId);
                const label = profile
                  ? formatPlayerName(
                      profile.display_name,
                      profile.first_name,
                      profile.include_first_name_in_display
                    )
                  : entry.playerId
                  ? `Player ${index + 1}`
                  : `Player ${index + 1} (select player above)`;

                return (
                  <option
                    key={`winner-${index}`}
                    value={entry.playerId}
                    disabled={!entry.playerId}
                  >
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Board type */}
          <div className="form-row">
            <label htmlFor="match-board-type" className="form-label">Board type</label>
            <select
              id="match-board-type" aria-label="Board type"
              value={boardType}
              onChange={(e) => setBoardType(e.target.value)}
              disabled={saving}
              className="form-control"
            >
              <option value="">
                -- choose --
              </option>
              <option value="Soft Tip">
                Soft Tip
              </option>
              <option value="Steel Tip">
                Steel Tip
              </option>
            </select>
          </div>

          {/* Venue */}
          <div className="form-row">
            <label htmlFor="match-venue" className="form-label">Venue</label>
            <input
              id="match-venue"
              type="text"
              aria-label="Venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              disabled={saving}
              placeholder="Radio Social, e.g."
              className="form-control"
            />
          </div>

          </fieldset>
          <div className="button-row matches-form-actions">
            <button
              type="submit"
              disabled={saving || duplicateMatch || (otherRecoveries > 0 && !pendingSave)}
              className="rdd-action rdd-action--primary"
            >
              {saving ? 'Checking save…' : pendingSave ? 'Check / retry save' : editingMatchId ? 'Save changes' : 'Save match'}
              </button>

            {editingMatchId && !pendingSave && (
              <button
                type="button"
                onClick={resetForm}
                className="rdd-action"
                disabled={saving}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Recent Matches */}
      <section className="matches-history">
        <h2 className="rdd-section-title">
          Recent Matches
        </h2>
        {matches.length === 0 ? (
          <p>No matches recorded yet.</p>
        ) : (
          <>
            <ul className="matches-history-list">
              {matches.map((m) => {
                const metricLabel = gameUnit(m.game_type);

                const canEdit = m.created_by === user.id;

                return (
                  <li
                    key={m.id}
                    className="rdd-panel matches-history-card"
                  >
                    <div className="matches-history-card-header">
                      <div>
                        <strong>
                          {m.game_type || 'Unknown game'} –{' '}
                          {new Date(m.played_at).toLocaleString()}
                        </strong>
                        <GameResultDetails game={m.game_type} config={m.game_config} />
                        {m.notes && <div>Notes: {m.notes}</div>}
                        {m.board_type && <div>Board: {m.board_type}</div>}
                        {m.venue && <div>Venue: {m.venue}</div>}
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleEditClick(m)}
                          className="rdd-action"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    <div className="matches-history-participants">
                      Players:
                      <ul>
                        {(m.match_players || []).map((mp) => {
                          const prof = (Array.isArray(mp.profiles)
                            ? mp.profiles[0]
                            : mp.profiles) as {
                            display_name: string | null;
                            first_name: string | null;
                            include_first_name_in_display?: boolean | null;
                          } | null;

                          return (
                            <li key={mp.id}>
                              {prof ? (
                                <LinkedPlayerName
                                  playerId={mp.player_id}
                                  display_name={prof.display_name}
                                  first_name={prof.first_name}
                                  includeFirstNameInDisplay={
                                    prof.include_first_name_in_display
                                  }
                                />
                              ) : (
                                'Unknown player'
                              )}{' '}
                              – {metricLabel}:{' '}
                              {formatRecordedScore(mp.score)}
                              {(m.game_type === 'Cricket' || m.game_type === 'Cut-Throat Cricket') && mp.points_scored != null
                                ? ` (${m.game_type === 'Cut-Throat Cricket' ? 'Penalty points' : 'Points'}: ${mp.points_scored})`
                                : ''}{' '}
                              {m.game_config?.sides[mp.player_id] ? ` · Team ${m.game_config.sides[mp.player_id]}` : ''} {mp.is_winner ? <strong>(winner)</strong> : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Pagination controls */}
            <div className="rdd-pagination">
              <button
                type="button"
                onClick={() => reloadMatches(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rdd-action rdd-action--secondary"
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => reloadMatches(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="rdd-action rdd-action--secondary"
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
