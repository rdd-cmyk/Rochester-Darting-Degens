import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// W1 diagnostics are limited to this release's synthetic hosted target. Never
// allow a URL supplied by the caller, or probe the live project's credentials.
const testingRef = 'uepayhdrgzrxhkqbwebo';
const testingUrl = `https://${testingRef}.supabase.co`;
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

function diagnostic(body: Record<string, unknown>, status = 200) {
  // Keep the sanitized result machine-readable. The HTML server page wraps
  // this same check for browser tools that refuse non-HTML navigation.
  return new NextResponse(JSON.stringify(body, null, 2), { status,
    headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.VERCEL_GIT_COMMIT_REF !== 'release/next') {
    return diagnostic({ message: 'Not found.' }, 404);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clientKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fixtureEnabled = ['RDD_LOCAL_PREVIEW', 'RDD_VISUAL_FIXTURE',
    'NEXT_PUBLIC_RDD_VISUAL_FIXTURE'].some((name) => process.env[name] === '1');

  if (url !== testingUrl || !clientKey || !serverKey || fixtureEnabled ||
      !['0', '1'].includes(process.env.RDD_INVITES_ENABLED ?? '')) {
    return diagnostic({ message: 'Release preview configuration is not ready.' }, 409);
  }

  try {
    // Both operations are reads. The Auth settings endpoint validates the
    // client API key without needing a user or the deferred application schema.
    const clientResponse = await fetch(`${testingUrl}/auth/v1/settings`, {
      headers: { apikey: clientKey }, cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!clientResponse.ok) throw new Error('client_key_check_failed');

    const server = createClient(testingUrl, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, {
        ...init, signal: AbortSignal.timeout(8000),
      }) },
    });
    // A single bounded admin read proves this key has service-role access on
    // the testing project. Discard every user field; emit no user count/data.
    const { data, error } = await server.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error || !Array.isArray(data?.users)) throw new Error('server_key_check_failed');

    return diagnostic({
      environment: 'preview', branch: 'release/next',
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      supabaseProjectRef: testingRef,
      clientCredentialVerified: true, serverCredentialVerified: true,
      invitationsEnabled: process.env.RDD_INVITES_ENABLED === '1', fixtureFlagsEnabled: false,
      schemaAcceptance: 'not_exercised',
    });
  } catch {
    // SDK errors may contain URLs or upstream details. Never return/log them.
    return diagnostic({ message: 'Testing-project credential verification failed.' }, 503);
  }
}
