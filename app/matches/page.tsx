'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';
import { LinkedPlayerName } from '@/components/LinkedPlayerName';
import { clearMatchesState } from '@/lib/matchState';
import { formatRecordedScore } from '@/lib/matchScore';
import {
  resolvePlayedAtIso,
  toLocalDateTimeInput,
} from '@/lib/dateTime';
import type { User } from '@supabase/supabase-js';

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
  id: number;
  played_at: string;
  game_type: string | null;
  notes: string | null;
  board_type: string | null;
  venue: string | null;
  created_by: string | null;
  match_players: MatchPlayer[] | null;
};

type PlayerEntry = {
  playerId: string;
  stat: string; // raw string, parsed on save
  cricketPoints: string;
};

type MatchesError = { message?: string };

export default function MatchesPage() {
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

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);

  // Form state
  const [playedAt, setPlayedAt] = useState(() =>
    toLocalDateTimeInput(new Date())
  );
  const [gameType, setGameType] = useState('501');
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 10;

  const isCricket = gameType === 'Cricket';
  const isOther = gameType === 'Other';
  const isO1 = gameType === '501' || gameType === '301';

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
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: matchesData, error: matchesError, count } = await supabase
      .from('matches')
      .select(
        `
        id,
        played_at,
        game_type,
        notes,
        board_type,
        venue,
        created_by,
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

  // Load current user, profiles, and recent matches
  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage(null);

      // 1) Get logged-in user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setUser(null);
        clearMatchesState({
          setMatches,
          setProfiles,
          setCurrentPage,
          setTotalPages,
        });
        setLoading(false);
        return;
      }

      setUser(userData.user);

      // 2) Load profiles (players)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, include_first_name_in_display')
        .order('display_name', { ascending: true });

      if (profilesError) {
        setErrorMessage('Error loading profiles: ' + profilesError.message);
      } else {
        setProfiles(profilesData || []);
      }

      // 3) Load recent matches (with players) - first page
      try {
        await reloadMatches(1);
      } catch (matchesError: unknown) {
        setErrorMessage((prev) =>
          (prev ? prev + ' | ' : '') +
          'Error loading matches: ' +
          (matchesError && typeof matchesError === 'object'
            ? (matchesError as MatchesError).message ?? String(matchesError)
            : String(matchesError))
        );
      }

      setLoading(false);
    }

    load();
  }, []);

  function resetForm() {
    setPlayedAt(toLocalDateTimeInput(new Date()));
    setGameType('501');
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
    setEditingMatchId(null);
  }

  async function handleSaveMatch(e: FormEvent) {
    e.preventDefault();
    if (saveInProgress.current) return;
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('You must be signed in to add or edit a match.');
      return;
    }

    const activePlayers = playerEntries.slice(0, numPlayers);

    if (activePlayers.length < 2) {
      setErrorMessage('Please select at least 2 players.');
      return;
    }

    // Ensure all players are selected
    if (activePlayers.some((p) => !p.playerId)) {
      setErrorMessage('Please choose all players.');
      return;
    }

    // Ensure players are unique
    const ids = activePlayers.map((p) => p.playerId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      setErrorMessage('Players must be different.');
      return;
    }

    // Ensure winner is selected
    if (!winnerPlayerId) {
      setErrorMessage('Please select the winner.');
      return;
    }

    // Ensure winner is among the selected players
    if (!ids.includes(winnerPlayerId)) {
      setErrorMessage('Winner must be one of the selected players.');
      return;
    }

    // Validate stats (including caps & no negatives for 501 / 301 / Cricket)
    let playedAtIso: string;
    try {
      const originalPlayedAt =
        editingMatchId === null
          ? null
          : matches.find((match) => match.id === editingMatchId)?.played_at ?? null;
      playedAtIso = resolvePlayedAtIso(playedAt, originalPlayedAt);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Choose a valid match time.'
      );
      return;
    }

    if (new Date(playedAtIso).getTime() > Date.now() + 5 * 60_000) {
      setErrorMessage('Match time cannot be in the future.');
      return;
    }

    const parsedStats: number[] = [];
    const parsedCricketPoints: (number | null)[] = [];
    for (let i = 0; i < activePlayers.length; i++) {
      const statStr = activePlayers[i].stat;
      let statNum: number;

      if (gameType === 'Other') {
        statNum = Number(statStr);

        if (Number.isNaN(statNum) || !Number.isInteger(statNum)) {
          setErrorMessage(
            'Scores for Other game types must be whole numbers (e.g., 250).'
          );
          return;
        }

        if (statNum < 1 || statNum > 9999) {
          setErrorMessage(
            'Scores for Other game types must be between 1 and 9999.'
          );
          return;
        }
      } else {
        statNum = parseFloat(statStr);
        if (Number.isNaN(statNum)) {
          setErrorMessage(
            'Stats must be valid numbers (e.g., 101.85, 5.23) for all players.'
          );
          return;
        }

        // Apply caps only for 501, 301, and Cricket
        let maxStat: number | null = null;
        if (gameType === '501') {
          maxStat = 167;
        } else if (gameType === '301') {
          maxStat = 150.5;
        } else if (gameType === 'Cricket') {
          maxStat = 9;
        }

        // Convert PPD to 3-dart average when entering 01 games
        if (isO1 && o1StatInputMode === 'ppd') {
          statNum = statNum * 3;
        }

        if (maxStat !== null) {
          // No negative numbers allowed
          if (statNum < 0) {
            setErrorMessage('Stats cannot be negative.');
            return;
          }
          // Over absolute cap
          if (statNum > maxStat) {
            setErrorMessage(
              `That value is above the maximum allowed for ${gameType}. Check the score and try again.`
            );
            return;
          }
        }
      }

      parsedStats.push(statNum);

      if (isCricket) {
        const rawPoints = activePlayers[i].cricketPoints?.trim() ?? '';
        if (!rawPoints) {
          parsedCricketPoints.push(null);
        } else {
          const pointsNum = Number(rawPoints);

          if (
            Number.isNaN(pointsNum) ||
            !Number.isInteger(pointsNum) ||
            pointsNum < 0 ||
            pointsNum > 9999
          ) {
            setErrorMessage(
              'Cricket points scored must be a whole number between 0 and 9999.'
            );
            return;
          }

          parsedCricketPoints.push(pointsNum);
        }
      } else {
        parsedCricketPoints.push(null);
      }
    }

    saveInProgress.current = true;
    setSaving(true);
    try {
      if (editingMatchId == null) {
        // ➕ CREATE a new match
        const { data: matchInsertData, error: matchInsertError } = await supabase
          .from('matches')
          .insert([
            {
              game_type: gameType,
              played_at: playedAtIso,
              notes,
              created_by: user.id,
              board_type: boardType || null,
              venue: venue || null,
            },
          ])
          .select()
          .single();

        if (matchInsertError || !matchInsertData) {
          throw matchInsertError || new Error('No match returned from insert.');
        }

        const matchId = matchInsertData.id as number;

        const matchPlayersPayload = activePlayers.map((p, index) => ({
          match_id: matchId,
          player_id: p.playerId,
          score: parsedStats[index],
          points_scored: isCricket ? parsedCricketPoints[index] : null,
          is_winner: p.playerId === winnerPlayerId,
        }));

        const { error: mpError } = await supabase
          .from('match_players')
          .insert(matchPlayersPayload);

        if (mpError) {
          throw mpError;
        }
      } else {
        // ✏️ EDIT existing match
        // 1) Ensure the match belongs to this user (basic front-end check)
        const matchToEdit = matches.find((m) => m.id === editingMatchId);
        if (!matchToEdit || matchToEdit.created_by !== user.id) {
          setErrorMessage('You can only edit matches you created.');
          return;
        }

        // 2) Update match row
        const { error: matchUpdateError } = await supabase
          .from('matches')
          .update({
            game_type: gameType,
            played_at: playedAtIso,
            notes,
            board_type: boardType || null,
            venue: venue || null,
          })
          .eq('id', editingMatchId)
          .eq('created_by', user.id);

        if (matchUpdateError) {
          throw matchUpdateError;
        }

        // 3) Delete existing match_players for this match
        const { error: deleteMpError } = await supabase
          .from('match_players')
          .delete()
          .eq('match_id', editingMatchId);

        if (deleteMpError) {
          throw deleteMpError;
        }

        // 4) Insert new match_players rows
        const matchPlayersPayload = activePlayers.map((p, index) => ({
          match_id: editingMatchId,
          player_id: p.playerId,
          score: parsedStats[index],
          points_scored: isCricket ? parsedCricketPoints[index] : null,
          is_winner: p.playerId === winnerPlayerId,
        }));

        const { error: insertMpError } = await supabase
          .from('match_players')
          .insert(matchPlayersPayload);

        if (insertMpError) {
          throw insertMpError;
        }
      }

      // Reload matches list to include changes (go to first page)
      await reloadMatches(1);

      // Reset form back to "new match"
      resetForm();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as MatchesError).message)
          : String(err);

      console.error('Error saving match:', err);
      setErrorMessage('Error saving match: ' + message);
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  function handleEditClick(match: Match) {
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
    setPlayedAt(toLocalDateTimeInput(match.played_at));
    setGameType(match.game_type || '501');
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
            Go to sign in / sign up
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
      </header>

      {errorMessage && (
        <div className="rdd-state rdd-state--error" role="alert">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Add / Edit Match Form */}
      <section className="rdd-panel matches-form-panel">
        <h2 className="rdd-section-title">
          {editingMatchId ? 'Edit Match' : 'Record a New Match'}
        </h2>
        {profiles.length < 2 && (
          <p className="rdd-state">
            You currently have fewer than 2 profiles. Ask your friends to sign
            up on the{' '}
            <Link href="/auth">
              auth page
            </Link>{' '}
            so they appear here.
          </p>
        )}

        <form onSubmit={handleSaveMatch} aria-busy={saving}>
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
              id="match-game-type"
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              disabled={saving}
              className="form-control"
            >
              <option value="501">
                501
              </option>
              <option value="301">
                301
              </option>
              <option value="Cricket">
                Cricket
              </option>
              <option value="Other">
                Other
              </option>
            </select>
          </div>

          {/* Stat entry mode for 01 games */}
          {isO1 && (
            <div className="form-row">
              <label htmlFor="match-stat-entry" className="form-label">Stat entry</label>
              <div className="matches-stat-mode">
                <select
                  id="match-stat-entry"
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
              id="match-player-count"
              value={numPlayers}
              onChange={(e) => handleNumPlayersChange(e.target.value)}
              disabled={saving}
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
            const statLabel = isCricket
              ? `${playerLabel} MPR`
              : isOther
              ? `${playerLabel} Score`
              : isO1 && o1StatInputMode === 'ppd'
              ? `${playerLabel} PPD`
              : `${playerLabel} 3-Dart Average`;

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
                    aria-labelledby={`match-player-group-${index} match-player-label-${index}`}
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
                <div className="form-row matches-form-row--stat">
                  <label htmlFor={`match-stat-${index}`} className="form-label">{statLabel}</label>
                  <input
                    id={`match-stat-${index}`}
                    type="number"
                    step={isOther ? 1 : 0.01}
                    min={isOther ? 1 : 0}
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
                      {playerLabel} points scored (optional)
                    </label>
                    <input
                      id={`match-cricket-points-${index}`}
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
          <div className="form-row">
            <label htmlFor="match-winner" className="form-label">Winner</label>
            <select
              id="match-winner"
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
              id="match-board-type"
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
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              disabled={saving}
              placeholder="Radio Social, e.g."
              className="form-control"
            />
          </div>

          <div className="button-row matches-form-actions">
            <button
              type="submit"
              className="rdd-action rdd-action--primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : editingMatchId ? 'Save changes' : 'Save match'}
              </button>

            {editingMatchId && (
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
                const metricLabel =
                  m.game_type === 'Cricket'
                    ? 'MPR'
                    : m.game_type === 'Other'
                      ? 'Score'
                      : '3-Dart Avg';

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
                              {m.game_type === 'Cricket' && mp.points_scored != null
                                ? ` (Points: ${mp.points_scored})`
                                : ''}{' '}
                              {mp.is_winner ? <strong>(winner)</strong> : null}
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
