'use client';

import { useEffect, useRef, useState } from 'react';
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

type MatchRow = MatchRowForStats & {
  matches: MatchRowForStats['matches'] | MatchRowForStats['matches'][] | null;
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

type MatchPlayerRow = MatchPlayerSummary & {
  profiles:
    | MatchPlayerSummary['profiles']
    | MatchPlayerSummary['profiles'][]
    | undefined;
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

const isMatchPlayerRow = (mp: unknown): mp is MatchPlayerRow =>
  typeof mp === 'object' && mp !== null && 'profiles' in mp;

const normalizeProfile = (
  profiles: MatchPlayerRow['profiles']
): MatchPlayerSummary['profiles'] =>
  Array.isArray(profiles) ? profiles[0] ?? null : profiles ?? null;

const fallbackMatchPlayer = (mp: unknown): MatchPlayerSummary => {
  const candidate = mp as Partial<MatchPlayerSummary>;

  return {
    id: typeof candidate.id === 'number' ? candidate.id : 0,
    match_id: typeof candidate.match_id === 'number' ? candidate.match_id : 0,
    player_id: typeof candidate.player_id === 'string' ? candidate.player_id : '',
    score: typeof candidate.score === 'number' ? candidate.score : null,
    is_winner: typeof candidate.is_winner === 'boolean' ? candidate.is_winner : null,
    profiles: null,
  };
};

type RawMatchRow = Omit<Partial<MatchSummary>, 'match_players'> & {
  match_players?: MatchPlayerRow | MatchPlayerRow[] | unknown;
  all_match_players?: MatchPlayerRow | MatchPlayerRow[] | unknown;
};

function normalizeMatchDetails(matchesData: RawMatchRow[] | null): MatchSummary[] {
  return (matchesData ?? []).map((m) => {
    const playerList = m.all_match_players ?? m.match_players;

    const matchPlayers = Array.isArray(playerList)
      ? playerList
      : playerList
        ? [playerList]
        : [];

    return {
      id: typeof m.id === 'number' ? m.id : 0,
      played_at: typeof m.played_at === 'string' ? m.played_at : '',
      game_type: typeof m.game_type === 'string' ? m.game_type : null,
      notes: typeof m.notes === 'string' ? m.notes : null,
      board_type: typeof m.board_type === 'string' ? m.board_type : null,
      venue: typeof m.venue === 'string' ? m.venue : null,
      created_by: typeof m.created_by === 'string' ? m.created_by : null,
      match_players: matchPlayers.map((mp) => {
        if (isMatchPlayerRow(mp)) {
          return {
            ...mp,
            profiles: normalizeProfile(mp.profiles),
          };
        }

        return fallbackMatchPlayer(mp);
      }),
    };
  });
}

export default function ProfilePage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<PlayerStatsSummary | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchSummary[]>([]);
  const [allMatches, setAllMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(id));
  const [allMatchesLoading, setAllMatchesLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    id ? null : 'No profile id provided.'
  );
  const [allMatchesError, setAllMatchesError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recent' | 'all'>('recent');
  const [allMatchesPage, setAllMatchesPage] = useState(1);
  const [allMatchesTotalPages, setAllMatchesTotalPages] = useState(1);
  const [gameTypeFilter, setGameTypeFilter] = useState<
    'all' | '501' | '301' | 'Cricket' | 'Other'
  >('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'wins' | 'losses'>(
    'all'
  );
  const [visibleAllMatches, setVisibleAllMatches] = useState<MatchSummary[]>([]);
  const scrollPositionRef = useRef(0);

  const recordScrollPosition = () => {
    if (typeof window !== 'undefined') {
      scrollPositionRef.current = window.scrollY;
    }
  };

  const PAGE_SIZE = 10;

  useEffect(() => {
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

      const isMatchRow = (row: unknown): row is MatchRow =>
        typeof row === 'object' && row !== null && 'matches' in row;

      const rows: MatchRowForStats[] = (matchesData ?? []).map((r) => {
        if (isMatchRow(r)) {
          return {
            ...r,
            matches: Array.isArray(r.matches)
              ? r.matches[0] ?? null
              : r.matches ?? null,
          };
        }

        return {
          is_winner: null,
          score: null,
          matches: null,
        };
      });

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
            match_players!inner (player_id),
            all_match_players:match_players (
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

      setRecentMatches(normalizeMatchDetails(matchesDetailData));
      setLoading(false);
    }

    if (!id) return;

    loadProfileAndStatsAndMatches();
  }, [id]);

  useEffect(() => {
    async function loadAllMatches(page: number) {
      if (!id) return;
      setAllMatchesLoading(true);
      setAllMatchesError(null);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
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
          match_players!inner (player_id, is_winner),
          all_match_players:match_players (
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
        .eq('match_players.player_id', id);

      if (gameTypeFilter !== 'all') {
        query = query.eq('game_type', gameTypeFilter);
      }

      if (resultFilter !== 'all') {
        query = query.eq('match_players.is_winner', resultFilter === 'wins');
      }

      recordScrollPosition();

      const { data, error, count } = await query
        .order('played_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error loading all matches for profile:', error);
        setAllMatchesError('Could not load match history.');
        setAllMatches([]);
        setAllMatchesLoading(false);
        return;
      }

      const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

      setAllMatchesTotalPages(totalPages);
      setAllMatches(normalizeMatchDetails(data as RawMatchRow[] | null));
      setAllMatchesLoading(false);
    }

    if (activeTab === 'all') {
      loadAllMatches(allMatchesPage);
    }
  }, [activeTab, allMatchesPage, gameTypeFilter, id, resultFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (activeTab === 'all') {
      window.scrollTo({ top: scrollPositionRef.current });
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (activeTab === 'all' && !allMatchesLoading) {
      window.scrollTo({ top: scrollPositionRef.current });
    }
  }, [activeTab, allMatchesLoading]);

  const handleTabChange = (tab: 'recent' | 'all') => {
    recordScrollPosition();
    if (tab === 'all') {
      setAllMatchesLoading(true);
    }

    setActiveTab(tab);
  };

  const applyMatchFilters = (matches: MatchSummary[]) => {
    if (!id) return matches;

    return matches.filter((match) => {
      const matchesGameType =
        gameTypeFilter === 'all' || match.game_type === gameTypeFilter;

      if (resultFilter === 'all') {
        return matchesGameType;
      }

      const playerEntry = match.match_players?.find(
        (mp) => mp.player_id === id
      );

      const isWin = playerEntry?.is_winner ?? null;
      const matchesResult =
        resultFilter === 'wins' ? isWin === true : isWin === false;

      return matchesGameType && matchesResult;
    });
  };

  useEffect(() => {
    if (!allMatchesLoading) {
      setVisibleAllMatches(applyMatchFilters(allMatches));
    }
  }, [allMatches, allMatchesLoading, gameTypeFilter, resultFilter]);

  if (loading) {
    return (
      <main className="page-shell" style={{ maxWidth: '820px' }}>
        <h1>Player Profile</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (errorMessage || !profile) {
    return (
      <main className="page-shell" style={{ maxWidth: '820px' }}>
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

  const filteredRecentMatches = applyMatchFilters(recentMatches);
  const filteredAllMatches = visibleAllMatches;
  const matchesToDisplay =
    filteredAllMatches.length === 0 && allMatchesLoading
      ? filteredRecentMatches
      : filteredAllMatches;

  return (
    <main
      className="page-shell"
      style={{
        maxWidth: '820px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--section-gap)',
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
        <h2 className="section-heading">Player Details</h2>
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
        <h2 className="section-heading">Stats Summary</h2>
        {!stats || stats.games === 0 ? (
          <p>No matches recorded for this player yet.</p>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <h3 className="subsection-heading">Overall record (all match types)</h3>
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
              <h3 className="subsection-heading">3-Dart Average (501 / 301)</h3>
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
              <h3 className="subsection-heading">MPR (Cricket)</h3>
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

      {/* Match history tabs */}
      <section>
        <h2 className="section-heading">Match History</h2>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            marginBottom: '0.85rem',
          }}
        >
          <label className="match-filter-control" htmlFor="gameTypeFilter">
            <span style={{ fontWeight: 600 }}>Game Type</span>
            <select
              id="gameTypeFilter"
              value={gameTypeFilter}
              onChange={(e) => {
                recordScrollPosition();
                if (activeTab === 'all') {
                  setAllMatchesLoading(true);
                }
                setGameTypeFilter(e.target.value as typeof gameTypeFilter);
                setAllMatchesPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="501">501</option>
              <option value="301">301</option>
              <option value="Cricket">Cricket</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="match-filter-control" htmlFor="resultFilter">
            <span style={{ fontWeight: 600 }}>Result</span>
            <select
              id="resultFilter"
              value={resultFilter}
              onChange={(e) => {
                recordScrollPosition();
                if (activeTab === 'all') {
                  setAllMatchesLoading(true);
                }
                setResultFilter(e.target.value as typeof resultFilter);
                setAllMatchesPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="wins">Wins</option>
              <option value="losses">Losses</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => handleTabChange('recent')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
              backgroundColor: activeTab === 'recent' ? '#0366d6' : 'white',
              color: activeTab === 'recent' ? 'white' : 'black',
              cursor: 'pointer',
            }}
          >
            Last 5 Matches
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('all')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
              backgroundColor: activeTab === 'all' ? '#0366d6' : 'white',
              color: activeTab === 'all' ? 'white' : 'black',
              cursor: 'pointer',
            }}
          >
            All Matches
          </button>
        </div>

        {activeTab === 'recent' ? (
          filteredRecentMatches.length === 0 ? (
            <p>No recent matches found for this player.</p>
          ) : (
            <MatchList matches={filteredRecentMatches} />
          )
        ) : (
          <div style={{ position: 'relative' }}>
            {allMatchesError ? (
              <p style={{ color: 'red' }}>{allMatchesError}</p>
            ) :
              filteredAllMatches.length === 0 && !allMatchesLoading ? (
              <p>No matches found for this player.</p>
            ) : (
              <MatchList matches={matchesToDisplay} />
            )}

            {filteredAllMatches.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1rem',
                }}
              >
                <button
                  type="button"
                  disabled={allMatchesPage === 1 || allMatchesLoading}
                  onClick={() => {
                    recordScrollPosition();
                    setAllMatchesLoading(true);
                    setAllMatchesPage((p) => Math.max(1, p - 1));
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #ccc',
                    backgroundColor:
                      allMatchesPage === 1 ? '#8cbce8' : '#0366d6',
                    color: 'white',
                    fontWeight: 500,
                    cursor: allMatchesPage === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Previous
                </button>
                <span>
                  Page {allMatchesPage} of {allMatchesTotalPages}
                </span>
                <button
                  type="button"
                  disabled={allMatchesPage === allMatchesTotalPages || allMatchesLoading}
                  onClick={() => {
                    recordScrollPosition();
                    setAllMatchesLoading(true);
                    setAllMatchesPage((p) =>
                      p >= allMatchesTotalPages ? allMatchesTotalPages : p + 1
                    );
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #ccc',
                    backgroundColor:
                      allMatchesPage === allMatchesTotalPages ? '#8cbce8' : '#0366d6',
                    color: 'white',
                    fontWeight: 500,
                    cursor:
                      allMatchesPage === allMatchesTotalPages
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  Next
                </button>
              </div>
            )}

            {allMatchesLoading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '0.5rem',
                  zIndex: 1,
                }}
              >
                <p style={{ margin: 0 }}>Loading matches...</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

type MatchListProps = {
  matches: MatchSummary[];
};

function MatchList({ matches }: MatchListProps) {
  return (
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
      {matches.map((m) => {
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
  );
}
