import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { PlayerAdvancedStats } from '@/lib/stats/types';
import { RatingTrendChart } from './RatingTrendChart';

const player: PlayerAdvancedStats = {
  playerId: 'ace',
  displayName: 'Ace',
  rank: 1,
  games: 1,
  wins: 1,
  losses: 0,
  winPct: 100,
  rating: 1516,
  ratingDelta: 16,
  ratingDeltaLastFive: 16,
  provisional: true,
  expectedWins: 0.5,
  winDelta: 0.5,
  strengthOfSchedule: 1500,
  qualityWinPoints: 0.5,
  recentWins: 1,
  recentGames: 1,
  ratingHistory: [
    {
      matchId: 'start:ace',
      playedAt: '2026-08-30T20:00:00.000Z',
      rating: 1500,
    },
    {
      matchId: '1',
      playedAt: '2026-08-30T20:00:00.000Z',
      rating: 1516,
    },
  ],
  scoreDistribution: null,
};

describe('RatingTrendChart', () => {
  test('provides an expandable table containing the chart values', () => {
    render(<RatingTrendChart players={[player]} />);

    expect(
      screen.getByRole('img', {
        name: 'Power rating by player appearance for the leading eligible players',
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('View exact rating history'));
    const table = screen.getByRole('table', {
      name: 'Exact rating history for the charted players',
    });

    expect(within(table).getAllByText('Ace')).toHaveLength(2);
    expect(within(table).getByText('Baseline')).toBeInTheDocument();
    expect(within(table).getByText('1516.0')).toBeInTheDocument();
  });
});
