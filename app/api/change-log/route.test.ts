// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), client: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.client }));
let GET: typeof import('./route').GET;
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('GITHUB_TOKEN', 'fictional-server-token');
  vi.stubEnv('GITHUB_REPO_OWNER', 'fictional'); vi.stubEnv('GITHUB_REPO_NAME', 'fixture');
  vi.stubEnv('RDD_VISUAL_FIXTURE', '0');
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'fictional' } }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.client.mockReturnValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([
    { base: { ref:'main' }, id: 1, title: 'Fictional note', merged_at: '2026-01-01', body: '## Summary\nFictional summary' },
  ]), { status: 200 })));
  ({ GET } = await import('./route'));
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request = () => new NextRequest('http://127.0.0.1:3093/api/change-log', { headers: { authorization: 'Bearer fictional-session' } });
it.each(['unadmitted', 'revoked'])('denies %s identity before fetching private notes', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  expect((await GET(request())).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it('fails closed on admission read failure without exposing upstream errors', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'fictional private failure' } });
  const result = await GET(request());
  expect(result.status).toBe(503); expect(await result.text()).not.toContain('private failure');
  expect(fetch).not.toHaveBeenCalled();
});
it('uses the caller token and checks revocation again before cached notes', async () => {
  expect((await GET(request())).status).toBe(200);
  expect(mocks.client).toHaveBeenLastCalledWith(expect.any(String), expect.any(String),
    expect.objectContaining({ global: { headers: { Authorization: 'Bearer fictional-session' } } }));
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  vi.mocked(fetch).mockClear();
  expect((await GET(request())).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
});
it('fails closed when admission transport rejects', async () => {
  mocks.rpc.mockRejectedValue(new Error('private transport detail'));
  const result = await GET(request());
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain('private transport');
  expect(fetch).not.toHaveBeenCalled();
});
it('denies invalid Auth before checking membership', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
  expect((await GET(request())).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
});

it('requests only main and excludes merged feature PRs and unmerged closures', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([
    { id:1, title:'Released', merged_at:'2026-09-25', body:null, base:{ref:'main'} },
    { id:2, title:'Integrated only', merged_at:'2026-09-28', body:null, base:{ref:'release/next'} },
    { id:3, title:'Closed', merged_at:null, body:null, base:{ref:'main'} },
  ]),{status:200}));
  const result=await GET(request());
  expect((await result.json()).pulls.map((p:{id:number})=>p.id)).toEqual([1]);
  expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).searchParams.get('base')).toBe('main');
});
