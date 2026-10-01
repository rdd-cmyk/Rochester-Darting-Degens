import { PageHeader } from '@/components/ui/PageHeader';
import { ActionLink } from '@/components/ui/ActionLink';

export const metadata = { title: 'Page Not Found' };

export default function NotFound() {
  return (
    <main className="rdd-page-shell page-shell utility-consistent">
      <PageHeader eyebrow="Page not found" title="That page is off the board"
        description="The link may have changed. Return to the standings or browse matches." />
      <div className="rdd-actions">
        <ActionLink href="/" variant="primary">Home leaderboard</ActionLink>
        <ActionLink href="/matches">Matches</ActionLink>
      </div>
    </main>
  );
}
