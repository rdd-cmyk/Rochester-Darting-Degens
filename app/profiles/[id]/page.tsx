'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ProfileSoloStats } from '@/components/solo/ProfileSoloStats';
import { GAME_TYPES, gameUnit, ratingExclusion, isLegacyScoreCohort, type GameConfig } from '@/lib/games/catalog';
import { GameResultDetails } from '@/components/GameOptions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';
import { formatRecordedScore } from '@/lib/matchScore';
import { LinkedPlayerName } from '@/components/LinkedPlayerName';
import { PlayerAvatar, PlayerAvatarName } from '@/components/avatars/PlayerAvatar';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionLink } from '@/components/ui/ActionLink';
import { ActionButton } from '@/components/ui/ActionButton';

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  sex: string | null;
  include_first_name_in_display: boolean | null;
};

type MatchRowForStats = {
  is_winner: boolean | null;
  score: number | null;
  matches: {
    game_type: string | null;
  game_config?: GameConfig | null;
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
  points_scored: number | null;
  is_winner: boolean | null;
  profiles?: {
    display_name: string | null;
    first_name: string | null;
    include_first_name_in_display?: boolean | null;
  } | null;
};

type MatchSummary = {
  id: number;
  played_at: string;
  game_type: string | null;
  game_config?: GameConfig | null;
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
    points_scored:
      typeof candidate.points_scored === 'number' ? candidate.points_scored : null,
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
      game_config: m.game_config as GameConfig | null,
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
  const [scopeSelection, setScopeSelection] = useState<{owner:string | undefined;scope:'league'|'solo'|'all'}>({owner:id,scope:'league'});
  const statsScope = scopeSelection.owner === id ? scopeSelection.scope : 'league';
  const setStatsScope = (scope:'league'|'solo'|'all') => setScopeSelection({owner:id,scope});
  const [recentMatches, setRecentMatches] = useState<MatchSummary[]>([]);
  const [allMatches, setAllMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(id));
  const [allMatchesLoading, setAllMatchesLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    id ? null : 'No profile id provided.'
  );
  const [profileMissing, setProfileMissing] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [allMatchesError, setAllMatchesError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recent' | 'all'>('recent');
  const [allMatchesPage, setAllMatchesPage] = useState(1);
  const [allMatchesTotalPages, setAllMatchesTotalPages] = useState(1);
  const [gameTypeFilter, setGameTypeFilter] = useState<
    string
  >('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'wins' | 'losses'>(
    'all'
  );
  const scrollPositionRef = useRef<number | null>(null);

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
      setProfileMissing(false);
      setSignInRequired(false);

      // Anonymous profile reads are hidden by RLS. Check identity before
      // interpreting an empty result as a missing player.
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error && error.name !== 'AuthSessionMissingError') throw error;
        if (!data.user) {
          setSignInRequired(true);
          setProfile(null);
          setStats(null);
          setRecentMatches([]);
          setLoading(false);
          return;
        }
      } catch {
        setErrorMessage('Could not check your account. Please try again later.');
        setLoading(false);
        return;
      }

      // 1) Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(
          'id, first_name, last_name, display_name, sex, include_first_name_in_display'
        )
        .eq('id', id)
        .maybeSingle();

      if (profileError || !profileData) {
        if (profileError) {
          console.error('Error loading profile:', profileError);
          setErrorMessage('Could not load profile. Please try again later.');
        } else {
          setProfileMissing(true);
        }
        setProfile(null);
        setStats(null);
        setRecentMatches([]);
        setLoading(false);
        return;
      }

      const includeFirstNamePref =
        profileData.include_first_name_in_display ?? true;
      setProfile({
        ...(profileData as Profile),
        include_first_name_in_display: includeFirstNamePref,
      });

      // 2) Load this player's match data for stats
      const { data: matchesData, error: matchesError } = await supabase
        .from('match_players')
        .select(
          `
          is_winner,
          score,
          matches!inner (
            game_type, game_config,
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
        if (ratingExclusion(row.matches?.game_config)) continue;
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
        if (isX01Game && isLegacyScoreCohort(row.matches?.game_config) && typeof score === 'number') {
          threeTotal += score;
          threeGames += 1;
        }

        // MPR (Cricket only)
        if (isCricket && isLegacyScoreCohort(row.matches?.game_config) && typeof score === 'number') {
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
            game_type, game_config,
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
              points_scored,
              is_winner,
              profiles (
                display_name,
                first_name,
                include_first_name_in_display
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
    let cancelled = false;
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
          game_type, game_config,
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
        .eq('match_players.player_id', id);

      if (gameTypeFilter !== 'all') {
        query = query.eq('game_type', gameTypeFilter);
      }

      if (resultFilter !== 'all') {
        query = query.eq('match_players.is_winner', resultFilter === 'wins');
        // Null configuration is the legacy completed-result cohort.
        query = query.or('game_config.is.null,game_config->>status.eq.completed');
      }

      recordScrollPosition();

      const { data, error, count } = await query
        .order('played_at', { ascending: false })
        .range(from, to);

      // A newer filter/page request owns the result after effect cleanup.
      if (cancelled) return;

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
    return () => { cancelled = true; };
  }, [activeTab, allMatchesPage, gameTypeFilter, id, resultFilter]);

  const restoreScrollPositionIfSaved = () => {
    if (typeof window === 'undefined') return;

    if (scrollPositionRef.current === null) return;

    const savedTop = scrollPositionRef.current;

    requestAnimationFrame(() => {
      window.scrollTo({ top: savedTop });
    });
  };

  useLayoutEffect(() => {
    if (activeTab === 'all') {
      restoreScrollPositionIfSaved();
    }
  }, [activeTab]);

  useLayoutEffect(() => {
    if (activeTab === 'all') {
      restoreScrollPositionIfSaved();
    }
  }, [activeTab, allMatchesLoading]);

  const handleTabChange = (tab: 'recent' | 'all') => {
    if (tab === activeTab) return;

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
        (match.game_config?.status ?? 'completed') === 'completed' &&
        (resultFilter === 'wins' ? isWin === true : isWin === false);

      return matchesGameType && matchesResult;
    });
  };

  if (loading) {
    return (
      <main className="rdd-page-shell page-shell player-page">
        <PageHeader eyebrow="Player profile" title="Player profile" />
        <p className="rdd-state" role="status">Loading profile…</p>
      </main>
    );
  }

  if (signInRequired) {
    return (
      <main className="rdd-page-shell page-shell player-page">
        <PageHeader eyebrow="Player profile" title="Player profile" />
        <p className="rdd-state">Sign in to view player profiles.</p>
        <ActionLink href="/auth" variant="primary">Go to sign in</ActionLink>
      </main>
    );
  }

  if (errorMessage || profileMissing || !profile) {
    return (
      <main className="rdd-page-shell page-shell player-page">
        <PageHeader eyebrow="Player profile" title={profileMissing ? 'Player not found' : 'Player profile'} />
        <p className={profileMissing ? 'rdd-state' : 'rdd-state rdd-state--error'} role={profileMissing ? 'status' : 'alert'}>
          {profileMissing ? 'No player profile exists at this link.' : errorMessage || 'Could not load profile.'}
        </p>
        <div className="rdd-actions"><ActionLink href="/profiles" variant="primary">Browse players</ActionLink></div>
      </main>
    );
  }

  const title = formatPlayerName(
    profile.display_name,
    profile.first_name,
    profile.include_first_name_in_display
  );

  const hasDisplayName = !!profile.display_name?.trim();
  const hasFirstName = !!profile.first_name?.trim();
  const hasLastName = !!profile.last_name?.trim();
  const hasSex = !!profile.sex?.trim();

  const filteredRecentMatches = applyMatchFilters(recentMatches);
  // The history query applies filters before pagination. Keep its last settled
  // page beneath the loading overlay until the current request completes.
  const filteredAllMatches = allMatches;
  const matchesToDisplay =
    filteredAllMatches.length === 0 && allMatchesLoading
      ? filteredRecentMatches
      : filteredAllMatches;

  return (
    <main className="rdd-page-shell page-shell player-page">
      <PageHeader
        eyebrow="Player profile"
        title={title}
        description="The record, the recent form, and the next rival to watch."
        identity={<span className="player-profile-identity"><span aria-hidden="true"><PlayerAvatar playerId={profile.id} name={title} size={64} /></span><PlayerAvatarName playerId={profile.id} /></span>}
        actions={<><ActionLink href="/profiles">Browse players</ActionLink><ActionLink href="/matches" variant="quiet">Back to matches</ActionLink></>}
      />

      {/* Basic profile details */}
      <section className="rdd-content-panel player-details">
        <h2 className="section-heading">Player details</h2>
        <ul className="player-details-list">
          {hasDisplayName && (
            <li>
              <strong>Display name:</strong> {profile.display_name}
            </li>
          )}
          {hasFirstName && (
            <li>
              <strong>First name:</strong> {profile.first_name}
            </li>
          )}
          {hasLastName && (
            <li>
              <strong>Last name:</strong> {profile.last_name}
            </li>
          )}
          {hasSex && (
            <li>
              <strong>Sex:</strong> {profile.sex}
            </li>
          )}
          {!hasDisplayName && !hasFirstName && !hasLastName && !hasSex && (
            <li>No profile details have been set yet.</li>
          )}
        </ul>
      </section>

      {/* Stats summary */}
      <section className="player-summary">
        <h2 className="section-heading">The tale of the tape</h2>
        <ProfileSoloStats key={id} owner={id!} scope={statsScope} onScopeChange={setStatsScope}/>
        <div className="player-summary-grid" hidden={statsScope!=='league'}>
        {!stats || stats.games === 0 ? (
          <p className="rdd-content-panel player-summary-empty">No competitive league matches recorded for this player yet.</p>
        ) : (
          <>
            <div className="rdd-content-panel player-summary-card">
              <h3 className="subsection-heading">League record</h3>
              <ul>
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

            <div className="rdd-content-panel player-summary-card">
              <h3 className="subsection-heading">3-dart average (301 / 501)</h3>
              <p>Individual averages from games with rules unspecified. <Link href="/stats">See Advanced Statistics for preset and team comparisons.</Link></p>
              {stats.threeGames === 0 ? (
                <p>No scored individual 301 or 501 games with rules unspecified.</p>
              ) : (
                <ul>
                  <li>
                    <strong>Average 3DA:</strong> {stats.threeAvg.toFixed(2)}
                  </li>
                  <li>
                    <strong>Games:</strong> {stats.threeGames}
                  </li>
                </ul>
              )}
            </div>

            <div className="rdd-content-panel player-summary-card">
              <h3 className="subsection-heading">MPR (Cricket)</h3>
              {stats.mprGames === 0 ? (
                <p>No scored individual Cricket games with rules unspecified.</p>
              ) : (
                <ul>
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
        </div>
      </section>

      {/* Match history tabs */}
      <section className="rdd-content-panel player-history">
        <h2 className="section-heading">League match history</h2>
        {statsScope !== 'league' && <p className="rdd-muted">The history below shows league matches. Private Solo Play history is not shown on profiles.</p>}

        <div className="rdd-filter-group player-history-controls">
          <label className="match-filter-control" htmlFor="gameTypeFilter">
            <span>Game type</span>
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
              {GAME_TYPES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <label className="match-filter-control" htmlFor="resultFilter">
            <span>Result</span>
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

        <div className="player-history-tabs" role="group" aria-label="Match history range">
          <ActionButton
            type="button"
            onClick={() => handleTabChange('recent')}
            aria-pressed={activeTab === 'recent'}
          >
            Last 5 matches
          </ActionButton>
          <ActionButton
            type="button"
            onClick={() => handleTabChange('all')}
            aria-pressed={activeTab === 'all'}
          >
            All matches
          </ActionButton>
        </div>

        {activeTab === 'recent' ? (
          filteredRecentMatches.length === 0 ? (
            <p>No recent matches found for this player.</p>
          ) : (
            <MatchList matches={filteredRecentMatches} />
          )
        ) : (
          <div className="player-history-results">
            {allMatchesError ? (
              <p className="rdd-state rdd-state--error" role="alert">{allMatchesError}</p>
            ) :
              filteredAllMatches.length === 0 && !allMatchesLoading ? (
              <p>No matches found for this player.</p>
            ) : (
              <MatchList matches={matchesToDisplay} />
            )}

            {filteredAllMatches.length > 0 && (
              <div className="rdd-pagination">
                <ActionButton
                  type="button"
                  disabled={allMatchesPage === 1 || allMatchesLoading}
                  onClick={() => {
                    recordScrollPosition();
                    setAllMatchesLoading(true);
                    setAllMatchesPage((p) => Math.max(1, p - 1));
                  }}
                >
                  Previous
                </ActionButton>
                <span>
                  Page {allMatchesPage} of {allMatchesTotalPages}
                </span>
                <ActionButton
                  type="button"
                  disabled={allMatchesPage === allMatchesTotalPages || allMatchesLoading}
                  onClick={() => {
                    recordScrollPosition();
                    setAllMatchesLoading(true);
                    setAllMatchesPage((p) =>
                      p >= allMatchesTotalPages ? allMatchesTotalPages : p + 1
                    );
                  }}
                >
                  Next
                </ActionButton>
              </div>
            )}

            {allMatchesLoading && (
              <div className="player-history-loading" role="status">
                <p>Loading match history…</p>
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
    <ul className="player-match-list">
      {matches.map((m) => {
        const metricLabel = gameUnit(m.game_type);

        return (
          <li key={m.id} className="player-match-card">
            <div className="player-match-header">
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
            </div>

            <div className="player-match-participants">
              Players:
              <ul>
                {(m.match_players || []).map((mp) => {
                  const prof = mp.profiles;
                  const pointsText =
                    (m.game_type === 'Cricket' || m.game_type === 'Cut-Throat Cricket') && mp.points_scored != null
                      ? ` (${m.game_type === 'Cut-Throat Cricket' ? 'Penalty points' : 'Points'}: ${mp.points_scored})`
                      : '';

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
                      {pointsText}{' '}
                      {m.game_config?.sides?.[mp.player_id] ? ` · Team ${m.game_config.sides[mp.player_id]}` : ''} {mp.is_winner ? <strong>(winner)</strong> : null}
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
