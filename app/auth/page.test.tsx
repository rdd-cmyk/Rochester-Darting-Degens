// @vitest-environment-options {"url":"https://rdd-preview.vercel.app"}
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import AuthPage from './page';

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth } }));

beforeEach(() => {
  auth.getUser.mockResolvedValue({ data: { user: null } });
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
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
