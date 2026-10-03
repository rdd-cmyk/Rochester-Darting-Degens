import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import LeagueBoard from './LeagueBoard';
import BoardPreview from './BoardPreview';
import type { BoardPost } from '@/lib/board';

const mocks = vi.hoisted(() => ({ access: { loading:false, user:null, member:null, error:null, refresh:vi.fn() } as Record<string, unknown>, feed:vi.fn(), write:vi.fn(), thread:vi.fn() }));
vi.mock('./useBoardAccess', () => ({ useBoardAccess: () => mocks.access }));
vi.mock('@/lib/board', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/board')>()), boardFeed:mocks.feed, boardWrite:mocks.write, boardThread:mocks.thread }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.access = { loading:false,user:null,member:null,error:null,refresh:vi.fn() };
  mocks.feed.mockResolvedValue([]); mocks.write.mockResolvedValue('id'); mocks.thread.mockResolvedValue([]);
});
it('does not request private content while signed out, pending, or revoked', async () => {
  const { rerender } = render(<LeagueBoard />);
  expect(screen.getByRole('link',{name:'Sign in to the board'})).toHaveAttribute('href','/auth?next=%2Fboard');
  mocks.access.user = {id:'member'}; mocks.access.member = {status:'pending',role:'member'};
  rerender(<LeagueBoard />);
  expect(screen.getByText('Your request is with the organizers.')).toBeVisible();
  mocks.access.member = {status:'revoked',role:'member'};
  rerender(<LeagueBoard />);
  expect(screen.getByText('Your board access is paused.')).toBeVisible();
  expect(mocks.feed).not.toHaveBeenCalled();
});
it('requests organizer approval without opening the feed', async () => {
  mocks.access.user = {id:'member'};
  render(<LeagueBoard />);
  fireEvent.click(screen.getByRole('button',{name:'Request board access'}));
  await waitFor(() => expect(mocks.write).toHaveBeenCalledWith('request_access'));
  expect(mocks.feed).not.toHaveBeenCalled();
});
it('distinguishes a failed read from a welcoming empty board', async () => {
  mocks.access.user={id:'member'};mocks.access.member={status:'approved',role:'member'};
  mocks.feed.mockRejectedValue({code:'PGRST202'});
  render(<LeagueBoard />);
  expect(await screen.findByRole('alert')).toHaveTextContent('not ready');
  expect(screen.queryByText('Who’s throwing this week?')).not.toBeInTheDocument();
  mocks.feed.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button',{name:'Refresh'}));
  expect(await screen.findByText('Who’s throwing this week?')).toBeVisible();
});
it('hides private homepage results even if a read completes after sign-out', async () => {
  mocks.access.user={id:'member'};mocks.access.member={status:'approved',role:'member'};
  let complete!: (value: unknown[])=>void;
  mocks.feed.mockReturnValue(new Promise(resolve => {complete=resolve;}));
  const {rerender}=render(<BoardPreview />);
  mocks.access.user=null;mocks.access.member=null;
  rerender(<BoardPreview />);
  await act(async()=>complete([{id:'post',body:'Private conversation',profile:{display_name:'Player'},reply_count:1}]));
  expect(screen.queryByText('Private conversation')).not.toBeInTheDocument();
  expect(screen.queryByText('From the League Board')).not.toBeInTheDocument();
});

function feedPosts(count: number): BoardPost[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `post-${index + 1}`, author_id: 'member', body: `Conversation ${index + 1}`, topic: 'conversation',
    profile: { display_name: `Player ${index + 1}`, first_name: null, include_first_name_in_display: false },
    created_at: new Date(Date.UTC(2026, 8, 28, 10, 30 - index)).toISOString(),
    updated_at: '2026-09-28T10:30:00Z', last_activity: new Date(Date.UTC(2026, 8, 28, 10, 30 - index)).toISOString(),
    pinned: false, locked: false, reply_count: 0, reaction_count: 0, reacted: false,
  }));
}
function mockFeed(posts: BoardPost[]) {
  mocks.feed.mockImplementation(async ({ before, pinned }: { before?: BoardPost; pinned?: boolean }) =>
    pinned ? [] : posts.slice(before ? posts.findIndex(post => post.id === before.id) + 1 : 0).slice(0, 20).map(post => ({ ...post })));
}

it('keeps an open second-page conversation and its draft after a reaction refresh', async () => {
  mocks.access.user = { id: 'member' }; mocks.access.member = { status: 'approved', role: 'member' };
  const posts = feedPosts(21);
  mockFeed(posts);
  mocks.write.mockImplementation(async () => { posts[20].reacted = true; posts[20].reaction_count = 1; return 'post-21'; });
  render(<LeagueBoard />);
  await screen.findByText('Conversation 20');
  fireEvent.click(screen.getByText('Load more conversations', { selector: 'button' }));
  const article = (await screen.findByText('Conversation 21')).closest('article')!;
  fireEvent.click(within(article).getByRole('button', { name: 'Reply' }));
  const draft = within(article).getByLabelText('Your reply');
  fireEvent.change(draft, { target: { value: 'My unfinished second-page reply' } });
  fireEvent.click(within(article).getByRole('button', { name: 'Cheers' }));
  await within(article).findByRole('button', { name: 'Cheers · 1 · You' });
  expect(screen.getByText('Conversation 21')).toBeVisible();
  expect(within(article).getByLabelText('Your reply')).toHaveValue('My unfinished second-page reply');
  expect(within(article).getByRole('button', { name: 'Cheers · 1 · You' })).toBeVisible();
});

it('revalidates loaded feed pages and continues from their refreshed cursor', async () => {
  mocks.access.user = { id: 'member' }; mocks.access.member = { status: 'approved', role: 'member' };
  const posts = feedPosts(41);
  mockFeed(posts);
  const { container } = render(<LeagueBoard />);
  await screen.findByText('Conversation 20');
  fireEvent.click(screen.getByText('Load more conversations', { selector: 'button' }));
  await screen.findByText('Conversation 40');
  posts.splice(4, 1);
  posts.find(post => post.id === 'post-21')!.body = 'Updated second-page conversation';
  fireEvent.click(screen.getByText('Refresh', { selector: 'button' }));
  expect(await screen.findByText('Updated second-page conversation')).toBeVisible();
  expect(screen.queryByText('Conversation 5')).not.toBeInTheDocument();
  expect(screen.queryByText('Conversation 21')).not.toBeInTheDocument();
  expect(screen.getByText('Conversation 41')).toBeVisible();
  fireEvent.click(screen.getByText('Load more conversations', { selector: 'button' }));
  await waitFor(() => expect(screen.queryByText('Load more conversations', { selector: 'button' })).not.toBeInTheDocument());
  expect(container.querySelectorAll('article')).toHaveLength(40);
});

it('retains the oldest open conversation when new activity pushes it beyond the loaded page count', async () => {
  mocks.access.user = { id: 'member' }; mocks.access.member = { status: 'approved', role: 'member' };
  const posts = feedPosts(40);
  mockFeed(posts);
  mocks.write.mockImplementation(async () => { posts.at(-1)!.reacted = true; posts.at(-1)!.reaction_count = 1; return 'post-40'; });
  render(<LeagueBoard />);
  await screen.findByText('Conversation 20');
  fireEvent.click(screen.getByText('Load more conversations', { selector: 'button' }));
  const article = (await screen.findByText('Conversation 40')).closest('article')!;
  fireEvent.click(within(article).getByRole('button', { name: 'Reply' }));
  fireEvent.change(within(article).getByLabelText('Your reply'), { target: { value: 'Oldest loaded conversation draft' } });
  posts.unshift({ ...posts[0], id: 'new-post', body: 'New external conversation', last_activity: '2026-09-28T11:00:00Z' });
  fireEvent.click(within(article).getByRole('button', { name: 'Cheers' }));
  await screen.findByText('New external conversation');
  expect(screen.getByText('Conversation 40')).toBeVisible();
  expect(within(article).getByLabelText('Your reply')).toHaveValue('Oldest loaded conversation draft');
  expect(within(article).getByRole('button', { name: 'Cheers · 1 · You' })).toBeVisible();
});

it.each([
  { name: 'neighboring microseconds', newer: '2026-09-28T11:00:00.123902+00:00', older: '2026-09-28T11:00:00.123901+00:00', newerId: '00000000-0000-4000-a000-000000000039', olderId: 'ffffffff-ffff-4fff-afff-ffffffffff40' },
  { name: 'equal timestamps with descending UUIDs', newer: '2026-09-28T11:00:00.123901+00:00', older: '2026-09-28T11:00:00.123901Z', newerId: 'ffffffff-ffff-4fff-afff-ffffffffff39', olderId: '00000000-0000-4000-a000-000000000040' },
])('retains the loaded boundary with $name after new activity', async ({ newer, older, newerId, olderId }) => {
  mocks.access.user = { id: 'member' }; mocks.access.member = { status: 'approved', role: 'member' };
  const posts = feedPosts(40).map((post, index) => ({ ...post, last_activity: new Date(Date.UTC(2026, 8, 28, 12, 0, -index)).toISOString() }));
  posts[38] = { ...posts[38], last_activity: newer, id: newerId };
  posts[39] = { ...posts[39], last_activity: older, id: olderId };
  mockFeed(posts);
  mocks.write.mockImplementation(async () => { posts.at(-1)!.reacted = true; posts.at(-1)!.reaction_count = 1; return olderId; });
  render(<LeagueBoard />);
  await screen.findByText('Conversation 20');
  fireEvent.click(screen.getByText('Load more conversations', { selector: 'button' }));
  const article = (await screen.findByText('Conversation 40')).closest('article')!;
  fireEvent.click(within(article).getByRole('button', { name: 'Reply' }));
  fireEvent.change(within(article).getByLabelText('Your reply'), { target: { value: 'Keep the precise boundary draft' } });
  posts.unshift({ ...posts[0], id: 'new-post', body: 'New external conversation', last_activity: '2026-09-28T13:00:00Z' });
  fireEvent.click(within(article).getByRole('button', { name: 'Cheers' }));
  await screen.findByText('New external conversation');
  expect(screen.getByText('Conversation 40')).toBeVisible();
  expect(within(article).getByLabelText('Your reply')).toHaveValue('Keep the precise boundary draft');
  expect(within(article).getByRole('button', { name: 'Cheers · 1 · You' })).toBeVisible();
});

it.each(['Refresh', 'Load more conversations'])('keeps loaded conversations, a pin and an open draft after a failed %s, then retries', async action => {
  mocks.access.user = { id: 'member' }; mocks.access.member = { status: 'approved', role: 'member' };
  const posts = feedPosts(21);
  const pinned = { ...feedPosts(1)[0], id: 'pinned', body: 'League announcement', pinned: true };
  mocks.feed.mockImplementation(async ({ before, pinned: pin }: { before?: BoardPost; pinned?: boolean }) =>
    pin ? [pinned] : posts.slice(before ? posts.findIndex(post => post.id === before.id) + 1 : 0).slice(0, 20).map(post => ({ ...post })));
  render(<LeagueBoard />);
  await screen.findByText('Conversation 20');
  const article = screen.getByText('Conversation 1').closest('article')!;
  fireEvent.click(within(article).getByRole('button', { name: 'Reply' }));
  fireEvent.change(within(article).getByLabelText('Your reply'), { target: { value: 'Keep my reply through an outage' } });
  mocks.feed.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  fireEvent.click(screen.getByText(action, { selector: 'button' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Conversation 20')).toBeVisible();
  expect(screen.getByText('League announcement')).toBeVisible();
  expect(within(article).getByLabelText('Your reply')).toHaveValue('Keep my reply through an outage');
  // A successful retry still replaces stale bodies and removes missing posts.
  posts.splice(4, 1);
  posts[0].body = 'Updated conversation after retry';
  fireEvent.click(screen.getByRole('button', { name: 'Retry conversations' }));
  expect(await screen.findByText('Updated conversation after retry')).toBeVisible();
  expect(screen.queryByText('Conversation 5')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(within(article).getByLabelText('Your reply')).toHaveValue('Keep my reply through an outage');
});

it.each([{ code: '42501' }, { code: 'PGRST301' }, { code: 'PGRST302' }, { code: 'PGRST303' }, { status: 401 }, { status: 403 }])('clears cached conversations and the pin after access error %j', async failure => {
  mocks.access.user = { id: 'member' }; mocks.access.member = { status: 'approved', role: 'member' };
  mocks.feed.mockImplementation(async ({ pinned }: { pinned?: boolean }) => pinned ? [{ ...feedPosts(1)[0], id: 'pinned', body: 'Private pin', pinned: true }] : feedPosts(1));
  render(<LeagueBoard />);
  await screen.findByText('Conversation 1');
  mocks.feed.mockRejectedValueOnce(failure);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your access changed');
  expect(screen.queryByText('Conversation 1')).not.toBeInTheDocument();
  expect(screen.queryByText('Private pin')).not.toBeInTheDocument();
});

it('clears private content when a pinned access denial accompanies a feed network failure', async () => {
  mocks.access.user = { id: 'member' }; mocks.access.member = { status: 'approved', role: 'member' };
  mockFeed(feedPosts(1));
  render(<LeagueBoard />);
  await screen.findByText('Conversation 1');
  mocks.feed.mockImplementation(async ({ pinned }: { pinned?: boolean }) => { throw pinned ? { status: 403 } : new TypeError('Failed to fetch'); });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your access changed');
  expect(screen.queryByText('Conversation 1')).not.toBeInTheDocument();
});

it.each(['sign out', 'revoke membership', 'change account'])('clears loaded private content on %s even after a transient read failure', async change => {
  mocks.access.user = { id: 'member' }; mocks.access.member = { status: 'approved', role: 'member' };
  mockFeed(feedPosts(1));
  const { rerender } = render(<LeagueBoard />);
  await screen.findByText('Conversation 1');
  mocks.feed.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByRole('alert');
  if (change === 'sign out') { mocks.access.user = null; mocks.access.member = null; }
  else if (change === 'revoke membership') mocks.access.member = { status: 'revoked', role: 'member' };
  else { mocks.access.user = { id: 'another-member' }; mocks.access.member = { status: 'pending', role: 'member' }; }
  rerender(<LeagueBoard />);
  expect(screen.queryByText('Conversation 1')).not.toBeInTheDocument();
});
