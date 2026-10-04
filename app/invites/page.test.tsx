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
it('searches across history, resets pagination and clears the query', async () => {
  request.mockResolvedValue({ ...empty, total: 21 });
  render(<InvitesPage />);
  await screen.findByText('Invite someone to join your next league night.');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Search' })).not.toBeDisabled());
  request.mockResolvedValue(empty);
  fireEvent.change(screen.getByLabelText('Search by email or sender'), { target: { value: ' Alpha ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('No invitations match your search. Try another email or sender, or clear the search.');
  expect(request).toHaveBeenLastCalledWith({ action: 'list', filter: 'all', page: 0, search: 'Alpha' });
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  await screen.findByText('Invite someone to join your next league night.');
  expect(screen.getByLabelText('Search by email or sender')).toHaveValue('');
  expect(request).toHaveBeenLastCalledWith({ action: 'list', filter: 'all', page: 0, search: '' });
});
it('keeps search controls available after a failed search', async () => {
  render(<InvitesPage />); await screen.findByText('Invite someone to join your next league night.');
  request.mockRejectedValueOnce(new Error('Search unavailable.'));
  fireEvent.change(screen.getByLabelText('Search by email or sender'), { target: { value: 'Alpha' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('Search unavailable.');
  expect(screen.getByLabelText('Search by email or sender')).toHaveValue('Alpha');
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  await screen.findByText('Invite someone to join your next league night.');
});
it('shows all organizer-visible invites and sender names, with controls only on owned invites', async () => {
  const invite = { status: 'pending', delivery: 'sent', created_at: '2026-09-27', expires_at: '2026-10-04' };
  request.mockResolvedValue({ ...empty, scope: 'league', total: 2, pending: 2, items: [
    { ...invite, id: 'mine', email: 'mine@example.test', can_manage: true, inviter: { display_name: 'Organizer', first_name: 'Private', include_first_name_in_display: false } },
    { ...invite, id: 'other', email: 'other@example.test', can_manage: false, inviter: { display_name: 'Another sender', first_name: 'Private', include_first_name_in_display: false } },
  ] });
  render(<InvitesPage />);
  await screen.findByRole('heading', { name: 'All league invitations' });
  expect(screen.getByText('Invited by Another sender')).toBeInTheDocument();
  expect(screen.queryByText(/Private/)).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Resend' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
});
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
