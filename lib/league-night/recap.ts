import { gameDefinition, gameUnit, hasCricketPoints, comparisonKey, formatLabel, presetLabel, ratingExclusion, validateConfig } from '@/lib/games/catalog';
import { formatPlayerName } from "@/lib/playerName";
import {
  buildLeagueAdvancedStats,
  PROVISIONAL_MATCHES,
} from "@/lib/stats/engine";
import type { MatchFact } from "@/lib/stats/types";
import type { MatchParticipant, NightMatch } from "./types";

export type NightAward = {
  id: string;
  kind: "upset" | "surge" | "best" | "streak" | "first";
  title: string;
  playerId: string;
  playerName: string;
  reason: string;
  scope: string;
  rule: string;
  matchIds: number[];
};
export type NightStanding = {
  playerId: string;
  name: string;
  games: number;
  wins: number;
};
export type RatingMove = {
  playerId: string;
  name: string;
  scope: string;
  gain: number;
  games: number;
  provisional: boolean;
};
export type NightRecap = {
  matches: NightMatch[];
  standings: NightStanding[];
  awards: NightAward[];
  ratingMoves: RatingMove[];
  ignored: number;
  incompleteHistory: number;
};

export function participantName(player: MatchParticipant): string {
  const profile = Array.isArray(player.profiles)
    ? player.profiles[0]
    : player.profiles;
  return formatPlayerName(
    profile?.display_name,
    profile?.first_name,
    profile?.include_first_name_in_display,
  );
}
export function scoreSummary(match: NightMatch): string {
  const unit = gameUnit(match.game_type) === 'Score' ? 'score' : gameUnit(match.game_type);
  const shared = Object.entries(match.game_config?.teamScores ?? {})
    .filter(([, value]) => value !== null)
    .map(([side, value]) => `Team ${side}: ${value} ${unit}`);
  const personal = (match.match_players ?? [])
    .map(
      (p) =>
        `${participantName(p)}: ${p.score === null ? "not recorded" : `${p.score} ${unit}`}${hasCricketPoints(match.game_type) && p.points_scored !== null ? `, ${p.points_scored} ${match.game_type === 'Cut-Throat Cricket' ? 'penalty points' : 'points'}` : ""}`,
    )
    ;
  return [...shared, ...personal].join(" · ");
}
function valid(match: NightMatch): boolean {
  const players = match.match_players ?? [];
  if (match.game_config) {
    try { validateConfig(match.game_type, match.game_config, players.map(p => ({...p,is_winner:p.is_winner === true}))); } catch { return false; }
  }
  return (
    Number.isFinite(Date.parse(match.played_at)) &&
    players.length >= 2 &&
    players.length <= 10 &&
    new Set(players.map((p) => p.player_id)).size === players.length &&
    players.every((p) => p.player_id) &&
    players.filter((p) => p.is_winner === true).length === (match.game_config?.status && match.game_config.status !== 'completed' ? 0 : match.game_config?.format === '2v2' ? 2 : match.game_config?.format === '3v3' ? 3 : 1)
  );
}
function ordered(matches: NightMatch[]): NightMatch[] {
  return [...matches].sort(
    (a, b) => Date.parse(a.played_at) - Date.parse(b.played_at) || a.id - b.id,
  );
}
export function facts(matches: NightMatch[]): MatchFact[] {
  return matches.flatMap((m) =>
    (m.match_players ?? []).map((p) => ({
      matchId: String(m.id),
      playerId: p.player_id,
      displayName: participantName(p),
      playedAt: m.played_at,
      gameType: m.game_type,
      gameConfig: m.game_config,
      boardType: m.board_type,
      venue: m.venue,
      isWinner: p.is_winner === true,
      score: p.score,
    })),
  );
}
function scoreValid(score: number | null, game: string): score is number {
  const cap = gameDefinition(game)?.cap ?? 9999;
  return score !== null && Number.isFinite(score) && score >= 0 && score <= cap;
}

// The caller must fetch all authorized history before invoking this function.
// Scope night membership by ID, never by the venue/date or device that entered it.
export function buildNightRecap(
  history: NightMatch[],
  nightId: string,
): NightRecap {
  const all = ordered(history.filter(m => valid(m) && !ratingExclusion(m.game_config)));
  const incomplete = history.filter((m) => !valid(m));
  const beforeOrUnknown = (m: NightMatch, timestamp: number) =>
    !Number.isFinite(Date.parse(m.played_at)) ||
    Date.parse(m.played_at) <= timestamp;
  // A missing roster cannot establish that somebody was NOT in that game.
  const mayInvolve = (m: NightMatch, id: string) =>
    !m.match_players ||
    m.match_players.length < 2 ||
    m.match_players.some((p) => !p.player_id || p.player_id === id);
  const matches = all.filter((m) => m.night_id === nightId);
  const sharedNightStart = matches.length
    ? Date.parse(matches[0].played_at)
    : Infinity;
  const nightIds = new Set(matches.map((m) => String(m.id)));
  const standings = new Map<string, NightStanding>();
  const awards: NightAward[] = [];
  const ratingMoves: RatingMove[] = [];
  for (const match of matches)
    for (const p of match.match_players ?? []) {
      const row = standings.get(p.player_id) ?? {
        playerId: p.player_id,
        name: participantName(p),
        games: 0,
        wins: 0,
      };
      row.games++;
      if (p.is_winner) row.wins++;
      standings.set(p.player_id, row);
    }
  // First recorded win is across disciplines. Equal timestamps cannot establish
  // which of two winning games came first, so don't invent a first-win event.
  for (const row of standings.values()) {
    const wins = all.filter((m) =>
      m.match_players?.some((p) => p.player_id === row.playerId && p.is_winner),
    );
    if (
      wins.length &&
      wins[0].night_id === nightId &&
      !incomplete.some(
        (m) =>
          mayInvolve(m, row.playerId) &&
          beforeOrUnknown(m, Date.parse(wins[0].played_at)),
      ) &&
      (!wins[1] ||
        Date.parse(wins[1].played_at) !== Date.parse(wins[0].played_at))
    ) {
      awards.push({
        id: `first:${row.playerId}`,
        kind: "first",
        title: "First of Many",
        playerId: row.playerId,
        playerName: row.name,
        reason: "First recorded win",
        scope: "All recorded formats",
        rule: "Your earliest win in the available recorded match history.",
        matchIds: [wins[0].id],
      });
    }
  }
  const scopes = new Set(
    matches
      .filter(
        (m) =>
          Boolean(gameDefinition(m.game_type)) && m.game_type !== "Other" &&
          ["Soft Tip", "Steel Tip"].includes(m.board_type ?? ""),
      )
      .map((m) => comparisonKey(m.game_type,m.board_type,m.game_config)),
  );
  for (const scopeKey of scopes) {
    const [game, board, preset, format] = JSON.parse(scopeKey) as [string,string,string,string];
    const sample = matches.find(m => comparisonKey(m.game_type,m.board_type,m.game_config) === scopeKey)!;
    const scope = `${game} · ${board}${format === 'individual' ? '' : ` · ${formatLabel(sample.game_config?.format)}`}${preset === 'unspecified' ? '' : ` · ${presetLabel(game,sample.game_config)}`}`;
    const scoped = all.filter(
      (m) => comparisonKey(m.game_type,m.board_type,m.game_config) === scopeKey,
    );
    const night = scoped.filter((m) => m.night_id === nightId);
    const uncertain = incomplete.filter(
      (m) =>
        (!m.game_type || m.game_type === game) &&
        (!m.board_type || m.board_type === board),
    );
    const stats = buildLeagueAdvancedStats(facts(scoped));
    const perPlayer = new Map<string, NightMatch[]>();
    for (const m of scoped)
      for (const p of m.match_players ?? []) {
        const list = perPlayer.get(p.player_id) ?? [];
        list.push(m);
        perPlayer.set(p.player_id, list);
      }
    const ambiguous = (m: NightMatch, id: string) =>
      [
        ...(perPlayer.get(id) ?? []),
        ...uncertain.filter((other) => mayInvolve(other, id)),
      ].filter(
        (other) => Date.parse(other.played_at) === Date.parse(m.played_at),
      ).length > 1;
    const candidates: RatingMove[] = [];
    for (const stat of stats.players) {
      const appearances = perPlayer.get(stat.playerId) ?? [];
      const ownNight = appearances.filter((m) => m.night_id === nightId);
      if (!ownNight.length) continue;
      const priorCount = appearances.filter(
        (m) => Date.parse(m.played_at) < sharedNightStart,
      ).length;
      const gain = stat.ratingHistory.reduce(
        (sum, point, index) =>
          sum +
          (index > 0 && nightIds.has(point.matchId)
            ? point.rating - stat.ratingHistory[index - 1].rating
            : 0),
        0,
      );
      const move = {
        playerId: stat.playerId,
        name: stat.displayName,
        scope,
        gain,
        games: ownNight.length,
        provisional: priorCount / (format === '2v2' ? 2 : format === '3v3' ? 3 : 1) < PROVISIONAL_MATCHES,
      };
      ratingMoves.push(move);
      if (
        priorCount / (format === '2v2' ? 2 : format === '3v3' ? 3 : 1) >= PROVISIONAL_MATCHES &&
        ownNight.length >= 3 &&
        gain > 0 &&
        !uncertain.some((m) =>
          beforeOrUnknown(m, Date.parse(night[night.length - 1].played_at)),
        ) &&
        !ownNight.some((m) => ambiguous(m, stat.playerId))
      )
        candidates.push(move);

      let longest: NightMatch[] = [];
      let run: NightMatch[] = [];
      const unresolved = uncertain.filter((m) => mayInvolve(m, stat.playerId));
      const streakGames = ordered([
        ...ownNight,
        ...unresolved.filter((m) => m.night_id === nightId),
      ]);
      for (const m of streakGames) {
        if (
          !valid(m) ||
          ambiguous(m, stat.playerId) ||
          !m.match_players?.find((p) => p.player_id === stat.playerId)
            ?.is_winner
        )
          run = [];
        else {
          run = [...run, m];
          if (run.length > longest.length) longest = run;
        }
      }
      if (
        longest.length >= 3 &&
        !unresolved.some(
          (m) =>
            m.night_id === nightId && !Number.isFinite(Date.parse(m.played_at)),
        )
      )
        awards.push({
          id: `streak:${scopeKey}:${stat.playerId}`,
          kind: "streak",
          title: "Hat Trick",
          playerId: stat.playerId,
          playerName: stat.displayName,
          reason: `${longest.length} straight ${game} wins`,
          scope,
          rule: "At least three consecutive wins in your appearances this night, in this format and board type.",
          matchIds: longest.map((m) => m.id),
        });

      let bestAward: NightAward | undefined;
      for (const m of ownNight) {
        const score =
          m.match_players?.find((p) => p.player_id === stat.playerId)?.score ??
          null;
        if (!scoreValid(score, game) || ambiguous(m, stat.playerId)) continue;
        if (
          unresolved.some((other) =>
            beforeOrUnknown(other, Date.parse(m.played_at)),
          )
        )
          continue;
        const previous = appearances
          .filter(
            (other) => Date.parse(other.played_at) < Date.parse(m.played_at),
          )
          .map(
            (other) =>
              other.match_players?.find((p) => p.player_id === stat.playerId)
                ?.score ?? null,
          )
          .filter((value) => scoreValid(value, game));
        const previousBest = gameDefinition(game)?.lowerBetter ? Math.min(...previous) : Math.max(...previous);
        if (!previous.length || (gameDefinition(game)?.lowerBetter ? score >= previousBest : score <= previousBest)) continue;
        const unit = gameUnit(game);
        bestAward = {
          id: `best:${scopeKey}:${stat.playerId}`,
          kind: "best",
          title: "Personal Best",
          playerId: stat.playerId,
          playerName: stat.displayName,
          reason: `New recorded best: ${score.toFixed(2)} ${unit}, previously ${previousBest.toFixed(2)}`,
          scope,
          rule: `Exceeds ${previous.length} earlier compatible recorded score${previous.length === 1 ? "" : "s"}. First scores and tied bests do not earn this award.`,
          matchIds: [m.id],
        };
      }
      if (bestAward) awards.push(bestAward);
    }
    const highest = Math.max(0, ...candidates.map((c) => c.gain));
    for (const c of candidates.filter(
      (candidate) => Math.abs(candidate.gain - highest) < 1e-8,
    ))
      awards.push({
        id: `surge:${scopeKey}:${c.playerId}`,
        kind: "surge",
        title: "Power Surge",
        playerId: c.playerId,
        playerName: c.name,
        reason: `+${c.gain.toFixed(1)} rating across ${c.games} games`,
        scope,
        rule: "Largest positive night rating contribution; at least three night games and ten games before the night. Equal gains share the award.",
        matchIds: night
          .filter((m) =>
            m.match_players?.some((p) => p.player_id === c.playerId),
          )
          .map((m) => m.id),
      });
    const eligible = stats.upsets.filter((upset) => {
      const m = night.find((match) => String(match.id) === upset.matchId);
      if (!m) return false;
      if (
        uncertain.some((other) =>
          beforeOrUnknown(other, Date.parse(m.played_at)),
        )
      )
        return false;
      const players = m.match_players ?? [];
      return (
        upset.expectedWinProbability < (format === 'individual' ? 1 / players.length : 0.5) - 1e-10 &&
        players.every(
          (p) =>
            !ambiguous(m, p.player_id) &&
            (perPlayer.get(p.player_id) ?? []).filter(
              (prior) => Date.parse(prior.played_at) < Date.parse(m.played_at),
            ).length / (format === '2v2' ? 2 : format === '3v3' ? 3 : 1) >= PROVISIONAL_MATCHES,
        )
      );
    });
    for (const count of new Set(
      eligible.map((u) => u.opponentNames.length + (u.winnerIds?.length ?? 1)),
    )) {
      const candidates = eligible.filter(
        (u) => u.opponentNames.length + (u.winnerIds?.length ?? 1) === count,
      );
      const lowest = Math.min(
        ...candidates.map((u) => u.expectedWinProbability),
      );
      for (const upset of candidates.filter(
        (u) => Math.abs(u.expectedWinProbability - lowest) < 1e-10,
      ))
        awards.push({
          id: `upset:${upset.matchId}`,
          kind: "upset",
          title: "Giant Slayer",
          playerId: upset.winnerId,
          playerName: upset.winnerName,
          reason: `Won with a ${(upset.expectedWinProbability * 100).toFixed(1)}% pre-match chance`,
          scope: `${scope} · ${count} players`,
          rule: "Lowest qualifying winner probability among same-size matches. All players have ten prior evidence games; winner probability is below equal chance.",
          matchIds: [Number(upset.matchId)],
        });
    }
  }
  const order = { upset: 0, surge: 1, best: 2, streak: 3, first: 4 };
  awards.sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      a.scope.localeCompare(b.scope) ||
      a.playerName.localeCompare(b.playerName) ||
      a.id.localeCompare(b.id),
  );
  return {
    matches,
    standings: [...standings.values()].sort(
      (a, b) => b.wins - a.wins || a.name.localeCompare(b.name),
    ),
    awards,
    ratingMoves,
    ignored:
      history.filter((m) => m.night_id === nightId).length - matches.length,
    incompleteHistory: incomplete.length,
  };
}
