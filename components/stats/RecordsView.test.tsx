import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import RecordsView from './RecordsView';
const { identity, from, query } = vi.hoisted(() => ({
  identity: { user: { id: 'member' } as { id: string } | null },
  from: vi.fn(), query: { select: vi.fn(), order: vi.fn(), range: vi.fn() },
}));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from } }));
vi.mock('@/lib/league-night/use-current-user', () => ({ useCurrentUser: () => ({ user: identity.user, loading: false }) }));
const rows = [
  { id: 1, match_id: 1, player_id: 'a', is_winner: true, score: 60, profiles: { id: 'a', display_name: 'Alex', first_name: null, include_first_name_in_display: false }, matches: { game_type: '501', played_at: '2026-09-01T20:00:00Z' } },
  { id: 2, match_id: 1, player_id: 'b', is_winner: false, score: 50, profiles: { id: 'b', display_name: 'Morgan', first_name: null, include_first_name_in_display: false }, matches: { game_type: '501', played_at: '2026-09-01T20:00:00Z' } },
];
beforeEach(() => {
  vi.clearAllMocks(); identity.user = { id: 'member' };
  from.mockReturnValue(query); query.select.mockReturnValue(query); query.order.mockReturnValue(query);
  query.range.mockResolvedValue({ data: rows, error: null, count: 2 });
});
it('preserves all four traditional record sections and their recorded averages', async () => {
  render(<RecordsView />);
  await waitFor(() => expect(query.range).toHaveBeenCalled());
  expect(screen.getByRole('heading', { name: 'Overall Leaderboard (All Match Types)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Game Type Leaderboard' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '3-Dart Average Leaderboard (501 / 301)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'MPR Leaderboard (Cricket)' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Head-to-Head Leaderboard' })).not.toBeInTheDocument();
  expect(await screen.findByText('60.00')).toBeInTheDocument();
});
it('keeps the head-to-head player selector and full opponent record in its own view', async () => {
  render(<RecordsView view="head-to-head" />);
  const selector = await screen.findByRole('combobox');
  await waitFor(() => expect(selector.querySelectorAll('option')).toHaveLength(2));
  fireEvent.change(selector, { target: { value: 'a' } });
  expect(await screen.findByRole('link', { name: 'Morgan' })).toHaveAttribute('href', '/profiles/b');
  expect(screen.queryByRole('heading', { name: 'Overall Leaderboard (All Match Types)' })).not.toBeInTheDocument();
});
it('does not request league data for guests', () => {
  identity.user = null; render(<RecordsView />);
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth');
  expect(from).not.toHaveBeenCalled();
});
