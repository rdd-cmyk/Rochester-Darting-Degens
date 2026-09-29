// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ listUsers: vi.fn(), createClient: vi.fn(), fetch: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
import { GET } from './route';

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'release/next');
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'synthetic-commit');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://uepayhdrgzrxhkqbwebo.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-client-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-server-key');
  vi.stubEnv('RDD_INVITES_ENABLED', '0');
  for (const name of ['RDD_LOCAL_PREVIEW', 'RDD_VISUAL_FIXTURE', 'NEXT_PUBLIC_RDD_VISUAL_FIXTURE']) {
    vi.stubEnv(name, '');
  }
  mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }));
  mocks.listUsers.mockResolvedValue({ data: { users: [{ email: 'private@example.test' }] }, error: null });
  mocks.createClient.mockReturnValue({ auth: { admin: { listUsers: mocks.listUsers } } });
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(['production', 'development', ''])('is unavailable in %s without making requests', async (env) => {
  vi.stubEnv('VERCEL_ENV', env);
  expect((await GET()).status).toBe(404);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it('is unavailable on other preview branches', async () => {
  vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'other-branch');
  expect((await GET()).status).toBe(404);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each(['https://hrqsbzmsfichiimtxijj.supabase.co', 'http://127.0.0.1:54321',
  'https://uepayhdrgzrxhkqbwebo.supabase.co@elsewhere.example',
  'https://uepayhdrgzrxhkqbwebo.supabase.co/extra'])('rejects unexpected target %s before any request', async (url) => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
  expect((await GET()).status).toBe(409);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it.each(['RDD_LOCAL_PREVIEW', 'RDD_VISUAL_FIXTURE', 'NEXT_PUBLIC_RDD_VISUAL_FIXTURE',
  'RDD_INVITES_ENABLED'])('rejects enabled %s before any request', async (name) => {
  vi.stubEnv(name, '1');
  expect((await GET()).status).toBe(409);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])('rejects missing %s', async (name) => {
  vi.stubEnv(name, '');
  expect((await GET()).status).toBe(409);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('returns only sanitized identity after both bounded reads succeed', async () => {
  const response = await GET();
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  expect(JSON.parse(body)).toMatchObject({ commit: 'synthetic-commit',
    supabaseProjectRef: 'uepayhdrgzrxhkqbwebo', clientCredentialVerified: true,
    serverCredentialVerified: true, schemaAcceptance: 'not_exercised' });
  expect(mocks.fetch).toHaveBeenCalledWith('https://uepayhdrgzrxhkqbwebo.supabase.co/auth/v1/settings',
    expect.objectContaining({ headers: { apikey: 'synthetic-client-key' }, cache: 'no-store' }));
  expect(mocks.createClient).toHaveBeenCalledWith('https://uepayhdrgzrxhkqbwebo.supabase.co',
    'synthetic-server-key', expect.any(Object));
  expect(mocks.listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1 });
  expect(body).not.toMatch(/synthetic-client-key|synthetic-server-key|private@example/);
});
it('does not attempt the privileged read when the client key fails', async () => {
  mocks.fetch.mockResolvedValue(new Response('{}', { status: 401 }));
  expect((await GET()).status).toBe(503);
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it('reports a mismatched server key without leaking upstream errors', async () => {
  mocks.listUsers.mockResolvedValue({ data: null, error: { message: 'synthetic-server-key' } });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('synthetic-server-key');
});
it('handles network failure without returning credentials', async () => {
  mocks.fetch.mockRejectedValue(new Error('synthetic-client-key'));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('synthetic-client-key');
});
