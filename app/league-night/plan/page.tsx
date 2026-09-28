"use client";
import Link from "next/link";
import { useCurrentUser } from "@/lib/league-night/use-current-user";
import { PlanningPage } from "@/components/planning/PlanningPage";
import "../night.css";
import "./planning.css";
export default function PlanPage() {
  const { user, loading } = useCurrentUser();
  if (loading)
    return (
      <main className="night-shell">
        <p>Opening Plan & RSVP…</p>
      </main>
    );
  if (!user)
    return (
      <main className="night-shell">
        <section className="night-panel">
          <h1>Plan & RSVP</h1>
          <p>
            Sign in to vote on the next league night and let everyone know
            you’re coming.
          </p>
          <Link href="/auth">Sign in</Link>
        </section>
      </main>
    );
  return <PlanningPage key={user.id} userId={user.id} />;
}
