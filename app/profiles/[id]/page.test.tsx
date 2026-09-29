import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ProfilePage from './page';
import { defaultConfig, type GameConfig } from '@/lib/games/catalog';

const { from, getUser } = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from, auth: { getUser } } }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'player-1' }) }));

// Solo has separate privacy tests; keep it out of this match-history fixture.
vi.mock('@/lib/league-night/use-current-user',()=>({useCurrentUser:()=>({user:null,loading:false})}));
function match(id: number, note: string, gameType = '501', winner = true, status?: GameConfig['status'] | null, score: number | null = 60) {
  return { id, notes: note, game_type: gameType, played_at: '2026-09-01T12:00:00Z',
    game_config: status ? {...defaultConfig(), status} : null,
    all_match_players: [{ id, match_id: id, player_id: 'player-1', score,
      points_scored: null, is_winner: winner, profiles: null }] };
}
type Result = { data: ReturnType<typeof match>[] | null; error: { message: string } | null; count: number };
type Request = { filters: [string, unknown][]; range: number[]; resolve: (value: Result) => void };
let requests: Request[];
let profileResult: {
  data: { id: string; display_name: string } | null;
  error: { message: string } | null;
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'viewer' } }, error: null });
  requests = [];
  profileResult = { data: { id: 'player-1', display_name: 'Test player' }, error: null };
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 0; });
  from.mockImplementation((table: string) => {
    const filters: [string, unknown][] = [];
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
      or: vi.fn((expression: string) => { filters.push(['or', expression]); return query; }),
      order: vi.fn().mockReturnThis(),
      maybeSingle: () => Promise.resolve(profileResult),
      limit: () => Promise.resolve({ data: [match(1, 'Recent win'), match(2, 'Recent loss', 'Cricket', false), match(3, 'Unresolved tie', '501', false, 'tied')], error: null }),
      range: (start: number, end: number) => new Promise<Result>(resolve => {
        requests.push({ filters, range: [start, end], resolve });
      }),
      // Only the stats query is awaited without a terminal single/limit/range.
      then: (resolve: (value: { data: never[]; error: null }) => void) => {
        expect(table).toBe('match_players');
        resolve({ data: [], error: null });
      },
    };
    return query;
  });
});
afterEach(() => vi.restoreAllMocks());

it('asks a signed-out visitor to sign in instead of reporting a hidden profile as missing', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError' } });
  profileResult = { data: null, error: null };

  render(<ProfilePage />);

  expect(await screen.findByText('Sign in to view player profiles.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/auth');
  expect(screen.queryByRole('heading', { name: 'Player not found' })).not.toBeInTheDocument();
  expect(from).not.toHaveBeenCalled();
});

it('keeps an account-check failure separate from a missing profile', async () => {
  getUser.mockRejectedValue(new Error('Network unavailable'));
  profileResult = { data: null, error: null };

  render(<ProfilePage />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not check your account. Please try again later.');
  expect(screen.queryByRole('heading', { name: 'Player not found' })).not.toBeInTheDocument();
  expect(from).not.toHaveBeenCalled();
});

it('shows a distinct missing-player state with a directory link', async () => {
  profileResult = { data: null, error: null };
  render(<ProfilePage />);
  await screen.findByRole('heading', { name: 'Player not found' });
  expect(screen.getByRole('status')).toHaveTextContent('No player profile exists at this link.');
  expect(screen.getByRole('link', { name: 'Browse all profiles' })).toHaveAttribute('href', '/profiles');
  expect(screen.queryByText('Could not load profile.')).not.toBeInTheDocument();
});

it('keeps a failed profile request separate from a missing player', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  profileResult = { data: null, error: { message: 'synthetic request failure' } };
  render(<ProfilePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load profile. Please try again later.');
  expect(screen.queryByRole('heading', { name: 'Player not found' })).not.toBeInTheDocument();
});

async function openHistory() {
  render(<ProfilePage />);
  await screen.findByRole('heading', { name: 'Test player' });
  fireEvent.click(screen.getByRole('button', { name: 'All Matches' }));
  await waitFor(() => expect(requests).toHaveLength(1));
}
async function finish(index: number, data: Result['data'], count = data?.length ?? 0, error: Result['error'] = null) {
  await act(async () => { requests[index].resolve({ data, count, error }); });
}

it('filters recent matches immediately without requesting paginated history', async () => {
  render(<ProfilePage />);
  await screen.findByText('Notes: Recent win');
  fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'Cricket' } });
  expect(screen.queryByText('Notes: Recent win')).not.toBeInTheDocument();
  expect(screen.getByText('Notes: Recent loss')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'wins' } });
  expect(screen.getByText('No recent matches found for this player.')).toBeInTheDocument();
  expect(requests).toHaveLength(0);
});

it('keeps an unresolved tie out of the recent losses filter', async () => {
  render(<ProfilePage />);
  await screen.findByText('Notes: Unresolved tie');
  fireEvent.change(screen.getByLabelText('Result'), {target:{value:'losses'}});
  expect(screen.getByText('Notes: Recent loss')).toBeInTheDocument();
  expect(screen.queryByText('Notes: Unresolved tie')).not.toBeInTheDocument();
});

it('keeps settled history while paging and sends filters before resetting to page one', async () => {
  await openHistory();
  expect(screen.getByText('Loading matches...')).toBeInTheDocument();
  await finish(0, [match(10, 'Page one')], 21);
  expect(requests[0].range).toEqual([0, 9]);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Notes: Page one')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1].range).toEqual([10, 19]);
  await finish(1, [match(20, 'Page two')], 21);
  expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'Cricket' } });
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(requests[2].range).toEqual([0, 9]);
  expect(requests[2].filters).toContainEqual(['game_type', 'Cricket']);
  expect(screen.getByText('Notes: Page two')).toBeInTheDocument();
  await finish(2, [match(30, 'Filtered cricket', 'Cricket')]);
  expect(screen.queryByText('Notes: Page two')).not.toBeInTheDocument();
  expect(screen.getByText('Notes: Filtered cricket')).toBeInTheDocument();
  expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
});

it('ignores an obsolete response after a result filter changes', async () => {
  await openHistory();
  fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'losses' } });
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1].filters).toContainEqual(['match_players.is_winner', false]);
  expect(requests[1].filters).toContainEqual(['or', 'game_config.is.null,game_config->>status.eq.completed']);
  await finish(1, [match(40, 'Current loss', '501', false)]);
  await finish(0, [match(41, 'Obsolete win')], 30);
  expect(screen.getByText('Notes: Current loss')).toBeInTheDocument();
  expect(screen.queryByText('Notes: Obsolete win')).not.toBeInTheDocument();
  expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
});

it('settles empty results and recovers from a history error on retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await openHistory();
  await finish(0, null, 0, { message: 'synthetic failure' });
  expect(screen.getByText('Could not load match history.')).toBeInTheDocument();
  expect(screen.queryByText('Loading matches...')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Last 5 Matches' }));
  fireEvent.click(screen.getByRole('button', { name: 'All Matches' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  await finish(1, []);
  expect(screen.getByText('No matches found for this player.')).toBeInTheDocument();
  expect(screen.queryByText('Could not load match history.')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
});

it('shows an unavailable score as a dash while keeping a recorded zero', async () => {
  await openHistory();
  await finish(0, [
    match(50, 'Missing score', '501', true, null, null),
    match(51, 'Recorded zero', '501', false, null, 0),
  ]);

  expect(screen.getByText('Notes: Missing score').closest('.player-match-card'))
    .toHaveTextContent('3DA: —');
  expect(screen.getByText('Notes: Recorded zero').closest('.player-match-card'))
    .toHaveTextContent('3DA: 0');
});
