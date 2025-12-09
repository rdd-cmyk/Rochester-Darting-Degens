'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';
import { LinkedPlayerName } from '@/components/LinkedPlayerName';

type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
};

type MatchRow = {
  player_id: string;
  is_winner: boolean | null;
  score: number | null;
  profiles: Profile | null;
  matches: {
    game_type: string | null;
    played_at: string;
  } | null;
};

type WinLossStats = {
  playerId: string;
  displayName: string;
  wins: number;
  losses: number;
  games: number;
  winPct: number;
  streak: string;
  last5: string;
};

type AverageStats = {
  playerId: string;
  displayName: string;
  avg: number;
  games: number;
};

export default function Home() {
  const [winLossStats, setWinLossStats] = useState<WinLossStats[]>([]);
  const [threeDartStats, setThreeDartStats] = useState<AverageStats[]>([]);
  const [mprStats, setMprStats] = useState<AverageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from('match_players')
        .select(
          `
          player_id,
          is_winner,
          score,
          profiles (
            id,
            display_name,
            first_name
          ),
          matches (
            game_type,
            played_at
          )
        `
        );

      if (error) {
        console.error('Error loading leaderboard stats:', error);
        setErrorMessage('Error loading leaderboard.');
        setLoading(false);
        return;
      }

      // Normalize Supabase response so profiles/matches are single objects, not arrays
      const rawRows = (data || []) as any[];

      const rows: MatchRow[] = rawRows.map((r) => ({
        player_id: r.player_id,
        is_winner: r.is_winner,
        score: r.score,
        profiles: Array.isArray(r.profiles)
          ? (r.profiles[0] ?? null)
          : (r.profiles ?? null),
        matches: Array.isArray(r.matches)
          ? (r.matches[0] ?? null)
          : (r.matches ?? null),
      }));

      // Overall W/L + games
      const wlMap = new Map<
        string,
        {
          playerId: string;
          displayName: string;
          wins: number;
          losses: number;
          games: number;
        }
      >();

      // Per–player chronological outcomes for streak + last 5
      const outcomesMap = new Map<
        string,
        { playedAt: string; isWin: boolean }[]
      >();

      // Averages
      const threeMap = new Map<
        string,
        { playerId: string; displayName: string; total: number; games: number }
      >();

      const mprMap = new Map<
        string,
        { playerId: string; displayName: string; total: number; games: number }
      >();

      for (const row of rows) {
        const playerId = row.player_id;
        if (!playerId) continue;

        const prof = row.profiles;
        const displayName = prof
          ? formatPlayerName(prof.display_name, prof.first_name)
          : 'Unknown player';

        const gameType = row.matches?.game_type || null;
        const playedAt =
          row.matches?.played_at || '1970-01-01T00:00:00.000Z';
        const isCricket = gameType === 'Cricket';
        const score = row.score ?? null;
        const isWin = row.is_winner === true;

        // ---- Wins / Losses / Games ----
        let wl = wlMap.get(playerId);
        if (!wl) {
          wl = {
            playerId,
            displayName,
            wins: 0,
            losses: 0,
            games: 0,
          };
          wlMap.set(playerId, wl);
        }

        wl.games += 1;
        if (isWin) {
          wl.wins += 1;
        } else {
          wl.losses += 1;
        }

        // ---- Outcomes for streak / last 5 ----
        let outcomes = outcomesMap.get(playerId);
        if (!outcomes) {
          outcomes = [];
          outcomesMap.set(playerId, outcomes);
        }
        outcomes.push({ playedAt, isWin });

        // ---- 3-Dart Average (non-Cricket) ----
        if (!isCricket && typeof score === 'number') {
          let three = threeMap.get(playerId);
          if (!three) {
            three = {
              playerId,
              displayName,
              total: 0,
              games: 0,
            };
            threeMap.set(playerId, three);
          }
          three.total += score;
          three.games += 1;
        }

        // ---- MPR (Cricket only) ----
        if (isCricket && typeof score === 'number') {
          let mpr = mprMap.get(playerId);
          if (!mpr) {
            mpr = {
              playerId,
              displayName,
              total: 0,
              games: 0,
            };
            mprMap.set(playerId, mpr);
          }
          mpr.total += score;
          mpr.games += 1;
        }
      }

      // Finalize win/loss stats with streak + last 5
      const wlList: WinLossStats[] = Array.from(wlMap.values())
        .map((e) => {
          const outcomes = outcomesMap.get(e.playerId) ?? [];

          // Sort by playedAt ascending for correct chronological order
          outcomes.sort(
            (a, b) =>
              new Date(a.playedAt).getTime() -
              new Date(b.playedAt).getTime()
          );

          let streak = '';
          let last5 = '';

          if (outcomes.length > 0) {
            // ---- Streak calculation (most recent run) ----
            let streakType: 'W' | 'L' | null = null;
            let streakCount = 0;

            for (let i = outcomes.length - 1; i >= 0; i--) {
              const res = outcomes[i].isWin ? 'W' : 'L';
              if (streakType === null) {
                streakType = res;
                streakCount = 1;
              } else if (streakType === res) {
                streakCount += 1;
              } else {
                break;
              }
            }

            if (streakType) {
              streak = `${streakType}${streakCount}`;
            }

            // ---- Last 5 calculation ----
            const recent = outcomes.slice(-5);
            const wins5 = recent.filter((o) => o.isWin).length;
            const losses5 = recent.length - wins5;
            last5 = `${wins5}-${losses5}`;
          }

          const winPct = e.games > 0 ? (e.wins / e.games) * 100 : 0;

          return {
            playerId: e.playerId,
            displayName: e.displayName,
            wins: e.wins,
            losses: e.losses,
            games: e.games,
            winPct,
            streak,
            last5,
          };
        })
        .sort((a, b) => {
          if (b.winPct !== a.winPct) return b.winPct - a.winPct;
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.games - a.games;
        });

      // Finalize 3-dart stats
      const threeList: AverageStats[] = Array.from(threeMap.values())
        .map((e) => ({
          playerId: e.playerId,
          displayName: e.displayName,
          avg: e.games > 0 ? e.total / e.games : 0,
          games: e.games,
        }))
        .filter((e) => e.games > 0)
        .sort((a, b) => {
          if (b.avg !== a.avg) return b.avg - a.avg;
          return b.games - a.games;
        });

      // Finalize MPR stats
      const mprList: AverageStats[] = Array.from(mprMap.values())
        .map((e) => ({
          playerId: e.playerId,
          displayName: e.displayName,
          avg: e.games > 0 ? e.total / e.games : 0,
          games: e.games,
        }))
        .filter((e) => e.games > 0)
        .sort((a, b) => {
          if (b.avg !== a.avg) return b.avg - a.avg;
          return b.games - a.games;
        });

      setWinLossStats(wlList);
      setThreeDartStats(threeList);
      setMprStats(mprList);
      setLoading(false);
    }

    loadStats();
  }, []);

  return (
    <main
      style={{
        padding: '2rem',
        fontFamily: 'sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      {/* Intro / hero */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h1>Rochester Darting Degens - Darts Night Tracker</h1>
        <p>
          Welcome! This will be the home for stats, matches, and leaderboards.
        </p>
        <p>
          Next RDD Dart Night - Thursday, 12/18, 6:00 PM, Radio Social.
        </p>

        <p>
          <Link
            href="/auth"
            style={{
              cursor: 'pointer',
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
              backgroundColor: '#0366d6',
              color: 'white',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-block',
              marginRight: '0.5rem',
            }}
          >
            Go to sign in / sign up
          </Link>

          <Link
            href="/matches"
            style={{
              cursor: 'pointer',
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
              backgroundColor: '#eee',
              color: '#333',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View recent matches
          </Link>
        </p>
      </section>

      {/* Overall W/L Leaderboard */}
      <section>
        <h2>Overall Leaderboard (All Match Types)</h2>

        {loading ? (
          <p>Loading leaderboard...</p>
        ) : errorMessage ? (
          <p style={{ color: 'red' }}>{errorMessage}</p>
        ) : winLossStats.length === 0 ? (
          <p>No matches recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Player
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Wins
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Losses
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Games
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Win %
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Streak
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Last 5
                  </th>
                </tr>
              </thead>
              <tbody>
                {winLossStats.map((s, index) => (
                  <tr key={s.playerId}>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      {index + 1}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      <LinkedPlayerName
                        playerId={s.playerId}
                        preformattedName={s.displayName}
                      />
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.wins}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.losses}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.games}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.winPct.toFixed(1)}%
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.streak || '—'}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.last5 || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3-Dart Average Leaderboard (non-Cricket) */}
      <section>
        <h2>3-Dart Average Leaderboard (501 / 301 / Other)</h2>
        {loading ? (
          <p>Loading 3-dart averages...</p>
        ) : threeDartStats.length === 0 ? (
          <p>No non-Cricket matches recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Player
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    3-Dart Avg
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Games
                  </th>
                </tr>
              </thead>
              <tbody>
                {threeDartStats.map((s, index) => (
                  <tr key={s.playerId}>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      {index + 1}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      <LinkedPlayerName
                        playerId={s.playerId}
                        preformattedName={s.displayName}
                      />
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.avg.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.games}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MPR Leaderboard (Cricket) */}
      <section>
        <h2>MPR Leaderboard (Cricket)</h2>
        {loading ? (
          <p>Loading MPR stats...</p>
        ) : mprStats.length === 0 ? (
          <p>No Cricket matches recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Player
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    MPR
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    Games
                  </th>
                </tr>
              </thead>
              <tbody>
                {mprStats.map((s, index) => (
                  <tr key={s.playerId}>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      {index + 1}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      <LinkedPlayerName
                        playerId={s.playerId}
                        preformattedName={s.displayName}
                      />
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.avg.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.games}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
