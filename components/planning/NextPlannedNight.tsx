"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadPlanning,
  rochesterTime,
  type PlanningFeed,
  type ScheduledNight,
} from "@/lib/planning";
export function NextPlannedNight() {
  const [night, setNight] = useState<ScheduledNight | null>(null);
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
          serverOffset = Date.parse(data.server_now) - Date.now();
          currentId = updateNight();
        })
        .catch(() => {});
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
  return (
    <section className="night-panel">
      <div className="night-section-heading">
        <div>
          <h2>{night ? "Next on the calendar" : "Plan the next night"}</h2>
          <p>
            {night
              ? `${night.title} · ${rochesterTime(night.starts_at)} · ${night.venue}`
              : "Vote on a date or venue and RSVP for upcoming league nights."}
          </p>
        </div>
        <Link href="/league-night/plan">Plan & RSVP →</Link>
      </div>
    </section>
  );
}
