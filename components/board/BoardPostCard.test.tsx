import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import BoardPostCard from './BoardPostCard';
import type { BoardPost, BoardReply } from '@/lib/board';

const mocks = vi.hoisted(() => ({ thread: vi.fn(), reply: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/board', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/board')>()), boardThread: mocks.thread, boardReply: mocks.reply, boardWrite: mocks.write }));
const profile = { display_name: 'Player', first_name: null, include_first_name_in_display: false };
const post: BoardPost = { id: 'post', author_id: 'member', profile, body: 'Practice plans', topic: 'practice', created_at: '2026-09-26T10:00:00Z', updated_at: '2026-09-26T10:00:00Z', last_activity: '2026-09-26T12:00:00Z', pinned: false, locked: false, reply_count: 33, reaction_count: 0, reacted: false };
const makeReply = (number: number): BoardReply => ({ id: `reply-${number}`, post_id: 'post', author_id: 'member', profile, body: `Reply number ${number}`, created_at: new Date(Date.UTC(2026, 8, 26, 10, number)).toISOString(), updated_at: new Date(Date.UTC(2026, 8, 26, 10, number)).toISOString() });
let rows: BoardReply[];
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  rows = Array.from({ length: 33 }, (_, i) => makeReply(i + 1));
  mocks.thread.mockImplementation(async (_id: string, after?: BoardReply) => rows.filter(row => !after || row.created_at > after.created_at).slice(0, 30));
  mocks.reply.mockImplementation(async (id: string) => { const row = rows.find(reply => reply.id === id); if (!row) throw { code: 'PGRST116' }; return row; });
  mocks.write.mockImplementation(async (_action, _target, body, _topic, id) => { rows.push({ ...makeReply(34), id, body }); return id; });
});

it('preserves the loaded reply pages and saved reply when the parent refreshes', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<BoardPostCard post={post} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await screen.findByText('Reply number 30');
  fireEvent.click(screen.getByRole('button', { name: 'Load more replies' }));
  await screen.findByText('Reply number 33');
  fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'Newest saved reply' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  rerender(<BoardPostCard post={{ ...post, reply_count: 34 }} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await waitFor(() => expect(mocks.thread).toHaveBeenCalledTimes(4));
  expect(screen.getByText('Reply number 33')).toBeVisible();
  expect(screen.getByText('Newest saved reply')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Load more replies' })).not.toBeInTheDocument();
  // Revalidation also replaces stale bodies and removes hidden/deleted rows.
  rows = rows.filter(row => row.id !== 'reply-32').map(row => row.id === 'reply-33' ? { ...row, body: 'Edited reply 33' } : row);
  rerender(<BoardPostCard post={{ ...post, reply_count: 33 }} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await screen.findByText('Edited reply 33');
  expect(screen.queryByText('Reply number 32')).not.toBeInTheDocument();
  expect(screen.getByText('Newest saved reply')).toBeVisible();
});

it('shows a saved reply beyond unopened pages and removes it if later hidden', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<BoardPostCard post={post} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await screen.findByText('Reply number 30');
  fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'Saved beyond the first page' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  rerender(<BoardPostCard post={{ ...post, reply_count: 34 }} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await waitFor(() => expect(mocks.reply).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Saved beyond the first page')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Load more replies' })).toBeVisible();
  rows = rows.filter(row => row.body !== 'Saved beyond the first page');
  rerender(<BoardPostCard post={{ ...post }} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await waitFor(() => expect(screen.queryByText('Saved beyond the first page')).not.toBeInTheDocument());
  expect(screen.getByText('Reply number 30')).toBeVisible();
});

it.each(['refresh', 'load more', 'recent reply read'])('keeps loaded and confirmed recent replies after a failed %s, then revalidates on retry', async action => {
  const onChange = vi.fn();
  const { rerender } = render(<BoardPostCard post={post} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await screen.findByText('Reply number 30');
  fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'Confirmed recent reply' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(screen.getByText('Confirmed recent reply')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'Unfinished next reply' } });
  if (action === 'recent reply read') mocks.reply.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  else mocks.thread.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  if (action === 'load more') fireEvent.click(screen.getByRole('button', { name: 'Load more replies' }));
  else rerender(<BoardPostCard post={{ ...post, reply_count: 34 }} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await screen.findByRole('alert');
  expect(screen.getByText('Reply number 30')).toBeVisible();
  expect(screen.getByText('Confirmed recent reply')).toBeVisible();
  expect(screen.getByLabelText('Your reply')).toHaveValue('Unfinished next reply');
  rows = rows.filter(row => row.id !== 'reply-1' && row.body !== 'Confirmed recent reply').map(row => row.id === 'reply-30' ? { ...row, body: 'Updated reply after retry' } : row);
  fireEvent.click(screen.getByRole('button', { name: 'Retry replies' }));
  expect(await screen.findByText('Updated reply after retry')).toBeVisible();
  expect(screen.queryByText('Reply number 1', { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText('Confirmed recent reply')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Your reply')).toHaveValue('Unfinished next reply');
});

it.each([{ code: '42501' }, { code: 'PGRST301' }, { code: 'PGRST302' }, { code: 'PGRST303' }, { status: 401 }, { status: 403 }])('clears loaded and recent replies after access error %j', async failure => {
  const onChange = vi.fn();
  const { rerender } = render(<BoardPostCard post={post} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await screen.findByText('Reply number 30');
  fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'Confirmed recent reply' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(screen.getByText('Confirmed recent reply')).toBeVisible();
  mocks.thread.mockRejectedValueOnce(failure);
  rerender(<BoardPostCard post={{ ...post, reply_count: 34 }} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your access changed');
  expect(screen.queryByText('Reply number 30')).not.toBeInTheDocument();
  expect(screen.queryByText('Confirmed recent reply')).not.toBeInTheDocument();
});

it('clears replies when concurrent recent reads include an access denial and a network failure', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<BoardPostCard post={post} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await screen.findByText('Reply number 30');
  for (const body of ['First confirmed recent reply', 'Second confirmed recent reply']) {
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: body } });
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));
    await screen.findByText(body);
    await waitFor(() => expect(screen.getByLabelText('Your reply')).toBeEnabled());
  }
  const firstId = rows.find(row => row.body === 'First confirmed recent reply')!.id;
  mocks.reply.mockImplementation(async (id: string) => { throw id === firstId ? new TypeError('Failed to fetch') : { status: 403 }; });
  rerender(<BoardPostCard post={{ ...post, reply_count: 35 }} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your access changed');
  expect(screen.queryByText('Reply number 30')).not.toBeInTheDocument();
  expect(screen.queryByText('First confirmed recent reply')).not.toBeInTheDocument();
  expect(screen.queryByText('Second confirmed recent reply')).not.toBeInTheDocument();
});

it('clears cached replies when the server says the conversation is unavailable', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<BoardPostCard post={post} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  await screen.findByText('Reply number 30');
  fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'Confirmed recent reply' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  mocks.thread.mockRejectedValueOnce({ code: 'P0002' });
  rerender(<BoardPostCard post={{ ...post, reply_count: 34 }} userId="member" organizer={false} initiallyOpen onChange={onChange} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('no longer available');
  expect(screen.queryByText('Reply number 30')).not.toBeInTheDocument();
  expect(screen.queryByText('Confirmed recent reply')).not.toBeInTheDocument();
});
