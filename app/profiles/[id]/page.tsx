'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';
import { LinkedPlayerName } from '@/components/LinkedPlayerName';

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  sex: string | null;
};

type MatchRowForStats = {
  is_winner: boolean | null;
  score: number | null;
  matches: {
    game_type: string | null;
    played_at: string;
  } | null;
};

type MatchPlayerSummary = {
  id: number;
  match_id: number;
  player_id: string;
  score: number | null;
  is_winner: boolean | null;
  profiles?: {
    display_name: string | null;
    first_name: string | null;
  } | null;
};

type MatchSummary = {
  id: number;
  played_at: string;
  game_type: string | null;
  notes: string | null;
  board_type: string | null;
  venue: string | null;
  created_by: string | null;
  match_players: MatchPlayerSummary[] | null;
};

type PlayerStatsSummary = {
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  streak: string;
  last5: string;
  threeAvg: number;
  threeGames: number;
  mprAvg: number;
  mprGames: number;
};

export default function ProfilePage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<PlayerStatsSummary | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setErrorMessage('No profile id provided.');
      setLoading(false);
      return;
    }

    async function loadProfileAndStatsAndMatches() {
      setLoading(true);
      setErrorMessage(null);

      // 1) Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, display_name, sex')
        .eq('id', id)
        .single();

      if (profileError || !profileData) {
        console.error('Error loading profile:', profileError);
        setErrorMessage('Could not load profile.');
        setProfile(null);
        setStats(null);
        setRecentMatches([]);
        setLoading(false);
        return;
      }

      setProfile(profileData as Profile);

      // 2) Load this player's match data for stats
      const { data: matchesData, error: matchesError } = await supabase
        .from('match_players')
        .select(
          `
          is_winner,
          score,
          matches!inner (
            game_type,
            played_at
          )
        `
        )
        .eq('player_id', id);

      if (matchesError) {
        console.error('Error loading player stats:', matchesError);
        setErrorMessage('Could not load player stats.');
        setStats(null);
        // We'll still try to load recent matches below
      }

      const rawRows = (matchesData || []) as any[];

const rows: MatchRowForStats[] = rawRows.map((r) => ({
  is_winner: r.is_winner,
  score: r.score,
  matches: Array.isArray(r.matches)
    ? (r.matches[0] ?? null)
    : (r.matches ?? null),
}));

      // Aggregate stats for this player
      let games = 0;
      let wins = 0;
      let losses = 0;

      const outcomes: { playedAt: string; isWin: boolean }[] = [];

      let threeTotal = 0;
      let threeGames = 0;

      let mprTotal = 0;
      let mprGames = 0;

      for (const row of rows) {
        const gameType = row.matches?.game_type || null;
        const playedAt =
          row.matches?.played_at || '1970-01-01T00:00:00.000Z';
        const isCricket = gameType === 'Cricket';
        const isX01Game = gameType === '501' || gameType === '301';
        const score = row.score ?? null;
        const isWin = row.is_winner === true;

        // Overall W/L
        games += 1;
        if (isWin) {
          wins += 1;
        } else {
          losses += 1;
        }

        outcomes.push({ playedAt, isWin });

        // 3-dart average (501 / 301 only)
        if (isX01Game && typeof score === 'number') {
          threeTotal += score;
          threeGames += 1;
        }

        // MPR (Cricket only)
        if (isCricket && typeof score === 'number') {
          mprTotal += score;
          mprGames += 1;
        }
      }

      // Compute streak + last 5
      let streak = '';
      let last5 = '';
      if (outcomes.length > 0) {
        // Sort by date ascending
        outcomes.sort(
          (a, b) =>
            new Date(a.playedAt).getTime() -
            new Date(b.playedAt).getTime()
        );

        // Streak from most recent backwards
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

        // Last 5
        const recentOutcomes = outcomes.slice(-5);
        const wins5 = recentOutcomes.filter((o) => o.isWin).length;
        const losses5 = recentOutcomes.length - wins5;
        last5 = `${wins5}-${losses5}`;
      }

      const winPct = games > 0 ? (wins / games) * 100 : 0;
      const threeAvg = threeGames > 0 ? threeTotal / threeGames : 0;
      const mprAvg = mprGames > 0 ? mprTotal / mprGames : 0;

      setStats({
        games,
        wins,
        losses,
        winPct,
        streak,
        last5,
        threeAvg,
        threeGames,
        mprAvg,
        mprGames,
      });

      // 3) Load last 5 matches for this player (full match detail, same as matches page)
      const { data: matchesDetailData, error: matchesDetailError } =
        await supabase
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
            match_players!inner (
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
          `
          )
          .eq('match_players.player_id', id)
          .order('played_at', { ascending: false })
          .limit(5);

      if (matchesDetailError) {
        console.error('Error loading recent matches for profile:', matchesDetailError);
        setRecentMatches([]);
        setLoading(false);
        return;
      }

      const rawMatchDetails = (matchesDetailData || []) as any[];

      const normalizedMatchDetails: MatchSummary[] = rawMatchDetails.map((m) => ({
        ...m,
        match_players: (m.match_players || []).map((mp: any) => ({
          ...mp,
          profiles: Array.isArray(mp.profiles)
            ? (mp.profiles[0] ?? null)
            : (mp.profiles ?? null),
        })),
      }));

      setRecentMatches(normalizedMatchDetails);
      setLoading(false);
    }

    loadProfileAndStatsAndMatches();
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Player Profile</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (errorMessage || !profile) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Player Profile</h1>
        <p style={{ color: 'red' }}>
          {errorMessage || 'Profile not found.'}
        </p>
        <p>
          <Link
            href="/matches"
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
            Back to matches
          </Link>
        </p>
      </main>
    );
  }

  const title = formatPlayerName(profile.display_name, profile.first_name);

  const hasDisplayName = !!profile.display_name?.trim();
  const hasFirstName = !!profile.first_name?.trim();
  const hasLastName = !!profile.last_name?.trim();
  const hasSex = !!profile.sex?.trim();

  return (
    <main
      style={{
        padding: '2rem',
        fontFamily: 'sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <header>
        <h1>{title}</h1>
        <p style={{ marginTop: '0.5rem' }}>
          <Link
            href="/matches"
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
            Back to matches
          </Link>
        </p>
      </header>

      {/* Basic profile details */}
      <section>
        <h2>Player details</h2>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem' }}>
          {hasDisplayName && (
            <li style={{ marginBottom: '0.25rem' }}>
              <strong>Display name:</strong> {profile.display_name}
            </li>
          )}
          {hasFirstName && (
            <li style={{ marginBottom: '0.25rem' }}>
              <strong>First name:</strong> {profile.first_name}
            </li>
          )}
          {hasLastName && (
            <li style={{ marginBottom: '0.25rem' }}>
              <strong>Last name:</strong> {profile.last_name}
            </li>
          )}
          {hasSex && (
            <li style={{ marginBottom: '0.25rem' }}>
              <strong>Sex:</strong> {profile.sex}
            </li>
          )}
          {!hasDisplayName && !hasFirstName && !hasLastName && !hasSex && (
            <li>No profile details have been set yet.</li>
          )}
        </ul>
      </section>

      {/* Stats summary */}
      <section>
        <h2>Stats summary</h2>
        {!stats || stats.games === 0 ? (
          <p>No matches recorded for this player yet.</p>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <h3>Overall record (all match types)</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>
                  <strong>Games:</strong> {stats.games}
                </li>
                <li>
                  <strong>Record:</strong> {stats.wins}-{stats.losses}
                </li>
                <li>
                  <strong>Win %:</strong> {stats.winPct.toFixed(1)}%
                </li>
                <li>
                  <strong>Streak:</strong> {stats.streak || '—'}
                </li>
                <li>
                  <strong>Last 5:</strong> {stats.last5 || '—'}
                </li>
              </ul>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h3>3-Dart Average (501 / 301)</h3>
              {stats.threeGames === 0 ? (
                <p>No 501 or 301 matches recorded.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li>
                    <strong>Average:</strong> {stats.threeAvg.toFixed(2)}
                  </li>
                  <li>
                    <strong>Games:</strong> {stats.threeGames}
                  </li>
                </ul>
              )}
            </div>

            <div>
              <h3>MPR (Cricket)</h3>
              {stats.mprGames === 0 ? (
                <p>No Cricket matches recorded.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li>
                    <strong>Average MPR:</strong> {stats.mprAvg.toFixed(2)}
                  </li>
                  <li>
                    <strong>Games:</strong> {stats.mprGames}
                  </li>
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      {/* Last 5 matches (same format as matches page) */}
      <section>
        <h2>Last 5 matches</h2>
        {recentMatches.length === 0 ? (
          <p>No recent matches found for this player.</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '0.5rem',
            }}
          >
            {recentMatches.map((m) => {
              const metricLabel =
                m.game_type === 'Cricket'
                  ? 'MPR'
                  : m.game_type === 'Other'
                    ? 'Score'
                    : '3-Dart Avg';

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
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    Players:
                    <ul style={{ margin: '0.25rem 0 0 1rem' }}>
                      {(m.match_players || []).map((mp) => {
                        const prof = mp.profiles;

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
        )}
      </section>
    </main>
  );
}
