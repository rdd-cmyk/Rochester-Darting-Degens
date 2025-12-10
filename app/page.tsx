'use client';

import { useEffect, useState } from 'react';
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

type MatchRowResult = {
  player_id: string;
  is_winner: boolean | null;
  score: number | null;
  profiles: Profile | Profile[] | null;
  matches:
    | {
        game_type: string | null;
        played_at: string;
      }
    | { game_type: string | null; played_at: string }[]
    | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

      // Normalize Supabase response so profiles/matches are single objects, not arrays
      const rawRows: MatchRowResult[] = data ?? [];

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
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-8 font-[var(--font-geist-sans)] md:px-6 lg:px-10">
      {/* Intro / hero */}
      <section className="space-y-3 rounded-xl bg-[var(--background)]/60 px-3 py-4 shadow-sm ring-1 ring-[var(--input-border)]/70 md:px-5 md:py-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Rochester Darting Degens - Darts Night Tracker
          </h1>
          <p className="text-base text-[var(--foreground)]/90">
            Welcome! This will be the home for stats, matches, and leaderboards.
          </p>
          <p className="text-base font-medium text-[var(--foreground)]/90">
            Next RDD Dart Night - Thursday, 12/18, 6:00 PM, Radio Social.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm font-medium sm:text-base">
          {!authLoading && !user && (
            <Link
              href="/auth"
              className="inline-flex items-center justify-center rounded-lg border border-transparent bg-[#0366d6] px-4 py-2 text-white shadow-sm transition hover:bg-[#035ac0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0366d6]"
            >
              Go to sign in / sign up
            </Link>
          )}

          <Link
            href="/matches"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--input-border)] bg-[#f1f5f9] px-4 py-2 text-[var(--foreground)] shadow-sm transition hover:bg-[#e5e7eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--input-border)]"
          >
            View recent matches
          </Link>
        </div>
      </section>

      {/* Overall W/L Leaderboard */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Overall Leaderboard (All Match Types)</h2>

        {loading ? (
          <p>Loading leaderboard...</p>
        ) : errorMessage ? (
          <p className="text-red-600">{errorMessage}</p>
        ) : winLossStats.length === 0 ? (
          <p>No matches recorded yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 md:hidden">
              {winLossStats.map((s, index) => (
                <article
                  key={s.playerId}
                  className="rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                      <span className="rounded-full bg-[#e5e7eb] px-2 py-1 text-xs font-semibold text-[#111827]">
                        #{index + 1}
                      </span>
                      <LinkedPlayerName
                        playerId={s.playerId}
                        preformattedName={s.displayName}
                      />
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]/80">
                      {s.winPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[var(--foreground)]/80">
                    <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                      <span className="font-medium">Wins</span>
                      <span>{s.wins}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                      <span className="font-medium">Losses</span>
                      <span>{s.losses}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                      <span className="font-medium">Games</span>
                      <span>{s.games}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                      <span className="font-medium">Streak</span>
                      <span>{s.streak || '—'}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                      <span className="font-medium">Last 5</span>
                      <span>{s.last5 || '—'}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--input-border)] text-left text-[var(--foreground)]/80">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Player</th>
                    <th className="px-3 py-2 text-right font-semibold">Wins</th>
                    <th className="px-3 py-2 text-right font-semibold">Losses</th>
                    <th className="px-3 py-2 text-right font-semibold">Games</th>
                    <th className="px-3 py-2 text-right font-semibold">Win %</th>
                    <th className="px-3 py-2 text-right font-semibold">Streak</th>
                    <th className="px-3 py-2 text-right font-semibold">Last 5</th>
                  </tr>
                </thead>
                <tbody>
                  {winLossStats.map((s, index) => (
                    <tr
                      key={s.playerId}
                      className="border-b border-[#e5e7eb] text-[var(--foreground)]"
                    >
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">
                        <LinkedPlayerName
                          playerId={s.playerId}
                          preformattedName={s.displayName}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">{s.wins}</td>
                      <td className="px-3 py-2 text-right">{s.losses}</td>
                      <td className="px-3 py-2 text-right">{s.games}</td>
                      <td className="px-3 py-2 text-right">{s.winPct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">{s.streak || '—'}</td>
                      <td className="px-3 py-2 text-right">{s.last5 || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* 3-Dart Average Leaderboard */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3-Dart Average Leaderboard (501 / 301)</h2>
        {loading ? (
          <p>Loading 3-dart stats...</p>
        ) : threeDartStats.length === 0 ? (
          <p>No 501/301 matches recorded yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 md:hidden">
              {threeDartStats.map((s, index) => (
                <article
                  key={s.playerId}
                  className="rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                      <span className="rounded-full bg-[#e5e7eb] px-2 py-1 text-xs font-semibold text-[#111827]">
                        #{index + 1}
                      </span>
                      <LinkedPlayerName
                        playerId={s.playerId}
                        preformattedName={s.displayName}
                      />
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]/80">
                      {s.avg.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[var(--foreground)]/80">
                    <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                      <span className="font-medium">Games</span>
                      <span>{s.games}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--input-border)] text-left text-[var(--foreground)]/80">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Player</th>
                    <th className="px-3 py-2 text-right font-semibold">3-Dart Avg</th>
                    <th className="px-3 py-2 text-right font-semibold">Games</th>
                  </tr>
                </thead>
                <tbody>
                  {threeDartStats.map((s, index) => (
                    <tr
                      key={s.playerId}
                      className="border-b border-[#e5e7eb] text-[var(--foreground)]"
                    >
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">
                        <LinkedPlayerName
                          playerId={s.playerId}
                          preformattedName={s.displayName}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">{s.avg.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{s.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* MPR Leaderboard (Cricket) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">MPR Leaderboard (Cricket)</h2>
        {loading ? (
          <p>Loading MPR stats...</p>
        ) : mprStats.length === 0 ? (
          <p>No Cricket matches recorded yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 md:hidden">
              {mprStats.map((s, index) => (
                <article
                  key={s.playerId}
                  className="rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                      <span className="rounded-full bg-[#e5e7eb] px-2 py-1 text-xs font-semibold text-[#111827]">
                        #{index + 1}
                      </span>
                      <LinkedPlayerName
                        playerId={s.playerId}
                        preformattedName={s.displayName}
                      />
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]/80">
                      {s.avg.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[var(--foreground)]/80">
                    <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                      <span className="font-medium">Games</span>
                      <span>{s.games}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--input-border)] text-left text-[var(--foreground)]/80">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Player</th>
                    <th className="px-3 py-2 text-right font-semibold">MPR</th>
                    <th className="px-3 py-2 text-right font-semibold">Games</th>
                  </tr>
                </thead>
                <tbody>
                  {mprStats.map((s, index) => (
                    <tr
                      key={s.playerId}
                      className="border-b border-[#e5e7eb] text-[var(--foreground)]"
                    >
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">
                        <LinkedPlayerName
                          playerId={s.playerId}
                          preformattedName={s.displayName}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">{s.avg.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{s.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
