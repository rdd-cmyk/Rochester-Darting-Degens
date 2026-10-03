import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import BoardComposer from './BoardComposer';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
beforeEach(() => sessionStorage.clear());

it('preserves failed drafts and reuses their request ID on retry, then clears on success', async () => {
  const submit = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const { unmount } = render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'Practice Thursday?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('draft is kept');
  const requestId = submit.mock.calls[0][2];
  unmount();
  render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" onSubmit={submit} />);
  expect(screen.getByLabelText('Your post')).toHaveValue('Practice Thursday?');
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  await waitFor(() => expect(screen.getByLabelText('Your post')).toHaveValue(''));
  expect(submit.mock.calls[1][2]).toBe(requestId);
  expect(sessionStorage.getItem('member:post')).toBeNull();
});
it('starter chips do not overwrite existing writing and another member does not inherit the draft', () => {
  const { unmount } = render(<BoardComposer draftKey="member-one:post" label="Your post" submitLabel="Post" starters onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Who’s throwing?' }));
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'My unfinished thought' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find a sub' }));
  expect(screen.getByLabelText('Your post')).toHaveValue('My unfinished thought');
  unmount();
  render(<BoardComposer draftKey="member-two:post" label="Your post" submitLabel="Post" onSubmit={vi.fn()} />);
  expect(screen.getByLabelText('Your post')).toHaveValue('');
});
it('does not send whitespace-only contributions', () => {
  const submit = vi.fn();
  render(<BoardComposer draftKey="member:reply" label="Reply" submitLabel="Post" onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Reply'), { target: { value: '   ' } });
  expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
  expect(submit).not.toHaveBeenCalled();
});

it('keeps a revised draft after an ambiguous save and only changes the ID by explicit choice', async () => {
  const submit = vi.fn().mockRejectedValueOnce(new Error('lost response')).mockRejectedValueOnce({ code: 'PT409' }).mockResolvedValue(undefined);
  render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'Original attempt' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  await screen.findByRole('alert');
  const originalId = submit.mock.calls[0][2];
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'Revised after the failed response' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your revised draft is kept');
  expect(screen.getByLabelText('Your post')).toHaveValue('Revised after the failed response');
  expect(screen.getByRole('link', { name: 'Open saved conversation' })).toHaveAttribute('href', `/board/${originalId}`);
  expect(JSON.parse(sessionStorage.getItem('member:post')!).body).toBe('Revised after the failed response');
  expect(submit.mock.calls[1][2]).toBe(originalId);
  expect(screen.queryByText('Saved to the league.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use draft for a separate contribution' }));
  expect(submit).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  await screen.findByText('Saved to the league.');
  expect(submit.mock.calls[2][2]).not.toBe(originalId);
  expect(submit.mock.calls[2][0]).toBe('Revised after the failed response');
});

it('links conflicting reply retries to their parent conversation', async () => {
  render(<BoardComposer draftKey="member:reply" conversationId="parent-id" label="Reply" submitLabel="Post" onSubmit={vi.fn().mockRejectedValue({ code: 'PT409' })} />);
  fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'My revised reply' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  expect(await screen.findByRole('link', { name: 'Open saved conversation' })).toHaveAttribute('href', '/board/parent-id');
});

it('does not let a save from an unmounted composer erase a revised remounted draft', async () => {
  let finishSave!: () => void;
  const submit = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
  const { unmount } = render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'First pending attempt' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  expect(submit).toHaveBeenCalledOnce();
  unmount();
  render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" onSubmit={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'Revised after returning to the board' } });
  await act(async () => { finishSave(); });
  expect(screen.getByLabelText('Your post')).toHaveValue('Revised after returning to the board');
  expect(JSON.parse(sessionStorage.getItem('member:post')!).body).toBe('Revised after returning to the board');
});

it('clears only the stored version of the draft confirmed by its own save', async () => {
  let finishSave!: () => void;
  const submit = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
  render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'Pending contribution' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  const stored = JSON.parse(sessionStorage.getItem('member:post')!);
  sessionStorage.setItem('member:post', JSON.stringify({ ...stored, body: 'Newer stored writing' }));
  await act(async () => { finishSave(); });
  expect(screen.getByText('Saved to the league.')).toBeVisible();
  expect(JSON.parse(sessionStorage.getItem('member:post')!).body).toBe('Newer stored writing');
});

it('clears a confirmed unchanged draft even if its composer was unmounted', async () => {
  let finishSave!: () => void;
  const submit = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
  const { unmount } = render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'Saved while away' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post' }));
  unmount();
  await act(async () => { finishSave(); });
  expect(sessionStorage.getItem('member:post')).toBeNull();
});

it('keeps and resumes a draft in the same browser tab without posting', () => {
  const submit = vi.fn();
  const view = render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" starters onSubmit={submit} />);
  fireEvent.click(screen.getByRole('button', { name: 'What’s happening, Degens?' }));
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value:'My draft for later' } });
  fireEvent.click(screen.getByRole('button', { name:'Keep draft for later' }));
  expect(screen.getByText(/Draft kept in this browser tab/)).toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name:'Resume saved draft' }));
  expect(screen.getByLabelText('Your post')).toHaveValue('My draft for later');
  view.unmount();
  render(<BoardComposer draftKey="member:post" label="Your post" submitLabel="Post" starters onSubmit={submit} />);
  expect(screen.getByLabelText('Your post')).toHaveValue('My draft for later');
});
