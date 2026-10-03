import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { InviteRequestError } from '@/lib/invites/client';
import InvitesPage from './page';
const request = vi.hoisted(() => vi.fn());
type Session = { user: { id: string } } | null;
const auth = vi.hoisted(() => ({ change: undefined as undefined | ((event: string, session: Session) => void) }));
vi.mock('@/lib/invites/client', async (original) => ({ ...(await original<typeof import('@/lib/invites/client')>()), inviteRequest: request }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { onAuthStateChange: (change: (event: string, session: Session) => void) => {
  auth.change = change;
  queueMicrotask(() => { if (auth.change === change) change('INITIAL_SESSION', { user: { id: 'sender' } }); });
  return { data: { subscription: { unsubscribe: () => { auth.change = undefined; } } } };
} } } }));
const empty = { items: [], total: 0, pending: 0, accepted: 0 };
beforeEach(() => { request.mockReset(); request.mockResolvedValue(empty); auth.change = undefined; });
it('shows a useful empty state and sends the entered address', async () => {
  render(<InvitesPage />);
  await screen.findByText('Invite someone to join your next league night.');
  request.mockImplementation(body => Promise.resolve(body.action === 'list' ? empty : { message: 'Invitation sent.' }));
  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'synthetic@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  await screen.findByText('Invitation sent.');
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', email: 'synthetic@example.test', requestId: expect.any(String) }));
});
it('retries an uncertain send with the original UUID and payload', async () => {
  render(<InvitesPage />);
  await screen.findByText('Invite someone to join your next league night.');
  request.mockRejectedValueOnce(new Error('Connection lost.'));
  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'synthetic@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  await screen.findByText('Connection lost.');
  const original = request.mock.calls.at(-1)?.[0];
  expect(screen.getByLabelText('Their email address')).toBeDisabled();
  request.mockResolvedValueOnce({ message: 'Request already recorded.' });
  fireEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
  await screen.findByText('Request already recorded.');
  expect(request.mock.calls.filter(([body]) => body.action === 'create').map(([body]) => body)).toEqual([original, original]);
});
it('clears private history when access is lost', async () => {
  request.mockResolvedValueOnce({ ...empty, total: 1, pending: 1, items: [{ id: 'synthetic', email: 'private@example.test', status: 'pending', delivery: 'sent', created_at: '2026-09-27', expires_at: '2026-10-04' }] });
  render(<InvitesPage />);
  await screen.findByText('private@example.test');
  request.mockRejectedValueOnce(new Error('Membership required.'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.queryByText('private@example.test')).not.toBeInTheDocument());
  expect(screen.getByRole('alert')).toHaveTextContent('Membership required.');
});
it('clears private history immediately on logout and ignores a stale load after account switch', async () => {
  let resolveOld: ((value: typeof empty) => void) | undefined;
  request.mockResolvedValueOnce({ ...empty, total: 1, pending: 1, items: [{ id: 'private', email: 'private@example.test', status: 'pending', delivery: 'sent', created_at: '2026-09-27', expires_at: '2026-10-04' }] });
  render(<InvitesPage />);
  await screen.findByText('private@example.test');
  request.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByText('Loading invitations…');
  act(() => { auth.change?.('SIGNED_OUT', null); });
  expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Sign in to view invitations.');
  act(() => { resolveOld?.({ ...empty, total: 1, items: [{ id: 'private', email: 'private@example.test' }] } as typeof empty); });
  await waitFor(() => expect(screen.queryByText('private@example.test')).not.toBeInTheDocument());
  act(() => { auth.change?.('SIGNED_IN', { user: { id: 'another-sender' } }); });
  await screen.findByText('Invite someone to join your next league night.');
  expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
});

it('keeps the exact uncertain request when the same session is restored on tab focus', async () => {
  render(<InvitesPage />);
  await screen.findByText('Invite someone to join your next league night.');
  request.mockRejectedValueOnce(new Error('Connection lost.'));
  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'synthetic@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  await screen.findByText('Connection lost.');
  const original = request.mock.calls.at(-1)?.[0];
  act(() => { auth.change?.('SIGNED_IN', { user: { id: 'sender' } }); });
  expect(screen.getByLabelText('Their email address')).toBeDisabled();
  request.mockResolvedValueOnce({ message: 'Request already recorded.' });
  fireEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
  await screen.findByText('Request already recorded.');
  expect(request.mock.calls.filter(([body]) => body.action === 'create').map(([body]) => body)).toEqual([original, original]);
});

it('retains an in-flight result on same-user focus and discards it after an actual account switch', async () => {
  let finish: ((value: { message: string }) => void) | undefined;
  render(<InvitesPage />);
  await screen.findByText('Invite someone to join your next league night.');
  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'synthetic@example.test' } });
  request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  act(() => { auth.change?.('SIGNED_IN', { user: { id: 'sender' } }); });
  expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
  await act(async () => { finish?.({ message: 'Invitation sent.' }); });
  await screen.findByText('Invitation sent.');

  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'private-draft@example.test' } });
  request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  act(() => { auth.change?.('SIGNED_IN', { user: { id: 'another-sender' } }); });
  await act(async () => { finish?.({ message: 'Previous user sent an invitation.' }); });
  expect(screen.queryByText('Previous user sent an invitation.')).not.toBeInTheDocument();
});

it('explains the required site origin without asking an already signed-in user to sign in', async () => {
  request.mockRejectedValueOnce(new InviteRequestError('wrong_origin', 'Use the main site address.', 'https://release.example.test'));
  render(<InvitesPage />);
  expect(await screen.findByRole('link', {name: 'Open invitations on the main site'})).toHaveAttribute('href', 'https://release.example.test/invites');
  expect(screen.queryByRole('link', {name:'Sign in'})).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name:'Send invitation'})).toBeDisabled();
});
