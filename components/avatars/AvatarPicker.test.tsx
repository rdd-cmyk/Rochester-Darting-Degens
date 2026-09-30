import { afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc } }));
vi.mock("./PlayerAvatar", () => ({
  AVATAR_CHANGED: "rdd-avatar-changed",
  PlayerAvatar: () => <span />,
}));
import { AvatarPicker } from "./AvatarPicker";
afterEach(() => {
  cleanup();
  localStorage.clear();
  rpc.mockReset();
});
it("shows the current avatar and explains a confirmed but superseded save", async () => {
  rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === "rdd_avatar_self"
        ? { user_id: "a", avatar_id: "fox", revision: 1 }
        : {
            avatar: { user_id: "a", avatar_id: "owl", revision: 2 },
            avatar_superseded: true,
            replayed: true,
          },
  }));
  render(<AvatarPicker userId="a" name="Alpha" />);
  const save = screen.getByRole("button", { name: "Save avatar" });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await screen.findByText(
    "Your earlier save is confirmed. Showing your latest avatar from a later save.",
  );
  expect(screen.getByRole("button", { name: "Night Shift" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Hustler" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
