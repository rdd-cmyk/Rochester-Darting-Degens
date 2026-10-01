import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MatchesPage from './page';

const { from, rpc, identity, nightRead } = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(), nightRead: vi.fn(),
  identity: { user: { id: '11111111-1111-4111-8111-111111111111', email: 'member@example.test' } as { id: string; email: string } | null },
}));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from, rpc } }));
vi.mock('@/lib/league-night/use-current-user', () => ({ useCurrentUser: () => ({ user: identity.user, loading: false }) }));

const players = ['1', '2', '3', '4'].map((digit, index) => ({
  id: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`,
  display_name: `Member ${index + 1}`, first_name: null, include_first_name_in_display: false,
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  identity.user = { id: players[0].id, email: 'member@example.test' };
  nightRead.mockResolvedValue({ data: [], error: null, count: 0 });
  from.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn(function(this: unknown) { return table === 'profiles' ? Promise.resolve({ data: players, error: null }) : this; }),
    range: vi.fn(() => table === 'league_nights' ? nightRead() : Promise.resolve({ data: [], error: null, count: 0 })),
    limit: vi.fn(() => nightRead()),
  }));
  rpc.mockResolvedValue({ data: { status: 'saved', match_id: 42, replayed: false }, error: null });
});
afterEach(() => localStorage.clear());

async function open() {
  const view = render(<MatchesPage />);
  await screen.findByRole('heading', { name: 'Match archive' });
  fireEvent.click(screen.getByRole('button', { name: 'Record a standalone match' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue with standalone' }));
  await screen.findByRole('heading', { name: 'Record a standalone match' });
  return view;
}

it('opens the archive first and makes standalone recording an explicit choice', async () => {
  render(<MatchesPage />);
  await screen.findByRole('heading', { name: 'Match archive' });
  expect(screen.queryByRole('button', { name: 'Save match' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Record through League Night' })).toHaveAttribute('href', '/');
  fireEvent.click(screen.getByRole('button', { name: 'Record a standalone match' }));
  expect(screen.getByRole('link', { name: 'Choose a league night' })).toHaveAttribute('href', '/');
  expect(screen.queryByRole('button', { name: 'Save match' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue with standalone' }));
  expect(screen.getByRole('button', { name: 'Save match' })).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});
function selectPlayer(index: number) {
  fireEvent.change(screen.getByLabelText(`Player ${index + 1}`, { exact: true }), { target: { value: players[index].id } });
}
function individual() {
  selectPlayer(0); selectPlayer(1);
  fireEvent.change(screen.getByLabelText('Player 1 3DA'), { target: { value: '60' } });
  fireEvent.change(screen.getByLabelText('Player 2 3DA'), { target: { value: '55' } });
  fireEvent.change(screen.getByLabelText('Winner', { exact: true }), { target: { value: players[0].id } });
}

it('keeps guest match access sign-in only', () => {
  identity.user = null;
  render(<MatchesPage />);
  expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/auth');
  expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
  expect(from).not.toHaveBeenCalled();
});

it('locks the submitted form and retries an uncertain atomic save with the same operation and payload', async () => {
  let finish!: (value: unknown) => void;
  rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await open(); individual();
  fireEvent.click(screen.getByRole('button', { name: 'Save match' }));
  await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
  expect(rpc.mock.calls[0][0]).toBe('rdd_save_match');
  const submitted = rpc.mock.calls[0][1];
  expect(submitted.p_payload.submitted_by).toBe(players[0].id);
  expect(screen.getByLabelText('Game type')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Checking save…' })).toBeDisabled();
  expect(localStorage.length).toBe(1);
  await act(async () => finish({ data: null, error: { message: 'The response was interrupted.' } }));
  expect(screen.getByLabelText('Player 1 3DA')).toHaveValue(60);
  expect(screen.getByLabelText('Game type')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Check / retry save' }));
  await screen.findByText('✓ Saved match #42.');
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[1][1]).toEqual(submitted);
  expect(screen.getByLabelText('Game type')).toBeEnabled();
  expect(localStorage.length).toBe(0);
});

it('keeps a 2v2 shared score out of personal scores and sends both winning teammates', async () => {
  await open();
  fireEvent.change(screen.getByLabelText('Game type'), { target: { value: 'Count-Up' } });
  fireEvent.change(screen.getByLabelText('Match format'), { target: { value: '2v2' } });
  expect(screen.getByLabelText('Number of players')).toHaveValue('4');
  expect(screen.getByLabelText('Number of players')).toBeDisabled();
  for (let index = 0; index < 4; index++) selectPlayer(index);
  for (let index = 0; index < 4; index++) {
    fireEvent.change(screen.getByLabelText(`Member ${index + 1} team`), { target: { value: index < 2 ? 'A' : 'B' } });
  }
  fireEvent.change(screen.getByLabelText('Team A score'), { target: { value: '400' } });
  fireEvent.change(screen.getByLabelText('Team B score'), { target: { value: '350' } });
  fireEvent.change(screen.getByLabelText('Winning team'), { target: { value: 'A' } });
  expect(screen.getByLabelText('Winner', { exact: true })).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Save match' }));
  await screen.findByText('✓ Saved match #42.');
  const payload = rpc.mock.calls[0][1].p_payload;
  expect(payload.game_config.format).toBe('2v2');
  expect(payload.game_config.teamScores).toEqual({ A: 400, B: 350 });
  expect(payload.players.map((player: { score: number | null; is_winner: boolean }) => [player.score, player.is_winner]))
    .toEqual([[null, true], [null, true], [null, false], [null, false]]);
});

it.each(['42501', 'PGRST202'])('retains a dispatched ordinary save after reload when its retry cannot check the receipt (%s)', async code => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'The response was interrupted.' } });
  rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'Access or the endpoint is temporarily unavailable.' } });
  const view = await open(); individual();
  fireEvent.click(screen.getByRole('button', { name: 'Save match' }));
  await screen.findByRole('button', { name: 'Check / retry save' });
  const original = rpc.mock.calls[0][1];
  view.unmount();
  await open();
  fireEvent.click(await screen.findByRole('button', { name: 'Check / retry save' }));
  await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'Check / retry save' })).toBeInTheDocument();
  expect(screen.getByLabelText('Game type')).toBeDisabled();
  expect(localStorage.length).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Check / retry save' }));
  await screen.findByText('✓ Saved match #42.');
  expect(rpc.mock.calls[1][1]).toEqual(original);
  expect(rpc.mock.calls[2][1]).toEqual(original);
  expect(localStorage.length).toBe(0);
});


it('retries failed night choices when the archive is refreshed', async () => {
  nightRead.mockResolvedValueOnce({ data: null, error: { message: 'Offline' }, count: null });
  nightRead.mockResolvedValueOnce({ data: [{ id: 'older-night', title: 'Older night', night_date: '2026-01-01' }], error: null, count: 1 });
  render(<MatchesPage />);
  await screen.findByText(/Night choices could not be loaded/);
  fireEvent.click(screen.getByRole('button', { name: /^Refresh$/ }));
  await waitFor(() => expect(nightRead).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole('option', { name: 'Older night · 2026-01-01' })).toBeInTheDocument();
  expect(screen.queryByText(/Night choices could not be loaded/)).not.toBeInTheDocument();
});
