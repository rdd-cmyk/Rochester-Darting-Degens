"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadPlanning,
  rochesterTime,
  type ScheduledNight,
} from "@/lib/planning";
export function NextPlannedNight() {
  const [night, setNight] = useState<ScheduledNight | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void loadPlanning()
        .then((data) => {
          if (active)
            setNight(
              data.nights.find(
                (n) =>
                  n.status === "scheduled" &&
                  Date.parse(n.starts_at) > Date.parse(data.server_now),
              ) ?? null,
            );
        })
        .catch(() => {});
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
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
