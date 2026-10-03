import { beforeEach, expect, it, vi } from 'vitest';
import { boardFeed, boardReply, isBoardAccessError } from './board';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => { const query = { select: () => query, eq: () => query, single: mocks.single }; return query; },
} }));
beforeEach(() => vi.clearAllMocks());

it.each([401, 403])('retains an uncoded HTTP %s denial from the feed API', async status => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '', message: 'Access denied', details: '', hint: '' }, status });
  const error = await boardFeed().catch(cause => cause);
  expect(error).toMatchObject({ code: '', message: 'Access denied', status });
  expect(isBoardAccessError(error)).toBe(true);
});
it('retains an uncoded reply API denial and distinguishes service failures', async () => {
  mocks.single.mockResolvedValue({ data: null, error: { code: '', message: 'Access denied' }, status: 403 });
  const error = await boardReply('reply').catch(cause => cause);
  expect(error).toMatchObject({ message: 'Access denied', status: 403 });
  expect(isBoardAccessError(error)).toBe(true);
  mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST000', message: 'Service unavailable' }, status: 503 });
  expect(isBoardAccessError(await boardFeed().catch(cause => cause))).toBe(false);
});
