"use client";
import { ActionLink } from "@/components/ui/ActionLink";
import { CalendarDownload } from './CalendarDownload';
import { useEffect, useState } from "react";
import {
  loadPlanning,
  rochesterTime,
  type PlanningFeed,
  type ScheduledNight,
} from "@/lib/planning";
export function NextPlannedNight({ featured = false }: { featured?: boolean }) {
  const [night, setNight] = useState<ScheduledNight | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [readError, setReadError] = useState(false);
  useEffect(() => {
    let active = true;
    let latest: PlanningFeed | null = null;
    let serverOffset = 0;
    let currentId: string | undefined;
    let requestVersion = 0;
    const updateNight = () => {
      if (!latest) return;
      const next =
        latest.nights.find(
          (n) =>
            n.status === "scheduled" &&
            Date.parse(n.starts_at) > Date.now() + serverOffset,
        ) ?? null;
      setNight(next);
      return next?.night_id;
    };
    const refresh = () => {
      const request = ++requestVersion;
      void loadPlanning()
        .then((data) => {
          if (!active || request !== requestVersion) return;
          latest = data;
          setLoaded(true);
          setReadError(false);
          serverOffset = Date.parse(data.server_now) - Date.now();
          currentId = updateNight();
        })
        .catch(() => { if (active && request === requestVersion) { setLoaded(true); setReadError(true); } });
    };
    refresh();
    const timer = window.setInterval(() => {
      // Advance cached results even if the boundary read loses its connection.
      // Only event transitions trigger a read; the clock tick itself stays local.
      const nextId = updateNight();
      if (nextId !== currentId) {
        currentId = nextId;
        refresh();
      }
    }, 1000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  if (featured) return <section className="rdd-content-panel landing-feature">
    <p className="rdd-title-eyebrow">{night ? 'The next league night' : 'Next up'}</p>
    {!loaded ? <p role="status">Checking the calendar…</p> : readError ? <>
      <h2 className="rdd-section-title">The calendar could not be loaded.</h2>
      <p role="alert">Open planning to refresh the schedule and check your RSVP.</p>
      <ActionLink href="/league-night/plan">Open planning</ActionLink>
    </> : night ? <>
      <h2 className="rdd-section-title">{night.title}</h2>
      <p>{rochesterTime(night.starts_at)}{night.venue ? ` · ${night.venue}` : ''}</p>
      <p className="rdd-field-help">{night.responses.filter(r => r.going).length} going
        {night.mine ? ` · You’re ${night.mine.going ? 'going' : 'not going'}` : ' · No RSVP recorded'}</p>
      <div className="landing-actions"><ActionLink href="/league-night/plan" variant="primary">View plan & RSVP</ActionLink><CalendarDownload key={`${night.night_id}:${night.revision}`} night={night} /></div>
    </> : <>
      <h2 className="rdd-section-title">The next night is yours to call.</h2>
      <p>Vote on a date or venue, or check the planning page for open polls.</p>
      <div className="landing-actions"><ActionLink href="/league-night/plan" variant="primary">Plan the next night</ActionLink></div>
    </>}
  </section>;
  return (
    <section className="night-panel">
      <div className="night-section-heading">
        <div>
          <h2 className="rdd-section-title">{night ? "Next on the calendar" : "Plan the next night"}</h2>
          <p>
            {night
              ? `${night.title} · ${rochesterTime(night.starts_at)} · ${night.venue}`
              : "Vote on a date or venue and RSVP for upcoming league nights."}
          </p>
        </div>
        <div className="landing-actions"><ActionLink href="/league-night/plan">Plan & RSVP</ActionLink>{night && !readError && <CalendarDownload key={`${night.night_id}:${night.revision}`} night={night} />}</div>
      </div>
    </section>
  );
}
