"use client";
import { ActionLink } from "@/components/ui/ActionLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCurrentUser } from "@/lib/league-night/use-current-user";
import { PlanningPage } from "@/components/planning/PlanningPage";
import "./planning.css";
export default function PlanPage() {
  const { user, loading } = useCurrentUser();
  if (loading) return (
    <main className="planning-page">
      <PageHeader size="standard" eyebrow="Plan & RSVP"
        title="Make the next night happen" description="Opening the next-night lineup…" />
    </main>
  );
  if (!user) return (
    <main className="planning-page">
      <PageHeader size="standard" eyebrow="Plan & RSVP" title="Make the next night happen"
        description="Sign in to vote on the next league night and let everyone know you’re coming."
        actions={<ActionLink variant="primary" href="/auth">Sign in</ActionLink>} />
    </main>
  );
  return <PlanningPage key={user.id} userId={user.id} />;
}
