import { useState } from 'react';
import { it, expect, vi } from "vitest";
const current = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('@/lib/league-night/use-current-user', () => ({ useCurrentUser: () => current }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ data: { avatars: [], total: 0 } }) } }));
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { supabase } from '@/lib/supabaseClient';
import { AvatarProvider, PlayerAvatar, useAvatarChoice } from "./PlayerAvatar";
it('hides the previous account avatar cache immediately while the next account refresh is pending', async () => {
  vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { avatars: [{ user_id: 'fictional-a', avatar_id: 'fox' }], total: 1 }, error: null } as never);
  function Choice() {
    const choice = useAvatarChoice('fictional-a');
    return <span>{choice?.avatar_id ?? 'no cached choice'}</span>;
  }
  current.user = { id: 'fictional-a' };
  const view = render(<AvatarProvider><Choice /></AvatarProvider>);
  await waitFor(() => expect(screen.getByText('fox')).toBeInTheDocument());
  vi.mocked(supabase.rpc).mockImplementationOnce(() => new Promise(() => {}) as never);
  current.user = { id: 'fictional-b' };
  view.rerender(<AvatarProvider><Choice /></AvatarProvider>);
  expect(screen.getByText('no cached choice')).toBeInTheDocument();
  current.user = null;
});
it('preserves page state when a recovery session signs in and when the account changes', () => {
  function RecoveryDraft() {
    const [value, setValue] = useState('');
    return <input aria-label="Recovery draft" value={value} onChange={event => setValue(event.target.value)} />;
  }
  current.user = null;
  const view = render(<AvatarProvider><RecoveryDraft /></AvatarProvider>);
  fireEvent.change(screen.getByLabelText('Recovery draft'), { target: { value: 'in-progress' } });
  for (const user of [{ id: 'fictional-a' }, { id: 'fictional-b' }, null]) {
    current.user = user;
    view.rerender(<AvatarProvider><RecoveryDraft /></AvatarProvider>);
    expect(screen.getByLabelText('Recovery draft')).toHaveValue('in-progress');
  }
});
it("falls back to initials after a missing image and retries a new choice", () => {
  const view = render(
    <PlayerAvatar name="Long Player" avatarId="fox" portrait />,
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByText("LP")).toBeInTheDocument();
  view.rerender(<PlayerAvatar name="Long Player" avatarId="tiger" portrait />);
  expect(
    new URL(
      screen.getByRole("img").getAttribute("src")!,
      window.location.origin,
    ).pathname,
  ).toBe("/avatars/tiger.webp");
});
it("keeps unavailable catalog choices on the initials fallback", () => {
  render(<PlayerAvatar name="Legacy Player" avatarId="retired-unknown" />);
  expect(screen.getByText("LP")).toBeInTheDocument();
});
