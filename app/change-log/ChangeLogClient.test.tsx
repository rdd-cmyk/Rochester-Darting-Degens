import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ChangeLogClient from './ChangeLogClient';

const { getSession, push, fetchUpdates, onAuthStateChange, unsubscribe } = vi.hoisted(() => ({
  getSession: vi.fn(),
  push: vi.fn(),
  fetchUpdates: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('page=1'),
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getSession, onAuthStateChange } } }));

beforeEach(() => {
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-local-token' } }, error: null });
  vi.stubGlobal('fetch', fetchUpdates);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('renders populated updates and the next-page destination', async () => {
  fetchUpdates.mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({
      pulls: [{ id: 1, title: 'Improved league tables', merged_at: '2026-09-01T12:00:00Z', summary: '**Readable** standings' }],
      hasNextPage: true,
    }),
  });

  render(<ChangeLogClient />);
  expect(await screen.findByRole('heading', { name: 'Improved league tables' })).toBeInTheDocument();
  expect(screen.getByText('Readable').tagName).toBe('STRONG');
  expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/change-log?page=2');
  expect(fetchUpdates).toHaveBeenCalledWith('/api/change-log?page=1', {
    headers: { Authorization: 'Bearer synthetic-local-token' },
  });
});

it('does not suggest another page when an empty result has no next page', async () => {
  fetchUpdates.mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({ pulls: [], hasNextPage: false }),
  });
  render(<ChangeLogClient />);
  expect(await screen.findByText('No merged pull requests found on this page.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
});

it('shows a sign-in path when no session exists', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<ChangeLogClient />);
  expect(await screen.findByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/auth');
  expect(screen.getByRole('main')).toHaveTextContent('Please sign in to view the change log.');
  expect(fetchUpdates).not.toHaveBeenCalled();
});
it('clears another account’s notes on an Auth event and unsubscribes', async () => {
  fetchUpdates.mockResolvedValue({ status: 200, ok: true, json: async () => ({
    pulls: [{ id: 1, title: 'Private prior notes', merged_at: '2026-09-01', summary: null }], hasNextPage: false,
  }) });
  const view = render(<ChangeLogClient />);
  await screen.findByText('Private prior notes');
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  await act(async () => { onAuthStateChange.mock.calls[0][0]('SIGNED_OUT'); });
  expect(screen.queryByText('Private prior notes')).not.toBeInTheDocument();
  await screen.findByRole('link', { name: 'Go to sign in' });
  view.unmount(); expect(unsubscribe).toHaveBeenCalled();
});
it('discards a delayed response from the previous account', async () => {
  let resolve!: (value: unknown) => void;
  fetchUpdates.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<ChangeLogClient />);
  await waitFor(() => expect(fetchUpdates).toHaveBeenCalled());
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  await act(async () => { onAuthStateChange.mock.calls[0][0]('SIGNED_OUT'); });
  await screen.findByRole('link', { name: 'Go to sign in' });
  await act(async () => { resolve({ status: 200, ok: true, json: async () => ({ pulls: [{ id: 1, title: 'Late private notes', merged_at: '2026-09-01', summary: null }], hasNextPage: true }) }); });
  expect(screen.queryByText('Late private notes')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
});

it('shows a request error when the session check fails', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: new Error('synthetic session failure') });
  render(<ChangeLogClient />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load change log right now.');
  expect(screen.getByRole('main')).not.toHaveTextContent('Please sign in to view the change log.');
});

it('settles a rejected update request instead of loading indefinitely', async () => {
  fetchUpdates.mockRejectedValue(new Error('synthetic network failure'));
  render(<ChangeLogClient />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load change log right now.');
  await waitFor(() => expect(screen.queryByText('Loading change log...')).not.toBeInTheDocument());
});
