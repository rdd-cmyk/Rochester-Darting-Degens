import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import ProfilePage from './page';

const supabaseMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: supabaseMock.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: supabaseMock.maybeSingle }) }),
      upsert: supabaseMock.upsert,
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.getUser.mockResolvedValue({
    data: { user: { id: 'profile-1', email: 'captain@example.test' } },
    error: null,
  });
  supabaseMock.maybeSingle.mockResolvedValue({
    data: {
      id: 'profile-1', first_name: 'Demo', last_name: 'Captain',
      display_name: 'Captain', include_first_name_in_display: true, sex: null,
    },
    error: null,
  });
});

it('keeps a pending profile save stable and prevents a duplicate submission', async () => {
  let finishSave!: (result: { error: null }) => void;
  supabaseMock.upsert.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));

  render(<ProfilePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New captain' } });
  const saveButton = screen.getByRole('button', { name: 'Save profile' });
  fireEvent.click(saveButton);

  await waitFor(() => expect(supabaseMock.upsert).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByLabelText('Display name')).toBeDisabled();
  const form = saveButton.closest('form');
  expect(form).toHaveAttribute('aria-busy', 'true');
  fireEvent.submit(form!);
  expect(supabaseMock.upsert).toHaveBeenCalledTimes(1);

  finishSave({ error: null });
  await waitFor(() => expect(screen.getByText('Profile saved successfully.')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  expect(screen.getByLabelText('Display name')).toHaveValue('New captain');
});

it('shows a retry state when the account check rejects', async () => {
  supabaseMock.getUser.mockRejectedValueOnce(new Error('Network unavailable'));
  render(<ProfilePage />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your account or profile.');
  expect(screen.queryByText('Sign in to view or edit your profile.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
});

it('treats a missing auth session as signed out instead of a load failure', async () => {
  supabaseMock.getUser.mockResolvedValueOnce({
    data: { user: null },
    error: { name: 'AuthSessionMissingError' },
  });
  render(<ProfilePage />);

  expect(await screen.findByText('Sign in to view or edit your profile.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/auth');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(supabaseMock.maybeSingle).not.toHaveBeenCalled();
});

it('shows a retry state when the profile request fails without exposing an empty form', async () => {
  supabaseMock.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('Request failed') });
  render(<ProfilePage />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your account or profile.');
  expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  expect(screen.getByLabelText('Display name')).toHaveValue('Captain');
});
