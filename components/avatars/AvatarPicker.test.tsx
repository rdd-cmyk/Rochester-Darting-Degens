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
it.each([
  ["cactus", "Sharp Shooter"],
  ["gorilla", "Big Finish"],
  ["dragon", "Hot Streak"],
])("saves the new %s choice using its stable ID", async (avatarId, label) => {
  rpc.mockImplementation(async (name: string, args?: { p_payload: { avatar_id: string } }) => ({
    error: null,
    data: name === "rdd_avatar_self"
      ? { user_id: "a", avatar_id: "fox", revision: 1 }
      : { avatar: { user_id: "a", avatar_id: args?.p_payload.avatar_id, revision: 2 }, replayed: false },
  }));
  render(<AvatarPicker userId="a" name="Alpha" />);
  const choice = screen.getByRole("button", { name: label });
  await waitFor(() => expect(choice).toBeEnabled());
  fireEvent.click(choice);
  fireEvent.click(screen.getByRole("button", { name: "Save avatar" }));
  await screen.findByText("Your player avatar is saved.");
  expect(rpc).toHaveBeenCalledWith("rdd_rivalry_write", expect.objectContaining({
    p_payload: { action: "avatar", avatar_id: avatarId, expected_revision: 1, submitted_by: "a" },
  }));
  expect(choice).toHaveAttribute("aria-pressed", "true");
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
