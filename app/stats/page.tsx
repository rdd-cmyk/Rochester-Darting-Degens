'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { RatingTrendChart } from '@/components/stats/RatingTrendChart';
import { StatsStoryCard } from '@/components/stats/StatsStoryCard';
import { formatPlayerName } from '@/lib/playerName';
import { buildLeagueAdvancedStats } from '@/lib/stats/engine';
import type { MatchFact, PlayerAdvancedStats } from '@/lib/stats/types';
import { supabase } from '@/lib/supabaseClient';

type ProfileRelation = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  include_first_name_in_display: boolean | null;
};

type MatchRelation = {
  played_at: string;
  game_type: string | null;
  board_type: string | null;
  venue: string | null;
};

type RawFact = {
  match_id: string | number;
  player_id: string;
  is_winner: boolean | null;
  score: number | null;
  profiles: ProfileRelation | ProfileRelation[] | null;
  matches: MatchRelation | MatchRelation[] | null;
};

const GAME_TYPES = ['All', '501', '301', 'Cricket', 'Other'] as const;
const BOARD_TYPES = ['All', 'Soft Tip', 'Steel Tip'] as const;
const MINIMUM_GAMES = [1, 3, 5, 10] as const;

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function signed(value: number, digits = 0): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

function pickMostConsistent(players: PlayerAdvancedStats[]): PlayerAdvancedStats | null {
  return (
    [...players]
      .filter((player) => (player.scoreDistribution?.games ?? 0) >= 3)
      .sort(
        (a, b) =>
          (a.scoreDistribution?.normalizedDeviation ?? Number.POSITIVE_INFINITY) -
          (b.scoreDistribution?.normalizedDeviation ?? Number.POSITIVE_INFINITY)
      )[0] ?? null
  );
}

export default function AdvancedStatsPage() {
  const [facts, setFacts] = useState<MatchFact[]>([]);
  const [gameType, setGameType] = useState<(typeof GAME_TYPES)[number]>('All');
  const [boardType, setBoardType] = useState<(typeof BOARD_TYPES)[number]>('All');
  const [minimumGames, setMinimumGames] = useState<(typeof MINIMUM_GAMES)[number]>(3);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFacts() {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase.from('match_players').select(`
        match_id,
        player_id,
        is_winner,
        score,
        profiles (
          id,
          display_name,
          first_name,
          include_first_name_in_display
        ),
        matches!inner (
          played_at,
          game_type,
          board_type,
          venue
        )
      `);

      if (!active) return;

      if (error) {
        console.error('Error loading advanced statistics:', error);
        setErrorMessage('Advanced statistics could not be loaded.');
        setFacts([]);
        setLoading(false);
        return;
      }

      const normalized = ((data ?? []) as RawFact[]).flatMap((row): MatchFact[] => {
        const profile = firstRelation(row.profiles);
        const match = firstRelation(row.matches);
        if (!match || !row.match_id || !row.player_id) return [];

        return [
          {
            matchId: String(row.match_id),
            playerId: row.player_id,
            displayName: profile
              ? formatPlayerName(
                  profile.display_name,
                  profile.first_name,
                  profile.include_first_name_in_display
                )
              : 'Unknown player',
            playedAt: match.played_at,
            gameType: match.game_type,
            boardType: match.board_type,
            venue: match.venue,
            isWinner: row.is_winner === true,
            score: row.score,
          },
        ];
      });

      setFacts(normalized);
      setLoading(false);
    }

    loadFacts();
    return () => {
      active = false;
    };
  }, []);

  const filteredFacts = useMemo(
    () =>
      facts.filter(
        (fact) =>
          (gameType === 'All' || fact.gameType === gameType) &&
          (boardType === 'All' || fact.boardType === boardType)
      ),
    [boardType, facts, gameType]
  );
  const leagueStats = useMemo(
    () => buildLeagueAdvancedStats(filteredFacts),
    [filteredFacts]
  );
  const eligiblePlayers = useMemo(
    () => leagueStats.players.filter((player) => player.games >= minimumGames),
    [leagueStats.players, minimumGames]
  );

  const powerLeader = eligiblePlayers[0] ?? null;
  const onFire =
    [...eligiblePlayers].sort((a, b) => b.ratingDeltaLastFive - a.ratingDeltaLastFive)[0] ??
    null;
  const mostImproved =
    [...eligiblePlayers].sort((a, b) => b.ratingDelta - a.ratingDelta)[0] ?? null;
  const mostConsistent = leagueStats.scoreLabel
    ? pickMostConsistent(eligiblePlayers)
    : null;
  const eligibleUpset = leagueStats.biggestUpset
    ? eligiblePlayers.some((player) => player.playerId === leagueStats.biggestUpset?.winnerId)
      ? leagueStats.biggestUpset
      : null
    : null;
  const chartPlayers = eligiblePlayers.slice(0, 5);
  const maxConsistencyValue = Math.max(
    ...eligiblePlayers.map((player) => player.scoreDistribution?.best ?? 0),
    1
  );

  return (
    <main className="stats-page-shell">
      <section className="stats-hero">
        <div>
          <p className="stats-kicker">RDD League Lab</p>
          <h1>Advanced Statistics</h1>
          <p className="stats-hero-copy">
            Opponent-adjusted power ratings, current form, schedule difficulty, and
            performance consistency—built from recorded league matches.
          </p>
        </div>
        <div className="stats-hero-actions">
          <Link href="/matches" className="stats-primary-action">
            Record a match
          </Link>
          <a href="#methodology" className="stats-secondary-action">
            How ratings work
          </a>
        </div>
      </section>

      <section className="stats-filter-panel" aria-label="Advanced statistics filters">
        <label>
          <span>Game type</span>
          <select
            value={gameType}
            onChange={(event) =>
              setGameType(event.target.value as (typeof GAME_TYPES)[number])
            }
          >
            {GAME_TYPES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Board</span>
          <select
            value={boardType}
            onChange={(event) =>
              setBoardType(event.target.value as (typeof BOARD_TYPES)[number])
            }
          >
            {BOARD_TYPES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Minimum games</span>
          <select
            value={minimumGames}
            onChange={(event) =>
              setMinimumGames(Number(event.target.value) as (typeof MINIMUM_GAMES)[number])
            }
          >
            {MINIMUM_GAMES.map((option) => (
              <option key={option} value={option}>
                {option}+
              </option>
            ))}
          </select>
        </label>
        <div className="stats-filter-summary" aria-live="polite">
          <strong>{leagueStats.matchesAnalyzed}</strong>
          <span>matches analyzed</span>
        </div>
      </section>

      {errorMessage ? <div className="stats-error">{errorMessage}</div> : null}

      {loading ? (
        <section className="stats-loading" aria-live="polite">
          Calculating league ratings…
        </section>
      ) : errorMessage ? null : eligiblePlayers.length === 0 ? (
        <section className="stats-empty-state">
          <p className="stats-eyebrow">No eligible players</p>
          <h2>Lower the minimum-games filter or record another match.</h2>
          <p>
            Ratings require one valid winner and at least two different players in a match.
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="league-stories-title">
            <div className="stats-section-heading">
              <div>
                <p className="stats-eyebrow">League pulse</p>
                <h2 id="league-stories-title">What is happening right now</h2>
              </div>
              <p>{eligiblePlayers.length} players meet the current sample threshold.</p>
            </div>
            <div className="stats-story-grid">
              {powerLeader ? (
                <StatsStoryCard
                  eyebrow="Power leader"
                  value={Math.round(powerLeader.rating).toString()}
                  playerId={powerLeader.playerId}
                  playerName={powerLeader.displayName}
                  detail={powerLeader.provisional ? 'Provisional rating' : 'Established rating'}
                  accent="orange"
                />
              ) : null}
              {onFire ? (
                <StatsStoryCard
                  eyebrow="On fire"
                  value={signed(onFire.ratingDeltaLastFive)}
                  playerId={onFire.playerId}
                  playerName={onFire.displayName}
                  detail={`${onFire.recentWins}-${onFire.recentGames - onFire.recentWins} over the last ${onFire.recentGames}`}
                  accent="blue"
                />
              ) : null}
              {eligibleUpset ? (
                <StatsStoryCard
                  eyebrow="Giant killer"
                  value={`${(eligibleUpset.expectedWinProbability * 100).toFixed(0)}% chance`}
                  playerId={eligibleUpset.winnerId}
                  playerName={eligibleUpset.winnerName}
                  detail={`Beat ${eligibleUpset.opponentNames.join(', ')} on ${new Date(
                    eligibleUpset.playedAt
                  ).toLocaleDateString()}`}
                  accent="cream"
                />
              ) : mostImproved ? (
                <StatsStoryCard
                  eyebrow="Most improved"
                  value={signed(mostImproved.ratingDelta)}
                  playerId={mostImproved.playerId}
                  playerName={mostImproved.displayName}
                  detail="Rating change from the 1500 baseline"
                  accent="cream"
                />
              ) : null}
              {mostConsistent && mostConsistent.scoreDistribution ? (
                <StatsStoryCard
                  eyebrow="Steadiest hand"
                  value={`±${mostConsistent.scoreDistribution.medianAbsoluteDeviation.toFixed(2)}`}
                  playerId={mostConsistent.playerId}
                  playerName={mostConsistent.displayName}
                  detail={`Median absolute deviation across ${mostConsistent.scoreDistribution.games} scored matches`}
                  accent="silver"
                />
              ) : (
                <StatsStoryCard
                  eyebrow="Most improved"
                  value={mostImproved ? signed(mostImproved.ratingDelta) : '—'}
                  playerId={mostImproved?.playerId}
                  playerName={mostImproved?.displayName}
                  detail="Rating change from the 1500 baseline"
                  accent="silver"
                />
              )}
            </div>
          </section>

          <section className="stats-panel" aria-labelledby="rating-history-title">
            <div className="stats-section-heading stats-panel-heading">
              <div>
                <p className="stats-eyebrow">Trajectory</p>
                <h2 id="rating-history-title">Power rating history</h2>
              </div>
              <p>Top five eligible players · rating after each appearance</p>
            </div>
            <RatingTrendChart players={chartPlayers} />
          </section>

          <section className="stats-panel" aria-labelledby="power-table-title">
            <div className="stats-section-heading stats-panel-heading">
              <div>
                <p className="stats-eyebrow">Exact lookup</p>
                <h2 id="power-table-title">Power leaderboard</h2>
              </div>
              <p>Opponent-adjusted and chronological</p>
            </div>
            <div className="stats-table-scroll">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Player</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Record</th>
                    <th scope="col">Expected wins</th>
                    <th scope="col">Win delta</th>
                    <th scope="col">Schedule</th>
                    <th scope="col">Last 5 rating</th>
                  </tr>
                </thead>
                <tbody>
                  {eligiblePlayers.map((player, eligibleIndex) => (
                    <tr key={player.playerId}>
                      <td className="stats-rank">#{eligibleIndex + 1}</td>
                      <td>
                        <Link className="stats-player-link" href={`/profiles/${player.playerId}`}>
                          {player.displayName}
                        </Link>
                        {player.provisional ? (
                          <span className="stats-provisional">Provisional</span>
                        ) : null}
                      </td>
                      <td className="stats-number stats-rating-number">
                        {Math.round(player.rating)}
                      </td>
                      <td className="stats-number">
                        {player.wins}-{player.losses}
                      </td>
                      <td className="stats-number">{player.expectedWins.toFixed(1)}</td>
                      <td className="stats-number" data-sign={player.winDelta >= 0 ? 'up' : 'down'}>
                        {signed(player.winDelta, 1)}
                      </td>
                      <td className="stats-number">{Math.round(player.strengthOfSchedule)}</td>
                      <td
                        className="stats-number"
                        data-sign={player.ratingDeltaLastFive >= 0 ? 'up' : 'down'}
                      >
                        {signed(player.ratingDeltaLastFive)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {leagueStats.scoreLabel &&
          eligiblePlayers.some((player) => player.scoreDistribution) ? (
            <section aria-labelledby="consistency-title">
              <div className="stats-section-heading">
                <div>
                  <p className="stats-eyebrow">Performance profile</p>
                  <h2 id="consistency-title">{leagueStats.scoreLabel} consistency</h2>
                </div>
                <p>Typical range is the middle 50% of recorded match values.</p>
              </div>
              <div className="stats-consistency-grid">
                {eligiblePlayers
                  .filter((player) => player.scoreDistribution)
                  .slice(0, 8)
                  .map((player) => {
                    const distribution = player.scoreDistribution!;
                    const left = (distribution.lowerQuartile / maxConsistencyValue) * 100;
                    const width =
                      ((distribution.upperQuartile - distribution.lowerQuartile) /
                        maxConsistencyValue) *
                      100;

                    return (
                      <article className="stats-consistency-card" key={player.playerId}>
                        <div className="stats-consistency-header">
                          <Link
                            className="stats-player-link"
                            href={`/profiles/${player.playerId}`}
                          >
                            {player.displayName}
                          </Link>
                          <strong>{distribution.median.toFixed(2)}</strong>
                        </div>
                        <div
                          className="stats-consistency-track"
                          aria-label={`${player.displayName} typical ${leagueStats.scoreLabel} range ${distribution.lowerQuartile.toFixed(2)} to ${distribution.upperQuartile.toFixed(2)}`}
                        >
                          <span
                            className="stats-consistency-band"
                            style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                          />
                          <span
                            className="stats-consistency-median"
                            style={{ left: `${(distribution.median / maxConsistencyValue) * 100}%` }}
                          />
                        </div>
                        <dl className="stats-consistency-values">
                          <div>
                            <dt>Typical</dt>
                            <dd>
                              {distribution.lowerQuartile.toFixed(1)}–
                              {distribution.upperQuartile.toFixed(1)}
                            </dd>
                          </div>
                          <div>
                            <dt>Best</dt>
                            <dd>{distribution.best.toFixed(2)}</dd>
                          </div>
                          <div>
                            <dt>Games</dt>
                            <dd>{distribution.games}</dd>
                          </div>
                        </dl>
                      </article>
                    );
                  })}
              </div>
            </section>
          ) : null}
        </>
      )}

      <section className="stats-methodology" id="methodology">
        <p className="stats-eyebrow">Methodology</p>
        <h2>Advanced without becoming mysterious</h2>
        <div className="stats-methodology-grid">
          <div>
            <h3>Power rating</h3>
            <p>
              Everyone begins at 1500. Ratings move after every match based on the
              pre-match chance of winning. Unexpected wins move ratings more.
            </p>
          </div>
          <div>
            <h3>Expected record</h3>
            <p>
              Expected wins add each pre-match probability. Win delta compares actual
              wins with that opponent-adjusted expectation.
            </p>
          </div>
          <div>
            <h3>Sample guardrails</h3>
            <p>
              Ratings are provisional before ten matches. Use the minimum-games filter
              and always read consistency beside its scored-match count.
            </p>
          </div>
        </div>
        {leagueStats.matchesIgnored > 0 ? (
          <p className="stats-data-note">
            {leagueStats.matchesIgnored} match{leagueStats.matchesIgnored === 1 ? '' : 'es'}
            {' '}were excluded because they did not contain at least two players and exactly one
            winner.
          </p>
        ) : null}
      </section>
    </main>
  );
}
