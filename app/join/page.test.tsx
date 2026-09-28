import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import JoinPage from './page';
import { InviteRequestError } from '@/lib/invites/client';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/invites/client', () => ({ inviteRequest: request, InviteRequestError: class extends Error {
  constructor(public code: string, message: string) { super(message); }
} }));
beforeEach(() => {
  request.mockReset();
  window.history.replaceState(null, '', '/join#invite=synthetic-token');
  request.mockResolvedValue({ inviter: 'Synthetic inviter', email_hint: 'p***@example.test', expires_at: '2026-10-04' });
});
it('clears the secret URL and never offers an editable recipient field', async () => {
  render(<JoinPage />);
  await screen.findByText('Synthetic inviter invited you');
  expect(window.location.hash).toBe('');
  expect(screen.getByText('p***@example.test')).toBeInTheDocument();
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'challenge' }));
});
it('requires an explicit action before sending a fresh inbox code', async () => {
  render(<JoinPage />);
  await screen.findByText('Synthetic inviter invited you');
  request.mockResolvedValueOnce({ challenge: true, message: 'Verification code sent.' });
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  await screen.findByLabelText('Verification code');
  expect(request).toHaveBeenLastCalledWith({ action: 'challenge', token: 'synthetic-token' });
});

it('unlocks the form when an uncertain retry resolves to an incorrect code', async () => {
  render(<JoinPage />);
  await screen.findByText('Synthetic inviter invited you');
  request.mockResolvedValueOnce({ challenge: true, message: 'Code sent.' });
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  await screen.findByLabelText('Verification code');
  for (const [label, value] of [['Verification code','00000000'],['First name','Test'],['Last name','Player'],['Display name','Test Player'],['Password','Synthetic long password!']]) {
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  }
  request.mockRejectedValueOnce(new Error('Connection lost.'));
  fireEvent.click(screen.getByRole('button', { name: /^Join the league$/ }));
  await screen.findByText('Connection lost.');
  expect(screen.getByLabelText('Verification code')).toBeDisabled();
  request.mockRejectedValueOnce(new InviteRequestError('invalid_code', 'Incorrect code.'));
  fireEvent.click(screen.getByRole('button', { name: 'Retry same registration' }));
  await screen.findByText('Incorrect code.');
  expect(screen.getByLabelText('Verification code')).toBeEnabled();
  expect(screen.getByRole('button', { name: /^Join the league$/ })).toBeEnabled();
});
