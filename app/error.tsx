'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Page rendering failed:', error);
  }, [error]);

  return (
    <main className="page-shell account-page">
      <header className="rdd-page-header rdd-page-header--compact">
        <p className="rdd-eyebrow">Something went wrong</p>
        <h1>We could not load this page.</h1>
        <p>Try again, or return to the standings.</p>
      </header>
      <div className="rdd-actions">
        <button type="button" className="rdd-action rdd-action--primary" onClick={reset}>Try again</button>
        <Link href="/" className="rdd-action">Home leaderboard</Link>
      </div>
    </main>
  );
}
