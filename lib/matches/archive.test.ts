import { beforeEach, expect, it, vi } from 'vitest';
import { EMPTY_ARCHIVE_FILTERS, loadMatchArchive, loadArchiveNights } from './archive';
const { query, from } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn() };
  return { query, from: vi.fn() };
});
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from } }));
beforeEach(() => {
  vi.clearAllMocks(); from.mockReturnValue(query);
  for (const fn of [query.select, query.eq, query.is, query.gte, query.lt, query.order]) fn.mockReturnValue(query);
  query.range.mockResolvedValue({ data: [{ id: 10, match_players: [{ player_id: 'selected' }, { player_id: 'opponent' }] }], count: 11, error: null });
});
it('filters the parent using an independent participant alias and keeps all opponents', async () => {
  const result = await loadMatchArchive<{ match_players: { player_id: string }[] }>(2, { ...EMPTY_ARCHIVE_FILTERS, player: 'selected', game: '501' });
  expect(query.select.mock.calls[0][0]).toContain('player_filter:match_players!inner(player_id)');
  expect(query.select.mock.calls[0][0]).toContain('match_players(id,match_id,player_id');
  expect(query.eq).toHaveBeenCalledWith('player_filter.player_id', 'selected');
  expect(query.range).toHaveBeenCalledWith(10, 19);
  expect(result.matches[0].match_players.map(p => p.player_id)).toEqual(['selected', 'opponent']);
});
it('uses null night matching for standalone games and an exclusive next-day date bound', async () => {
  await loadMatchArchive(1, { ...EMPTY_ARCHIVE_FILTERS, night: 'standalone', from: '2026-10-01', to: '2026-10-01' });
  expect(query.is).toHaveBeenCalledWith('night_id', null);
  expect(query.gte).toHaveBeenCalledWith('played_at', new Date('2026-10-01T00:00:00').toISOString());
  expect(query.lt).toHaveBeenCalledWith('played_at', new Date('2026-10-02T00:00:00').toISOString());
});
it('surfaces permission/read failures instead of reporting an empty archive', async () => {
  const error = { code: '42501', message: 'denied' };
  query.range.mockResolvedValueOnce({ data: null, error });
  await expect(loadMatchArchive(1, EMPTY_ARCHIVE_FILTERS)).rejects.toEqual(error);
});


it('loads older night choices beyond the lobby limit even when the API caps pages', async () => {
  const nights = Array.from({ length: 41 }, (_, i) => ({ id: String(i), title: `Night ${i}`, night_date: '2026-01-01' }));
  query.range.mockResolvedValueOnce({ data: nights.slice(0, 40), count: 41, error: null });
  query.range.mockResolvedValueOnce({ data: nights.slice(40), count: 41, error: null });
  const result = await loadArchiveNights();
  expect(result).toEqual(nights);
  expect(result[40].title).toBe('Night 40');
  expect(from).toHaveBeenCalledWith('league_nights');
  expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
  expect(query.range.mock.calls.map(call => call[0])).toEqual([0, 40]);
});

it('does not return a partial night list if a later page fails', async () => {
  query.range.mockResolvedValueOnce({ data: [{ id: 'first', title: 'First', night_date: '2026-01-01' }], count: 2, error: null });
  query.range.mockResolvedValueOnce({ data: null, count: null, error: { message: 'Offline page' } });
  await expect(loadArchiveNights()).rejects.toEqual({ message: 'Offline page' });
});
