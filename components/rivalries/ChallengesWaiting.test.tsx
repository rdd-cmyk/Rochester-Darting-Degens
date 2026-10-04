import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import type { Challenge, RivalryFeed } from '@/lib/rivalries/types';
const mocks = vi.hoisted(() => ({ userId: 'a' as string | null, feed: vi.fn() }));
vi.mock('@/lib/league-night/use-current-user', () => ({ useCurrentUser: () => ({ user: mocks.userId ? { id: mocks.userId } : null }) }));
vi.mock('@/lib/rivalries/api', () => ({ loadRivalryFeed: mocks.feed }));
import { ChallengesWaiting } from './ChallengesWaiting';
const feed = (challenges: Partial<Challenge>[] = []) => ({ challenges } as RivalryFeed);
beforeEach(() => { mocks.userId = 'a'; mocks.feed.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('counts only pending incoming challenges and links directly to the single challenge', async () => {
  mocks.feed.mockResolvedValue(feed([
    { id: 'incoming', recipient: 'a', sender: 'b', state: 'pending' },
    { id: 'outgoing', recipient: 'b', sender: 'a', state: 'pending' },
    { id: 'completed', recipient: 'a', sender: 'b', state: 'completed' },
  ]));
  render(<ChallengesWaiting />);
  expect(await screen.findByRole('heading', { name: 'A challenge is waiting for you' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review challenge' })).toHaveAttribute('href', '/rivalries/challenges/incoming');
});
it('links multiple challenges to the room and refreshes when the window gains focus', async () => {
  mocks.feed.mockResolvedValueOnce(feed([{ id: 'one', recipient: 'a', state: 'pending' }, { id: 'two', recipient: 'a', state: 'pending' }])).mockResolvedValue(feed());
  render(<ChallengesWaiting />);
  expect(await screen.findByRole('heading', { name: '2 challenges are waiting for you' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review challenges' })).toHaveAttribute('href', '/rivalries');
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Challenges waiting' })).not.toBeInTheDocument());
});
it('hides an empty panel and does not load for a signed-out visitor', async () => {
  mocks.feed.mockResolvedValue(feed());
  const view = render(<ChallengesWaiting />);
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Challenges waiting' })).not.toBeInTheDocument());
  view.unmount();
  mocks.feed.mockClear(); mocks.userId = null;
  render(<ChallengesWaiting />);
  expect(mocks.feed).not.toHaveBeenCalled();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
it('distinguishes a failed read from an empty inbox and supports retry', async () => {
  mocks.feed.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(feed([{ id: 'retry', recipient: 'a', state: 'pending' }]));
  render(<ChallengesWaiting />);
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be checked');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: 'Review challenge' })).toHaveAttribute('href', '/rivalries/challenges/retry');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('discards an old account response after switching accounts', async () => {
  let resolveOld!: (value: RivalryFeed) => void;
  mocks.feed.mockReturnValueOnce(new Promise<RivalryFeed>(resolve => { resolveOld = resolve; })).mockResolvedValue(feed([{ id: 'new-account', recipient: 'b', state: 'pending' }]));
  const view = render(<ChallengesWaiting />);
  mocks.userId = 'b'; view.rerender(<ChallengesWaiting />);
  expect(await screen.findByRole('link', { name: 'Review challenge' })).toHaveAttribute('href', '/rivalries/challenges/new-account');
  await act(async () => resolveOld(feed([{ id: 'old-account', recipient: 'a', state: 'pending' }])));
  expect(screen.getByRole('link', { name: 'Review challenge' })).toHaveAttribute('href', '/rivalries/challenges/new-account');
  mocks.userId = null; view.rerender(<ChallengesWaiting />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
it('shows a slow successful read without a polling tick discarding it, then resumes polling', async () => {
  vi.useFakeTimers();
  const reads: ((value: RivalryFeed) => void)[] = [];
  mocks.feed.mockImplementation(() => new Promise<RivalryFeed>(resolve => reads.push(resolve)));
  render(<ChallengesWaiting />);
  await act(async () => { vi.advanceTimersByTime(25000); });
  await act(async () => reads[0](feed([{ id: 'slow-read', recipient: 'a', state: 'pending' }])));
  expect(screen.getByRole('link', { name: 'Review challenge' })).toHaveAttribute('href', '/rivalries/challenges/slow-read');
  expect(mocks.feed).toHaveBeenCalledTimes(1);
  await act(async () => { vi.advanceTimersByTime(15000); });
  expect(mocks.feed).toHaveBeenCalledTimes(2);
  await act(async () => reads[1](feed()));
  expect(screen.queryByRole('region', { name: 'Challenges waiting' })).not.toBeInTheDocument();
});
it('starts a fresh read after Strict Mode cleanup and ignores the abandoned read', async () => {
  let resolveOld!: (value: RivalryFeed) => void;
  let resolveCurrent!: (value: RivalryFeed) => void;
  mocks.feed.mockReturnValueOnce(new Promise<RivalryFeed>(resolve => { resolveOld = resolve; }))
    .mockReturnValueOnce(new Promise<RivalryFeed>(resolve => { resolveCurrent = resolve; }));
  render(<StrictMode><ChallengesWaiting /></StrictMode>);
  expect(mocks.feed).toHaveBeenCalledTimes(2);
  await act(async () => resolveOld(feed([{ id: 'abandoned', recipient: 'a', state: 'pending' }])));
  fireEvent.focus(window);
  expect(mocks.feed).toHaveBeenCalledTimes(2);
  await act(async () => resolveCurrent(feed([{ id: 'current', recipient: 'a', state: 'pending' }])));
  expect(screen.getByRole('link', { name: 'Review challenge' })).toHaveAttribute('href', '/rivalries/challenges/current');
});
