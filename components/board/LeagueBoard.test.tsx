import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import LeagueBoard from './LeagueBoard';
import BoardPreview from './BoardPreview';

const mocks = vi.hoisted(() => ({ access: { loading:false, user:null, member:null, error:null, refresh:vi.fn() } as Record<string, unknown>, feed:vi.fn(), write:vi.fn(), thread:vi.fn() }));
vi.mock('./useBoardAccess', () => ({ useBoardAccess: () => mocks.access }));
vi.mock('@/lib/board', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/board')>()), boardFeed:mocks.feed, boardWrite:mocks.write, boardThread:mocks.thread }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.access = { loading:false,user:null,member:null,error:null,refresh:vi.fn() };
  mocks.feed.mockResolvedValue([]); mocks.write.mockResolvedValue('id'); mocks.thread.mockResolvedValue([]);
});
it('does not request private content while signed out, pending, or revoked', async () => {
  const { rerender } = render(<LeagueBoard />);
  expect(screen.getByRole('link',{name:'Sign in to the board'})).toHaveAttribute('href','/auth?next=%2Fboard');
  mocks.access.user = {id:'member'}; mocks.access.member = {status:'pending',role:'member'};
  rerender(<LeagueBoard />);
  expect(screen.getByText('Your request is with the organizers.')).toBeVisible();
  mocks.access.member = {status:'revoked',role:'member'};
  rerender(<LeagueBoard />);
  expect(screen.getByText('Your board access is paused.')).toBeVisible();
  expect(mocks.feed).not.toHaveBeenCalled();
});
it('requests organizer approval without opening the feed', async () => {
  mocks.access.user = {id:'member'};
  render(<LeagueBoard />);
  fireEvent.click(screen.getByRole('button',{name:'Request board access'}));
  await waitFor(() => expect(mocks.write).toHaveBeenCalledWith('request_access'));
  expect(mocks.feed).not.toHaveBeenCalled();
});
it('distinguishes a failed read from a welcoming empty board', async () => {
  mocks.access.user={id:'member'};mocks.access.member={status:'approved',role:'member'};
  mocks.feed.mockRejectedValue({code:'PGRST202'});
  render(<LeagueBoard />);
  expect(await screen.findByRole('alert')).toHaveTextContent('not ready');
  expect(screen.queryByText('Who’s throwing this week?')).not.toBeInTheDocument();
  mocks.feed.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button',{name:'Refresh'}));
  expect(await screen.findByText('Who’s throwing this week?')).toBeVisible();
});
it('hides private homepage results even if a read completes after sign-out', async () => {
  mocks.access.user={id:'member'};mocks.access.member={status:'approved',role:'member'};
  let complete!: (value: unknown[])=>void;
  mocks.feed.mockReturnValue(new Promise(resolve => {complete=resolve;}));
  const {rerender}=render(<BoardPreview />);
  mocks.access.user=null;mocks.access.member=null;
  rerender(<BoardPreview />);
  await act(async()=>complete([{id:'post',body:'Private conversation',profile:{display_name:'Player'},reply_count:1}]));
  expect(screen.queryByText('Private conversation')).not.toBeInTheDocument();
  expect(screen.queryByText('From the League Board')).not.toBeInTheDocument();
});
