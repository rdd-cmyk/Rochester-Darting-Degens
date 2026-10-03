'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PlayerAvatar } from '@/components/avatars/PlayerAvatar';
import { ActionLink } from '@/components/ui/ActionLink';
import { ActionButton } from '@/components/ui/ActionButton';
import { loadStatisticsFacts } from '@/lib/stats/load-facts';
import { buildLeagueAdvancedStats } from '@/lib/stats/engine';
import type { MatchFact } from '@/lib/stats/types';

export function PowerSnapshot() {
  const [facts, setFacts] = useState<MatchFact[] | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    loadStatisticsFacts().then(data => { if (active) { setFacts(data); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [reload]);
  const league = useMemo(() => facts ? buildLeagueAdvancedStats(facts) : null, [facts]);
  const players = league?.players.filter(p => (p.evidenceGames ?? p.games) >= 3).slice(0, 3) ?? [];
  return <section className="rdd-content-panel landing-power" aria-labelledby="power-snapshot-title">
    <div className="landing-section-heading"><h2 className="rdd-section-title" id="power-snapshot-title">The power picture</h2><ActionLink href="/stats" variant="quiet">Full Stats →</ActionLink></div>
    <p className="rdd-field-help">Overall power · all recorded history · 3+ evidence games</p>
    {error ? <p role="alert">Ratings could not be loaded. <ActionButton onClick={() => setReload(n => n + 1)}>Try again</ActionButton></p>
      : !league ? <p role="status">Loading ratings…</p>
      : players.length ? <ol className="landing-power-list">{players.map(p => <li key={p.playerId}>
        <div><Link className="landing-power-player" href={`/profiles/${p.playerId}`}><PlayerAvatar playerId={p.playerId} name={p.displayName} size={32} />{p.displayName}</Link><span className="rdd-field-help">{p.provisional ? 'Provisional' : 'Established'} · {(p.evidenceGames ?? p.games).toFixed(1)} evidence games</span></div>
        <strong>{Math.round(p.rating).toLocaleString()}</strong>
      </li>)}</ol> : <p>No players have enough recorded evidence yet. Full Stats can show smaller samples.</p>}
    <p className="rdd-field-help">Ratings and evidence use the same calculation as Stats. Provisional ratings are still settling.</p>
  </section>;
}
