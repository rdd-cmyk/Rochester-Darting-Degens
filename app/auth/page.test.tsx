// @vitest-environment-options {"url":"https://rdd-preview.vercel.app"}
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import AuthPage from './page';

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth } }));

beforeEach(() => {
  auth.getUser.mockResolvedValue({ data: { user: null } });
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  window.history.replaceState(null, '', '/auth');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://rocdartdegens.com');
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it('sends recovery back to the current deployment even when a production site URL is configured', async () => {
  render(<AuthPage />);
  fireEvent.change(screen.getByLabelText('Email', { exact: true }), {
    target: { value: 'synthetic@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Forgot your password?' }));

  await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
    'synthetic@example.test',
    { redirectTo: 'https://rdd-preview.vercel.app/reset-password' }
  ));
  expect(screen.getByText('Password reset email sent. Check your inbox.')).toBeInTheDocument();
});

it('explains invitation-only registration without exposing a signup form', () => {
  render(<AuthPage />);
  expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument();
  expect(screen.getByText(/Joining is by invitation/)).toBeInTheDocument();
});

it('preserves a Board destination after signing in', async () => {
  window.history.replaceState(null, '', '/auth?next=%2Fboard');
  render(<AuthPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Synthetic passphrase!' } });
  fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/board'));
});

it('preserves a Board thread destination for an already signed-in account', async () => {
  const target = '/board/aaaaaaaa-0000-4000-8000-000000000001';
  window.history.replaceState(null, '', `/auth?next=${encodeURIComponent(target)}`);
  auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'synthetic' } } });
  render(<AuthPage />);
  await waitFor(() => expect(push).toHaveBeenCalledWith(target));
});
