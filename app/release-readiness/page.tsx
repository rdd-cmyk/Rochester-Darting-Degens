import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
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
  return <main className="page-shell utility-consistent">
    <PageHeader eyebrow="Release diagnostics" title="Preview isolation check"
      description="Check which environment this release preview connects to." />
    <p className="rdd-state" role="status">{response.ok ? 'Client and server credentials verified on RDD Release Testing.' :
      'The isolation check has not passed.'}</p>
    <pre className="rdd-content-panel utility-output" aria-label="Sanitized isolation result">{JSON.stringify(result, null, 2)}</pre>
    <p className="utility-scope">This checks connection isolation only. Database schema, gameplay, email,
      backup and restore acceptance remain separate release steps.</p>
  </main>;
}
