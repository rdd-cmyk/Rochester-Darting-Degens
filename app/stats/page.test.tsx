import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import AdvancedStatsPage from './page';

const supabaseMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: supabaseMock.getUser,
      onAuthStateChange: supabaseMock.onAuthStateChange,
    },
    from: supabaseMock.from,
  },
}));

vi.mock('@/components/stats/RatingTrendChart', () => ({
  RatingTrendChart: () => <div data-testid="rating-chart" />,
}));

let authChange: ((event: string, session: { user: { id: string } } | null) => void) | null;

beforeEach(() => {
  vi.resetAllMocks();
  authChange = null;
  supabaseMock.onAuthStateChange.mockImplementation((callback) => {
    authChange = callback;
    return { data: { subscription: { unsubscribe: supabaseMock.unsubscribe } } };
  });
});

function mockOtherMatches() {
  const rows = [20, 1000, 40].flatMap((score, index) =>
    ['ace', 'bee'].map((id) => ({
      id: `${index}-${id}`,
      match_id: index + 1,
      player_id: id,
      is_winner: id === 'ace',
      score: id === 'ace' ? score : score - 1,
      profiles: {
        id,
        display_name: id === 'ace' ? 'Ace' : 'Bee',
        first_name: null,
        include_first_name_in_display: false,
      },
      matches: {
        played_at: `2026-01-0${index + 1}T20:00:00.000Z`,
        game_type: 'Other',
        board_type: 'Steel Tip',
        venue: 'League night',
      },
    }))
  );
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue({ data: rows, count: rows.length, error: null }),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  supabaseMock.from.mockReturnValue(query);
}

test('shows a sign-in prompt without querying league rows for a guest', async () => {
  supabaseMock.getUser.mockResolvedValue({ data: { user: null }, error: null });

  render(<AdvancedStatsPage />);

  expect(await screen.findByRole('heading', { name: 'Sign in to see league statistics.' }))
    .toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/auth');
  expect(screen.queryByText('No eligible players')).not.toBeInTheDocument();
  expect(supabaseMock.from).not.toHaveBeenCalled();
});

test('makes Other score consistency opt-in and clears league data on sign-out', async () => {
  supabaseMock.getUser.mockResolvedValue({ data: { user: { id: 'viewer' } }, error: null });
  mockOtherMatches();

  render(<AdvancedStatsPage />);
  await waitFor(() => expect(supabaseMock.from).toHaveBeenCalledWith('match_players'));
  await waitFor(() =>
    expect(screen.getByText('matches analyzed').parentElement).toHaveTextContent('3matches analyzed')
  );

  fireEvent.change(screen.getByLabelText('Game type'), { target: { value: 'Other' } });
  const toggle = screen.getByRole('checkbox', { name: 'Scores excluded' });
  expect(toggle).not.toBeChecked();
  expect(screen.queryByRole('heading', { name: 'Score consistency' })).not.toBeInTheDocument();

  fireEvent.click(toggle);
  expect(screen.getByRole('checkbox', { name: 'Scores included' })).toBeChecked();
  expect(screen.getByRole('heading', { name: 'Score consistency' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Game type'), { target: { value: '501' } });
  fireEvent.change(screen.getByLabelText('Game type'), { target: { value: 'Other' } });
  expect(screen.getByRole('checkbox', { name: 'Scores excluded' })).not.toBeChecked();

  await act(async () => authChange?.('SIGNED_OUT', null));
  expect(screen.getByRole('heading', { name: 'Sign in to see league statistics.' }))
    .toBeInTheDocument();
  expect(screen.queryByText('Ace')).not.toBeInTheDocument();
});
