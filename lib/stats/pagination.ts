export type StatisticsPage<T> = {
  rows: T[];
  totalCount: number | null;
};

export type StatisticsPageLoader<T> = (
  from: number,
  to: number
) => Promise<StatisticsPage<T>>;

export async function collectAllStatisticsRows<T>(
  loadPage: StatisticsPageLoader<T>,
  requestedPageSize = 500
): Promise<T[]> {
  if (!Number.isInteger(requestedPageSize) || requestedPageSize < 1) {
    throw new RangeError('Statistics page size must be a positive integer.');
  }

  const rows: T[] = [];

  while (true) {
    const from = rows.length;
    const { rows: pageRows, totalCount } = await loadPage(
      from,
      from + requestedPageSize - 1
    );

    if (pageRows.length === 0) break;

    rows.push(...pageRows);
    if (totalCount !== null && rows.length >= totalCount) break;
  }

  return rows;
}
