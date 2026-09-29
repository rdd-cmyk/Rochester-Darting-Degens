import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import ResetPasswordPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const auth = vi.hoisted(() => ({ setSession: vi.fn(), updateUser: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth } }));

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.clearAllMocks();
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
  auth.setSession.mockResolvedValue({ error: { message: 'Synthetic expired reset.' } });
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
