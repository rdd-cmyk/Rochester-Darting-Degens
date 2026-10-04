import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import BoardModeration from './BoardModeration';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), candidates: vi.fn(), grant: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/board', async original => ({ ...(await original<typeof import('@/lib/board')>()), boardAdmin: mocks.admin, boardAccessCandidates: mocks.candidates, boardGrantAccess: mocks.grant, boardWrite: mocks.write }));
const person = { user_id: 'new-member', status: 'none', profile: { display_name: 'New member', first_name: 'Private', include_first_name_in_display: false } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ members: [], reports: [], hidden: [] });
  mocks.candidates.mockResolvedValue({ items: [person], total: 1 });
  mocks.grant.mockResolvedValue('new-member');
});
it('grants an unrequested member access and refreshes the eligible list after confirmation', async () => {
  const onChange = vi.fn();
  render(<BoardModeration onChange={onChange} />);
  await screen.findByRole('option', { name: 'New member · No request' });
  expect(screen.getByRole('button', { name: 'Grant access' })).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'new-member' } });
  mocks.candidates.mockResolvedValue({ items: [], total: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Grant access' }));
  await screen.findByText('Board access granted.');
  expect(mocks.grant).toHaveBeenCalledWith('new-member');
  expect(mocks.write).not.toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledOnce();
  expect(screen.queryByRole('option', { name: 'New member · No request' })).not.toBeInTheDocument();
});
it('retains existing tools when the new candidate function is unavailable', async () => {
  mocks.candidates.mockRejectedValue({ code: 'PGRST202' });
  render(<BoardModeration onChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Members and requests' });
  expect(screen.getByRole('alert')).toHaveTextContent('Existing organizer tools are still available');
  expect(screen.queryByRole('button', { name: 'Grant access' })).not.toBeInTheDocument();
});
it('does not claim success after a rejected grant', async () => {
  mocks.grant.mockRejectedValue({ code: '42501' });
  const onChange = vi.fn();
  render(<BoardModeration onChange={onChange} />);
  await screen.findByRole('option', { name: 'New member · No request' });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'new-member' } });
  fireEvent.click(screen.getByRole('button', { name: 'Grant access' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('access changed'));
  expect(screen.queryByText('Board access granted.')).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'New member · No request' })).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
