import { describe, expect, test, vi } from 'vitest';

import { collectAllStatisticsRows } from './pagination';

describe('statistics pagination', () => {
  test('continues from the number of rows actually returned by a capped backend', async () => {
    const source = Array.from({ length: 7 }, (_, index) => index + 1);
    const loadPage = vi.fn(async (from: number, to: number) => ({
      rows: source.slice(from, Math.min(to + 1, from + 2)),
      totalCount: source.length,
    }));

    await expect(collectAllStatisticsRows(loadPage, 5)).resolves.toEqual(source);
    expect(loadPage.mock.calls).toEqual([
      [0, 4],
      [2, 6],
      [4, 8],
      [6, 10],
    ]);
  });

  test('loads until an empty page when an exact count is unavailable', async () => {
    const source = ['a', 'b', 'c'];
    const loadPage = vi.fn(async (from: number, to: number) => ({
      rows: source.slice(from, to + 1),
      totalCount: null,
    }));

    await expect(collectAllStatisticsRows(loadPage, 2)).resolves.toEqual(source);
    expect(loadPage).toHaveBeenLastCalledWith(3, 4);
  });

  test('rejects an invalid requested page size', async () => {
    await expect(
      collectAllStatisticsRows(async () => ({ rows: [], totalCount: 0 }), 0)
    ).rejects.toThrow('Statistics page size must be a positive integer.');
  });
});
