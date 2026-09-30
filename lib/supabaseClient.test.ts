import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('leaves the emailed recovery fragment for the reset page without automatically signing in', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic-reset.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-publishable-key');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  localStorage.clear();
  const fragment = '#type=recovery&access_token=synthetic-access&refresh_token=synthetic-refresh';
  window.history.replaceState(null, '', `/reset-password${fragment}`);

  // Exercise the real SDK initialization; a mocked Auth client misses the race
  // where URL detection consumes the fragment before the page mounts.
  const { supabase } = await import('./supabaseClient');
  try {
    await supabase.auth.initialize();
    expect(window.location.hash).toBe(fragment);
    expect((await supabase.auth.getSession()).data.session).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await supabase.auth.stopAutoRefresh();
  }
});
