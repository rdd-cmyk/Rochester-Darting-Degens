'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';
import { LinkedPlayerName } from '@/components/LinkedPlayerName';
import { clearMatchesState } from '@/lib/matchState';

// Simple types
type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
};

type MatchPlayerProfile = {
  display_name: string | null;
  first_name: string | null;
};

type MatchPlayer = {
  id: number;
  match_id: number;
  player_id: string;
  score: number | null;
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
};

export default function MatchesPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [gameType, setGameType] = useState('501');
  const [notes, setNotes] = useState('');
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerEntries, setPlayerEntries] = useState<PlayerEntry[]>([
    { playerId: '', stat: '' },
    { playerId: '', stat: '' },
  ]);
  const [winnerPlayerId, setWinnerPlayerId] = useState<string>('');
  const [boardType, setBoardType] = useState('');
  const [venue, setVenue] = useState('');

  // Edit state
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 10;

  const isCricket = gameType === 'Cricket';
  const isOther = gameType === 'Other';

  const formStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    maxWidth: '520px',
  };

  const fieldRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    justifyContent: 'space-between',
    width: '100%',
  } as const;

  const labelTextStyle = {
    minWidth: '150px',
    fontWeight: 600,
  };

  const controlStyle = {
    flex: 1,
    maxWidth: '260px',
  } as const;

  const selectStyle = {
    ...controlStyle,
    color: 'var(--input-text)',
    backgroundColor: 'var(--input-bg)',
  } as const;

  const optionStyle = {
    color: 'var(--input-text)',
    backgroundColor: 'var(--input-bg)',
  } as const;

  const player1Profile =
    profiles.find((p) => p.id === playerEntries[0]?.playerId) || null;
  const player2Profile =
    profiles.find((p) => p.id === playerEntries[1]?.playerId) || null;

  const player1Name = player1Profile
    ? formatPlayerName(player1Profile.display_name, player1Profile.first_name)
    : 'Player 1';

  const player2Name = player2Profile
    ? formatPlayerName(player2Profile.display_name, player2Profile.first_name)
    : 'Player 2';

  // Helper to resize playerEntries when numPlayers changes
  function ensurePlayerEntriesSize(targetSize: number) {
    setPlayerEntries((prev) => {
      const copy = [...prev];
      if (copy.length < targetSize) {
        const toAdd = targetSize - copy.length;
        for (let i = 0; i < toAdd; i++) {
          copy.push({ playerId: '', stat: '' });
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
      const copy = [...prev];
      if (!copy[index]) copy[index] = { playerId: '', stat: '' };
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

  function handleStatChange(index: number, stat: string) {
    setPlayerEntries((prev) => {
      const copy = [...prev];
      if (!copy[index]) copy[index] = { playerId: '', stat: '' };
      copy[index] = { ...copy[index], stat };
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
          is_winner,
          profiles (
            display_name,
            first_name
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
        .select('id, display_name, first_name')
        .order('display_name', { ascending: true });

      if (profilesError) {
        setErrorMessage('Error loading profiles: ' + profilesError.message);
      } else {
        setProfiles(profilesData || []);
      }

      // 3) Load recent matches (with players) - first page
      try {
        await reloadMatches(1);
      } catch (matchesError: any) {
        setErrorMessage((prev) =>
          (prev ? prev + ' | ' : '') +
          'Error loading matches: ' +
          (matchesError?.message ?? String(matchesError))
        );
      }

      setLoading(false);
    }

    load();
  }, []);

  function resetForm() {
    setGameType('501');
    setNotes('');
    setNumPlayers(2);
    setPlayerEntries([
      { playerId: '', stat: '' },
      { playerId: '', stat: '' },
    ]);
    setWinnerPlayerId('');
    setBoardType('');
    setVenue('');
    setEditingMatchId(null);
  }

  async function handleSaveMatch(e: FormEvent) {
    e.preventDefault();
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
    const parsedStats: number[] = [];
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

        if (maxStat !== null) {
          // No negative numbers allowed
          if (statNum < 0) {
            setErrorMessage('Stats cannot be negative.');
            return;
          }
          // Over absolute cap
          if (statNum > maxStat) {
            setErrorMessage(
              'Put in the actual score, you lying sack of shit'
            );
            return;
          }
        }
      }

      parsedStats.push(statNum);
    }

    try {
      if (editingMatchId == null) {
        // ➕ CREATE a new match
        const { data: matchInsertData, error: matchInsertError } = await supabase
          .from('matches')
          .insert([
            {
              game_type: gameType,
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
    } catch (err: any) {
      console.error('Error saving match:', err);
      setErrorMessage('Error saving match: ' + err.message);
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
      }));

    // If fewer than clampedCount, pad
    while (entries.length < clampedCount) {
      entries.push({ playerId: '', stat: '' });
    }

    setPlayerEntries(entries);

    const winnerMp = players.find((mp) => mp.is_winner);
    setWinnerPlayerId(winnerMp ? winnerMp.player_id : '');

    setEditingMatchId(match.id);
    setGameType(match.game_type || '501');
    setNotes(match.notes || '');
    setBoardType(match.board_type || '');
    setVenue(match.venue || '');
  }

  if (loading) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Matches</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Matches</h1>
        <p>You must be signed in to view and add matches.</p>
        <p>
          <Link
            href="/auth"
            style={{
              cursor: 'pointer',
              color: '#0366d6',
              textDecoration: 'underline',
              fontWeight: 500,
            }}
          >
            Go to sign in / sign up
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: '2rem',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <header>
        <h1>Darts Matches</h1>
        <p
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>
            Logged in as <strong>{user.email}</strong>.
          </span>
          <Link
            href="/"
            style={{
              cursor: 'pointer',
              padding: '0.3rem 0.7rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
              backgroundColor: '#0366d6',
              color: 'white',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Back to home
          </Link>
        </p>
      </header>

      {errorMessage && (
        <div style={{ color: 'red' }}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Add / Edit Match Form */}
      <section>
        <h2
          style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            marginBottom: '0.75rem',
            paddingBottom: '0.35rem',
            borderBottom: '2px solid #e2e8f0',
          }}
        >
          {editingMatchId ? 'Edit Match' : 'Record a New Match'}
        </h2>
        {profiles.length < 2 && (
          <p style={{ color: 'orange' }}>
            You currently have fewer than 2 profiles. Ask your friends to sign
            up on the{' '}
            <Link
              href="/auth"
              style={{
                cursor: 'pointer',
                color: '#0366d6',
                textDecoration: 'underline',
                fontWeight: 500,
              }}
            >
              auth page
            </Link>{' '}
            so they appear here.
          </p>
        )}

        <form onSubmit={handleSaveMatch} style={formStyle}>
          {/* Game type */}
          <div style={fieldRowStyle}>
            <span style={labelTextStyle}>Game type</span>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              style={selectStyle}
            >
              <option value="501" style={optionStyle}>
                501
              </option>
              <option value="301" style={optionStyle}>
                301
              </option>
              <option value="Cricket" style={optionStyle}>
                Cricket
              </option>
              <option value="Other" style={optionStyle}>
                Other
              </option>
            </select>
          </div>

          {/* Notes */}
          <div style={fieldRowStyle}>
            <span style={labelTextStyle}>Notes</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="'Other' game type, e.g."
              style={controlStyle}
            />
          </div>

          {/* Number of players */}
          <div style={fieldRowStyle}>
            <span style={labelTextStyle}>Number of players</span>
            <select
              value={numPlayers}
              onChange={(e) => handleNumPlayersChange(e.target.value)}
              style={selectStyle}
            >
              {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n} style={optionStyle}>
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
              : `${playerLabel} 3-Dart Average`;

            return (
              <div
                key={index}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '0.5rem',
                  padding: '0.5rem',
                  marginTop: '0.25rem',
                }}
              >
                <div style={fieldRowStyle}>
                  <span style={labelTextStyle}>{playerLabel}</span>
                  <select
                    value={entry.playerId}
                    onChange={(e) => handlePlayerChange(index, e.target.value)}
                    style={selectStyle}
                  >
                    <option value="" style={optionStyle}>
                      -- choose player --
                    </option>
                    {profiles.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        style={optionStyle}
                      >
                        {formatPlayerName(p.display_name, p.first_name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ ...fieldRowStyle, marginTop: '0.25rem' }}>
                  <span style={labelTextStyle}>{statLabel}</span>
                  <input
                    type="number"
                    step={isOther ? 1 : 0.01}
                    min={isOther ? 1 : undefined}
                    max={isOther ? 9999 : undefined}
                    value={entry.stat}
                    onChange={(e) => handleStatChange(index, e.target.value)}
                    placeholder={
                      isCricket ? 'e.g. 3.25' : isOther ? 'e.g. 250' : 'e.g. 87.50'
                    }
                    style={controlStyle}
                  />
                </div>
              </div>
            );
          })}

          {/* Winner selection */}
          <div style={fieldRowStyle}>
            <span style={labelTextStyle}>Winner</span>
            <select
              value={winnerPlayerId}
              onChange={(e) => setWinnerPlayerId(e.target.value)}
              style={selectStyle}
            >
              <option value="" style={optionStyle}>
                -- select winner --
              </option>
              {playerEntries.slice(0, numPlayers).map((entry, index) => {
                const profile = profiles.find((p) => p.id === entry.playerId);
                const label = profile
                  ? formatPlayerName(profile.display_name, profile.first_name)
                  : entry.playerId
                  ? `Player ${index + 1}`
                  : `Player ${index + 1} (select player above)`;

                return (
                  <option
                    key={entry.playerId || `winner-${index}`}
                    value={entry.playerId}
                    disabled={!entry.playerId}
                    style={optionStyle}
                  >
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Board type */}
          <div style={fieldRowStyle}>
            <span style={labelTextStyle}>Board type</span>
            <select
              value={boardType}
              onChange={(e) => setBoardType(e.target.value)}
              style={selectStyle}
            >
              <option value="" style={optionStyle}>
                -- choose --
              </option>
              <option value="Soft Tip" style={optionStyle}>
                Soft Tip
              </option>
              <option value="Steel Tip" style={optionStyle}>
                Steel Tip
              </option>
            </select>
          </div>

          {/* Venue */}
          <div style={fieldRowStyle}>
            <span style={labelTextStyle}>Venue</span>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Radio Social, e.g."
              style={controlStyle}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginTop: '0.5rem',
            }}
          >
            <button
              type="submit"
              style={{
                cursor: 'pointer',
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #ccc',
                backgroundColor: '#0366d6',
                color: 'white',
                fontWeight: 500,
              }}
            >
              {editingMatchId ? 'Save changes' : 'Save match'}
            </button>

            {editingMatchId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  cursor: 'pointer',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #ccc',
                  backgroundColor: '#eee',
                  color: '#333',
                  fontWeight: 500,
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Recent Matches */}
      <section>
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            borderBottom: '3px solid #0366d6',
            paddingBottom: '0.35rem',
            display: 'inline-block',
            marginBottom: '0.5rem',
          }}
        >
          Recent Matches
        </h2>
        {matches.length === 0 ? (
          <p>No matches recorded yet.</p>
        ) : (
          <>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
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
                    style={{
                      border: '1px solid #ccc',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
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
                          style={{
                            cursor: 'pointer',
                            padding: '0.3rem 0.7rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #ccc',
                            backgroundColor: '#eee',
                            color: '#000',
                            fontWeight: 500,
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    <div style={{ marginTop: '0.5rem' }}>
                      Players:
                      <ul style={{ margin: '0.25rem 0 0 1rem' }}>
                        {(m.match_players || []).map((mp) => {
                          const prof = (Array.isArray(mp.profiles)
  ? mp.profiles[0]
  : mp.profiles) as { display_name: string | null; first_name: string | null } | null;

                          return (
                            <li key={mp.id}>
                              {prof ? (
                                <LinkedPlayerName
                                  playerId={mp.player_id}
                                  display_name={prof.display_name}
                                  first_name={prof.first_name}
                                />
                              ) : (
                                'Unknown player'
                              )}{' '}
                              – {metricLabel}:{' '}
                              {mp.score != null ? mp.score.toString() : '0'}{' '}
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
            <div
              style={{
                marginTop: '1rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => reloadMatches(currentPage - 1)}
                disabled={currentPage <= 1}
                style={{
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #ccc',
                  backgroundColor:
                    currentPage <= 1 ? '#8cbce8' : '#0366d6',
                  color: 'white',
                  fontWeight: 500,
                }}
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
                style={{
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #ccc',
                  backgroundColor:
                    currentPage >= totalPages ? '#8cbce8' : '#0366d6',
                  color: 'white',
                  fontWeight: 500,
                }}
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
