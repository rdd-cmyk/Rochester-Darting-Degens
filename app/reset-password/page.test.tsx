import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { afterEach, expect, it, vi } from 'vitest';

import ResetPasswordPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const auth = vi.hoisted(() => ({ setSession: vi.fn(), updateUser: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth } }));

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.resetAllMocks();
});

it('keeps successful recovery visible until the user chooses to continue', async () => {
  auth.setSession.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  window.history.replaceState(null, '', '/reset-password#type=recovery&access_token=synthetic-access&refresh_token=synthetic-refresh');
  render(<ResetPasswordPage />);
  fireEvent.change(await screen.findByLabelText('New password:'), { target: { value: 'Invented-Recovery-2026!' } });
  fireEvent.change(screen.getByLabelText('Confirm password:'), { target: { value: 'Invented-Recovery-2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Password updated successfully. You are signed in.');
  expect(screen.getByRole('button', { name: 'Continue to Matches' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('keeps a valid recovery form free of a false missing-session error in Strict Mode', async () => {
  window.history.replaceState(
    null,
    '',
    '/reset-password#type=recovery&access_token=synthetic-access&refresh_token=synthetic-refresh',
  );

  render(<StrictMode><ResetPasswordPage /></StrictMode>);

  expect(await screen.findByRole('button', { name: 'Update Password' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(window.location.hash).toBe('');
});

it('removes an unusable recovery form and offers a sign-in path when the session has expired', async () => {
  auth.setSession.mockResolvedValue({ error: new AuthApiError('Synthetic expired reset.', 400, 'refresh_token_not_found') });
  window.history.replaceState(
    null,
    '',
    '/reset-password#type=recovery&access_token=synthetic-access&refresh_token=synthetic-refresh',
  );

  render(<ResetPasswordPage />);
  fireEvent.change(await screen.findByLabelText('New password:'), { target: { value: 'Invented-Recovery-2026!' } });
  fireEvent.change(screen.getByLabelText('Confirm password:'), { target: { value: 'Invented-Recovery-2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

  expect(await screen.findByRole('link', { name: 'Return to sign in' })).toHaveAttribute('href', '/auth');
  expect(screen.queryByRole('button', { name: 'Update Password' })).not.toBeInTheDocument();
  expect(auth.updateUser).not.toHaveBeenCalled();
});

it.each([
  new AuthRetryableFetchError('Synthetic offline failure', 0),
  new AuthApiError('Synthetic rate limit', 429, 'over_request_rate_limit'),
  new AuthApiError('Synthetic service failure', 500, 'unexpected_failure'),
])('preserves recovery input and retries after a temporary $name ($status) session error', async (error) => {
  auth.setSession.mockResolvedValueOnce({ error }).mockResolvedValue({ error: null });
  // Avoid the successful redirect timer while still verifying the retry reaches updateUser.
  auth.updateUser.mockResolvedValue({ error: new AuthRetryableFetchError('Synthetic update failure', 0) });
  window.history.replaceState(
    null,
    '',
    '/reset-password#type=recovery&access_token=synthetic-access&refresh_token=synthetic-refresh',
  );

  render(<ResetPasswordPage />);
  const password = 'Invented-Recovery-2026!';
  fireEvent.change(await screen.findByLabelText('New password:'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password:'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again.');
  expect(screen.getByLabelText('New password:')).toHaveValue(password);
  expect(screen.getByLabelText('Confirm password:')).toHaveValue(password);
  expect(screen.getByRole('button', { name: 'Update Password' })).toBeEnabled();
  expect(screen.queryByRole('link', { name: 'Return to sign in' })).not.toBeInTheDocument();
  expect(auth.updateUser).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
  await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password }));
  expect(auth.setSession).toHaveBeenNthCalledWith(2, {
    access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
  });
});
