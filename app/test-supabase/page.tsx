'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';

export default function TestSupabasePage() {
  const [status, setStatus] = useState('Checking the local client session…');
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        // This does not query the database or verify hosted connectivity.
        const { error } = await supabase.auth.getSession();
        if (error) {
          setStatus('Error: ' + error.message);
        } else {
          setStatus('Client session check completed. Database connectivity was not tested.');
        }
      } catch (e: unknown) {
        const message =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message?: string }).message)
            : String(e);

        setStatus('Error: ' + message);
      }
    }

    check();
  }, []);

  if (previewError) throw new Error('Synthetic local preview render failure.');

  return (
    <main className="rdd-page-shell page-shell utility-consistent">
      <PageHeader eyebrow="Diagnostics" title="Client session check"
        description="Inspect the session available to this browser. This does not test the database connection." />
      <p className="rdd-state" role="status">{status}</p>
      {process.env.NEXT_PUBLIC_RDD_VISUAL_FIXTURE === '1' && (
        <ActionButton onClick={() => setPreviewError(true)}>
          Preview error fallback
        </ActionButton>
      )}
    </main>
  );
}
