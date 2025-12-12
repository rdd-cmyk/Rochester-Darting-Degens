'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';
import { LinkedPlayerName } from '@/components/LinkedPlayerName';
import type { User } from '@supabase/supabase-js';

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
  last10: string;
};

type AverageStats = {
  playerId: string;
  displayName: string;
  avg: number;
  games: number;
};

export default function Home() {
  const router = useRouter();
  const [winLossStats, setWinLossStats] = useState<WinLossStats[]>([]);
  const [threeDartStats, setThreeDartStats] = useState<AverageStats[]>([]);
  const [mprStats, setMprStats] = useState<AverageStats[]>([]);
  const [wlSort, setWlSort] = useState<{
    column:
      | 'player'
      | 'wins'
      | 'losses'
      | 'games'
      | 'winPct'
      | 'streak'
      | 'last5'
      | 'last10';
    direction: 'asc' | 'desc';
  }>({ column: 'winPct', direction: 'desc' });
  const [threeSort, setThreeSort] = useState<{ column: 'player' | 'avg' | 'games'; direction: 'asc' | 'desc' }>(
    {
      column: 'avg',
      direction: 'desc',
    }
  );
  const [mprSort, setMprSort] = useState<{ column: 'player' | 'avg' | 'games'; direction: 'asc' | 'desc' }>(
    {
      column: 'avg',
      direction: 'desc',
    }
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleRecoveryFromHash() {
      const hash = window.location.hash;
      if (!hash || hash.length < 2) return;

      const params = new URLSearchParams(hash.slice(1));
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      if (error) {
        setAuthErrorMessage(
          errorDescription ||
            'Password reset link is invalid or has expired. Please request a new email.'
        );
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      const type = params.get('type');

      if (type === 'recovery' && hash.length > 1) {
        router.replace(`/reset-password${hash}`);
      }
    }

    handleRecoveryFromHash();
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUser(data.user ?? null);
      setAuthLoading(false);
    }

    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

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
          matches!inner (
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

      type RawMatchRow = {
        player_id: string;
        is_winner: boolean | null;
        score: number | null;
        profiles: Profile | Profile[] | null;
        matches: MatchRow['matches'] | MatchRow['matches'][] | null;
      };

      // Normalize Supabase response so profiles/matches are single objects, not arrays
      const rawRows = (data || []) as RawMatchRow[];

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
        const isX01Game = gameType === '501' || gameType === '301';
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

        // ---- 3-Dart Average (501 / 301 only) ----
        if (isX01Game && typeof score === 'number') {
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
          let last10 = '';

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

            const recent10 = outcomes.slice(-10);
            const wins10 = recent10.filter((o) => o.isWin).length;
            const losses10 = recent10.length - wins10;
            last10 = `${wins10}-${losses10}`;
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
            last10,
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

  const toggleSort = <T extends string>(
    current: { column: T; direction: 'asc' | 'desc' },
    column: T,
    defaultDirection: 'asc' | 'desc'
  ) => {
    if (current.column === column) {
      return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' } as const;
    }
    return { column, direction: defaultDirection } as const;
  };

  const parseStreakValue = (streak: string) => {
    if (!streak) return 0;
    const type = streak[0];
    const count = Number(streak.slice(1)) || 0;
    return type === 'W' ? count : -count;
  };

  const recordSortValue = (record: string) => {
    const [winsStr, lossesStr] = record.split('-');
    const wins = Number(winsStr);
    const losses = Number(lossesStr);
    const total = wins + losses;

    if (Number.isNaN(wins) || Number.isNaN(losses) || total === 0) {
      return { ratio: -Infinity, wins: 0 } as const;
    }

    return { ratio: wins / total, wins } as const;
  };

  const sortedWinLossStats = useMemo(() => {
    const sorted = [...winLossStats];

    sorted.sort((a, b) => {
      const dir = wlSort.direction === 'asc' ? 1 : -1;

      switch (wlSort.column) {
        case 'player':
          return a.displayName.localeCompare(b.displayName) * dir;
        case 'wins':
          return (a.wins - b.wins) * dir;
        case 'losses':
          return (a.losses - b.losses) * dir;
        case 'games':
          return (a.games - b.games) * dir;
        case 'winPct':
          return (a.winPct - b.winPct) * dir;
        case 'streak':
          return (parseStreakValue(a.streak) - parseStreakValue(b.streak)) * dir;
        case 'last5': {
          const aRec = recordSortValue(a.last5);
          const bRec = recordSortValue(b.last5);
          if (aRec.ratio !== bRec.ratio) return (aRec.ratio - bRec.ratio) * dir;
          return (aRec.wins - bRec.wins) * dir;
        }
        case 'last10': {
          const aRec = recordSortValue(a.last10);
          const bRec = recordSortValue(b.last10);
          if (aRec.ratio !== bRec.ratio) return (aRec.ratio - bRec.ratio) * dir;
          return (aRec.wins - bRec.wins) * dir;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [winLossStats, wlSort]);

  const sortAverageStats = (
    stats: AverageStats[],
    sort: { column: 'player' | 'avg' | 'games'; direction: 'asc' | 'desc' }
  ) => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...stats].sort((a, b) => {
      switch (sort.column) {
        case 'player':
          return a.displayName.localeCompare(b.displayName) * dir;
        case 'games':
          return (a.games - b.games) * dir;
        case 'avg':
        default:
          return (a.avg - b.avg) * dir;
      }
    });
  };

  const sortedThreeDartStats = useMemo(
    () => sortAverageStats(threeDartStats, threeSort),
    [threeDartStats, threeSort]
  );

  const sortedMprStats = useMemo(() => sortAverageStats(mprStats, mprSort), [mprStats, mprSort]);

  const renderHeaderButton = <T extends string>(
    label: string,
    column: T,
    sort: { column: T; direction: 'asc' | 'desc' },
    onChange: (next: { column: T; direction: 'asc' | 'desc' }) => void,
    defaultDirection: 'asc' | 'desc'
  ) => (
    <button
      type="button"
      onClick={() => onChange(toggleSort(sort, column, defaultDirection))}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'inherit',
        fontWeight: 600,
      }}
    >
      {label}{' '}
      {sort.column === column ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
    </button>
  );

  const renderSkeletonRows = (
    columns: { width?: string; align?: 'left' | 'right' }[],
    count = 6
  ) =>
    Array.from({ length: count }).map((_, rowIndex) => (
      <tr key={rowIndex}>
        {columns.map((col, colIndex) => (
          <td
            key={`${rowIndex}-${colIndex}`}
            style={{
              padding: '0.5rem',
              borderBottom: '1px solid #eee',
              textAlign: col.align ?? 'left',
            }}
          >
            <div
              aria-hidden
              style={{
                height: '1rem',
                width: col.width ?? '100%',
                backgroundColor: '#2f2f2f',
                borderRadius: '0.35rem',
              }}
            />
          </td>
        ))}
      </tr>
    ));

  const winLossSkeletonColumns = [
    { width: '1.5rem', align: 'left' },
    { width: '70%', align: 'left' },
    { width: '2.5rem', align: 'right' },
    { width: '3rem', align: 'right' },
    { width: '3rem', align: 'right' },
    { width: '3.5rem', align: 'right' },
    { width: '3.5rem', align: 'right' },
    { width: '3.5rem', align: 'right' },
    { width: '4rem', align: 'right' },
  ] satisfies { width?: string; align?: 'left' | 'right' }[];

  const averageSkeletonColumns = [
    { width: '1.5rem', align: 'left' },
    { width: '70%', align: 'left' },
    { width: '4rem', align: 'right' },
    { width: '3rem', align: 'right' },
  ] satisfies { width?: string; align?: 'left' | 'right' }[];

  return (
    <main
      className="page-shell"
      style={{
        minHeight: '100vh',
        gap: 'var(--section-gap)',
        maxWidth: '1000px',
      }}
    >
      {authErrorMessage && (
        <p style={{ color: 'red' }}>{authErrorMessage}</p>
      )}

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
          {!authLoading && !user && (
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
          )}

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
        <h2 className="leaderboard-title">Overall Leaderboard (All Match Types)</h2>

        {loading ? (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minHeight: '320px',
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
                    {renderHeaderButton('Player', 'player', wlSort, setWlSort, 'asc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Wins', 'wins', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Losses', 'losses', wlSort, setWlSort, 'asc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Games', 'games', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Win %', 'winPct', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Streak', 'streak', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Last 5', 'last5', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Last 10', 'last10', wlSort, setWlSort, 'desc')}
                  </th>
                </tr>
              </thead>
              <tbody>{renderSkeletonRows(winLossSkeletonColumns, 7)}</tbody>
            </table>
          </div>
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
                    {renderHeaderButton('Player', 'player', wlSort, setWlSort, 'asc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Wins', 'wins', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Losses', 'losses', wlSort, setWlSort, 'asc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Games', 'games', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Win %', 'winPct', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Streak', 'streak', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Last 5', 'last5', wlSort, setWlSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Last 10', 'last10', wlSort, setWlSort, 'desc')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedWinLossStats.map((s, index) => (
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
                    <td
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #eee',
                        textAlign: 'right',
                      }}
                    >
                      {s.last10 || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3-Dart Average Leaderboard (501 / 301) */}
      <section>
        <h2 className="leaderboard-title">3-Dart Average Leaderboard (501 / 301)</h2>
        {loading ? (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minHeight: '240px',
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
                    {renderHeaderButton('Player', 'player', threeSort, setThreeSort, 'asc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('3-Dart Avg', 'avg', threeSort, setThreeSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Games', 'games', threeSort, setThreeSort, 'desc')}
                  </th>
                </tr>
              </thead>
              <tbody>{renderSkeletonRows(averageSkeletonColumns, 6)}</tbody>
            </table>
          </div>
        ) : threeDartStats.length === 0 ? (
          <p>No 501 or 301 matches recorded yet.</p>
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
                    {renderHeaderButton('Player', 'player', threeSort, setThreeSort, 'asc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('3-Dart Avg', 'avg', threeSort, setThreeSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Games', 'games', threeSort, setThreeSort, 'desc')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedThreeDartStats.map((s, index) => (
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
        <h2 className="leaderboard-title">MPR Leaderboard (Cricket)</h2>
        {loading ? (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minHeight: '240px',
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
                    {renderHeaderButton('Player', 'player', mprSort, setMprSort, 'asc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('MPR', 'avg', mprSort, setMprSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Games', 'games', mprSort, setMprSort, 'desc')}
                  </th>
                </tr>
              </thead>
              <tbody>{renderSkeletonRows(averageSkeletonColumns, 6)}</tbody>
            </table>
          </div>
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
                    {renderHeaderButton('Player', 'player', mprSort, setMprSort, 'asc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('MPR', 'avg', mprSort, setMprSort, 'desc')}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #ccc',
                      padding: '0.5rem',
                    }}
                  >
                    {renderHeaderButton('Games', 'games', mprSort, setMprSort, 'desc')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMprStats.map((s, index) => (
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
