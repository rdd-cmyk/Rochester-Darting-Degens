import { notFound } from 'next/navigation';
import { GET } from '../api/release-readiness/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'W1 Preview Isolation', robots: { index: false, follow: false } };

export default async function ReleaseReadinessPage() {
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.VERCEL_GIT_COMMIT_REF !== 'release/next') notFound();

  // Render the same read-only server check as HTML. Browser inspection tools
  // may refuse direct navigation to non-HTML API responses.
  const response = await GET();
  const result = await response.json();
  return <main className="container" style={{ padding: '2rem 1rem' }}>
    <h1>Release preview isolation check</h1>
    <p>{response.ok ? 'Client and server credentials verified on RDD Release Testing.' :
      'The isolation check has not passed.'}</p>
    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(result, null, 2)}</pre>
    <p>This checks connection isolation only. Database schema, gameplay, email,
      backup and restore acceptance remain separate release steps.</p>
  </main>;
}
