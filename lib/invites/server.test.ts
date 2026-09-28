// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), createUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser, admin: { createUser: mocks.createUser } } }) }));
import { handleInvite } from './server';
const id = 'a71f8195-ea53-4a71-9bca-eb8df159acac';
function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://127.0.0.1:3102/api/invites', { method: 'POST', headers: { origin: 'http://127.0.0.1:3102', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.stubEnv('RDD_INVITES_ENABLED', '1'); vi.stubEnv('RDD_LOCAL_PREVIEW', '1');
  vi.stubEnv('RDD_INVITE_ORIGIN', 'http://127.0.0.1:3102'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:56521');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-server-key'); vi.stubEnv('RDD_INVITE_SECRET', 'synthetic-secret-material-long-enough-for-tests');
  mocks.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  mocks.rpc.mockResolvedValue({ data: {}, error: null });
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('fails closed when disabled and does not touch Auth or SQL', async () => {
  vi.stubEnv('RDD_INVITES_ENABLED', '0');
  expect((await handleInvite(request({ action: 'list' }))).status).toBe(503);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('rejects cross-origin and oversized bodies before privileged work', async () => {
  expect((await handleInvite(request({ action: 'list' }, { origin: 'https://elsewhere.example' }))).status).toBe(403);
  expect((await handleInvite(request({ action: 'list', extra: 'a'.repeat(9000) }))).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('requires an authenticated member and never trusts body actor IDs', async () => {
  expect((await handleInvite(request({ action: 'create', actor: id }))).status).toBe(403);
  await handleInvite(request({ action: 'list', actor: 'forged' }, { authorization: 'Bearer synthetic-session' }));
  expect(mocks.rpc).toHaveBeenCalledWith('invite_service', expect.objectContaining({ p_actor: id }));
});
it('sends only once after a recorded request and hides private SQL fields', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  mocks.rpc.mockResolvedValue({ data: { replayed: true, email: 'synthetic@example.test', id }, error: null });
  const result = await handleInvite(request({ action: 'create', requestId: id, email: 'synthetic@example.test' }, { authorization: 'Bearer synthetic' }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await result.text()).not.toContain('synthetic@example.test');
});
it('records ambiguous email delivery and does not claim it was sent', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')));
  mocks.rpc.mockResolvedValueOnce({ data: { id, email: 'synthetic@example.test', inviter: 'Player' }, error: null });
  const result = await handleInvite(request({ action: 'create', requestId: id, email: 'synthetic@example.test' }, { authorization: 'Bearer synthetic' }));
  expect(await result.json()).toEqual(expect.objectContaining({ message: expect.stringContaining('could not be confirmed') }));
  expect(mocks.rpc).toHaveBeenLastCalledWith('invite_service', expect.objectContaining({ p_action: 'delivery', p_data: expect.objectContaining({ state: 'unknown' }) }));
});
it('rejects completion without the browser challenge cookie', async () => {
  expect((await handleInvite(request({ action: 'complete', code: '12345678' }))).status).toBe(400);
  expect(mocks.createUser).not.toHaveBeenCalled();
});
it.each(['a'.repeat(73), 'é'.repeat(37)])('rejects a password above the Auth byte limit before reservation', async password => {
  mocks.rpc.mockResolvedValueOnce({ data: { email: 'synthetic@example.test', operation_id: id }, error: null });
  mocks.createUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 500, message: 'Internal Server Error' } });
  const result = await handleInvite(request({ action: 'complete', code: '12345678', password,
    firstName: 'Test', lastName: 'Player', displayName: 'Test Player' }, { cookie: `rdd-join=${id}.${'b'.repeat(43)}` }));
  expect(result.status).toBe(400);
  expect(await result.json()).toEqual(expect.objectContaining({ error: 'invalid_password' }));
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.createUser).not.toHaveBeenCalled();
});
it.each(['weak_password', 'validation_failed'])('releases a definite %s rejection so the recipient can correct it', async code => {
  mocks.rpc.mockResolvedValueOnce({ data: { email: 'synthetic@example.test', operation_id: id }, error: null });
  mocks.rpc.mockResolvedValueOnce({ data: { released: true }, error: null });
  mocks.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code, status: 422 } });
  const result = await handleInvite(request({ action: 'complete', code: '12345678', password: 'a'.repeat(16),
    firstName: 'Test', lastName: 'Player', displayName: 'Test Player' }, { cookie: `rdd-join=${id}.${'b'.repeat(43)}` }));
  expect(result.status).toBe(400);
  expect(await result.json()).toEqual(expect.objectContaining({ error: code === 'weak_password' ? 'password_rejected' : 'invalid_request' }));
  expect(mocks.rpc).toHaveBeenLastCalledWith('invite_service', expect.objectContaining({ p_action: 'release',
    p_data: expect.objectContaining({ challenge_id: id, operation_id: id }) }));
});
it.each([
  { code: 'weak_password', status: 500 },
  { code: undefined, status: undefined },
  { code: 'email_exists', status: 422 },
])('preserves ambiguous or conflicting Auth results: %j', async error => {
  mocks.rpc.mockResolvedValueOnce({ data: { email: 'synthetic@example.test', operation_id: id }, error: null });
  mocks.createUser.mockResolvedValueOnce({ data: { user: null }, error });
  const result = await handleInvite(request({ action: 'complete', code: '12345678', password: 'Synthetic long password!',
    firstName: 'Test', lastName: 'Player', displayName: 'Test Player' }, { cookie: `rdd-join=${id}.${'b'.repeat(43)}` }));
  expect(result.status).toBe(503);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('does not unlock rejected input when SQL cannot safely release its reservation', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { email: 'synthetic@example.test', operation_id: id }, error: null });
  mocks.rpc.mockResolvedValueOnce({ data: { released: false }, error: null });
  mocks.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: 'weak_password', status: 422 } });
  const result = await handleInvite(request({ action: 'complete', code: '12345678', password: 'Synthetic long password!',
    firstName: 'Test', lastName: 'Player', displayName: 'Test Player' }, { cookie: `rdd-join=${id}.${'b'.repeat(43)}` }));
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual(expect.objectContaining({ error: 'service_error' }));
});
