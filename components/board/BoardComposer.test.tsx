import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
