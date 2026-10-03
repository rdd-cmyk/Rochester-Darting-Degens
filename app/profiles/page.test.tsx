import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import AllProfilesPage from './page';

const supabaseMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
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

const captain = {
  id: 'captain',
  display_name: 'Demo captain',
  first_name: 'Demo',
  last_name: 'Captain',
  include_first_name_in_display: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  supabaseMock.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: supabaseMock.unsubscribe } },
  });
  supabaseMock.from.mockReturnValue({ select: supabaseMock.select });
  supabaseMock.getUser.mockResolvedValue({ data: { user: { id: 'viewer' } }, error: null });
  supabaseMock.select.mockResolvedValue({ data: [captain], error: null });
});

it('distinguishes a failed account check from being signed out and recovers on retry', async () => {
  supabaseMock.getUser.mockRejectedValueOnce(new Error('Account service unavailable'));

  render(<AllProfilesPage />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not check your account.');
  expect(screen.queryByText('Sign in to browse player profiles.')).not.toBeInTheDocument();
  expect(supabaseMock.from).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('link', { name: /Demo captain/ })).toHaveAttribute('href', '/profiles/captain');
});

it.each(['response error', 'rejected request'])('retains the search and retries a %s', async (failure) => {
  if (failure === 'response error') {
    supabaseMock.select.mockResolvedValueOnce({ data: null, error: new Error('Read failed') });
  } else {
    supabaseMock.select.mockRejectedValueOnce(new Error('Network failed'));
  }

  render(<AllProfilesPage />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the lineup.');
  expect(screen.queryByText('No players match that search.')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search players' }), { target: { value: 'capt' } });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByRole('link', { name: /Demo captain/ })).toBeInTheDocument();
  expect(screen.getByRole('searchbox', { name: 'Search players' })).toHaveValue('capt');
  await waitFor(() => expect(supabaseMock.select).toHaveBeenCalledTimes(2));
});

it('distinguishes an empty directory from a search with no matches', async () => {
  let resolveProfiles!: (result: { data: typeof captain[]; error: null }) => void;
  supabaseMock.select.mockReturnValueOnce(new Promise((resolve) => {
    resolveProfiles = resolve;
  }));

  render(<AllProfilesPage />);

  await waitFor(() => expect(supabaseMock.select).toHaveBeenCalledOnce());
  expect(screen.getByRole('status')).toHaveTextContent('Loading the lineup…');
  expect(screen.queryByText('No player profiles are available yet.')).not.toBeInTheDocument();

  resolveProfiles({ data: [], error: null });
  expect(await screen.findByText('No player profiles are available yet.')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search players' }), { target: { value: 'capt' } });
  expect(screen.getByText('No players match that search. Try a shorter name.')).toBeInTheDocument();
});
