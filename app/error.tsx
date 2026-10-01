'use client';

import { useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionLink } from '@/components/ui/ActionLink';
import { ActionButton } from '@/components/ui/ActionButton';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Page rendering failed:', error);
  }, [error]);

  return (
    <main className="page-shell utility-consistent">
      <PageHeader eyebrow="Something went wrong" title="We could not load this page"
        description="Try again, or return to the standings." />
      <div className="rdd-actions">
        <ActionButton variant="primary" onClick={reset}>Try again</ActionButton>
        <ActionLink href="/">Home leaderboard</ActionLink>
      </div>
    </main>
  );
}
