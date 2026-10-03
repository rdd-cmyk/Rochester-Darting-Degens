'use client';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActionLink } from '@/components/ui/ActionLink';
import { NextPlannedNight } from '@/components/planning/NextPlannedNight';
import BoardPreview from '@/components/board/BoardPreview';
import { PowerSnapshot } from './PowerSnapshot';
import type { LeagueNight } from '@/lib/league-night/types';
import { nightDate } from './NightRecapPanel';

export function NightLobbyOverview({ nights, loading, unavailable = false, open }: { nights: LeagueNight[]; loading: boolean; unavailable?: boolean; open: (night: LeagueNight) => void }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todayNights = nights.filter(n => n.night_date === today && n.planning_status !== 'cancelled');
  const latest = nights.filter(n => n.night_date < today && n.planning_status !== 'cancelled')
    .sort((a, b) => b.night_date.localeCompare(a.night_date))[0];
  return <>
    <div className="landing-grid">
      <div className="landing-stack">
        {loading ? <section className="rdd-content-panel" role="status">Finding your league nights…</section>
          : !unavailable && todayNights.length > 0 && <section className="rdd-content-panel landing-feature">
            <p className="rdd-title-eyebrow">Today at the board</p>
            <h2 className="rdd-section-title">Keep today’s results together.</h2>
            <p className="rdd-field-help">Choose your night to check in and record. A date alone does not mark a night as active or finished.</p>
            {todayNights.map(n => <div className="landing-night-choice" key={n.id}>
              <div><strong>{n.title}</strong><p className="rdd-field-help">{nightDate(n.night_date)}{n.venue ? ` · ${n.venue}` : ''}</p></div>
              <ActionButton variant="primary" onClick={() => open(n)}>Open night & record</ActionButton>
            </div>)}
          </section>}
        <NextPlannedNight featured />
      </div>
      <PowerSnapshot />
    </div>
    <div className="landing-grid">
      <section className="rdd-content-panel">
        <h2 className="rdd-section-title">Last time at the board</h2>
        {loading ? <p role="status">Loading the last night…</p> : unavailable ? <p>Night history is unavailable. Retry above to see the last recap.</p> : latest ? <>
          <h3>{latest.title}</h3><p className="rdd-field-help">{nightDate(latest.night_date)}{latest.venue ? ` · ${latest.venue}` : ''}</p>
          <p>Revisit the results, awards and recap from this night.</p>
          <div className="landing-actions"><ActionButton onClick={() => open(latest)}>Open night & recap</ActionButton><ActionLink href="/matches" variant="quiet">Match archive →</ActionLink></div>
        </> : <p>Your first league night will start the story. Open a night below or plan the next one.</p>}
      </section>
      <BoardPreview />
    </div>
  </>;
}
