import { it, expect, vi } from "vitest";
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayerAvatar } from "./PlayerAvatar";
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
