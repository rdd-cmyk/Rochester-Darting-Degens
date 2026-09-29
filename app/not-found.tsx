import Link from 'next/link';

export const metadata = { title: 'Page Not Found' };

export default function NotFound() {
  return (
    <main className="page-shell account-page">
      <header className="rdd-page-header rdd-page-header--compact">
        <p className="rdd-eyebrow">Page not found</p>
        <h1>That page is off the board.</h1>
        <p>The link may have changed. You can return to the standings or browse matches.</p>
      </header>
      <div className="rdd-actions">
        <Link href="/" className="rdd-action rdd-action--primary">Home leaderboard</Link>
        <Link href="/matches" className="rdd-action">Matches</Link>
      </div>
    </main>
  );
}
