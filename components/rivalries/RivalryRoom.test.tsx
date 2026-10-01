import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Challenge, RivalryFeed } from "@/lib/rivalries/types";
const mocks = vi.hoisted(() => ({
  feed: vi.fn(),
  matches: vi.fn(),
  userId: "a",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/league-night/use-current-user", () => ({
  useCurrentUser: () => ({ user: { id: mocks.userId }, loading: false }),
}));
vi.mock("@/lib/league-night/api", () => ({
  loadMatches: mocks.matches,
  loadProfiles: async () => [
    { id: "a", display_name: "Alpha" },
    { id: "b", display_name: "Bravo" },
  ],
}));
vi.mock("@/lib/rivalries/api", () => ({
  loadRivalryFeed: mocks.feed,
  rivalryError: (error: unknown) => String(error),
}));
vi.mock("@/lib/rivalries/use-operation", () => ({
  useRivalryOperation: () => ({
    ready: true,
    pending: null,
    busy: false,
    submit: vi.fn(),
  }),
}));
vi.mock("@/components/avatars/PlayerAvatar", () => ({
  PlayerAvatar: () => <span />,
}));
vi.mock("./RivalryPoster", () => ({
  RivalryPoster: ({ headline }: { headline: string }) => (
    <p data-testid="poster-headline">{headline}</p>
  ),
}));
import { RivalryRoom } from "./RivalryRoom";
const baseFeed: RivalryFeed = {
  organizer: false,
  challenges: [],
  avatars: [],
  nights: [],
  active_users: ["a", "b"],
  server_time: "2026-09-29T12:00:00Z",
};
beforeEach(() => {
  mocks.userId = "a";
  mocks.feed.mockResolvedValue(baseFeed);
  mocks.matches.mockResolvedValue(
    ["501", "Cricket"].map((game, i) => ({
      id: i + 1,
      played_at: "2026-09-28T12:00:00Z",
      game_type: game,
      board_type: i ? "Soft Tip" : "Steel Tip",
      match_players: [
        { player_id: "a", is_winner: true },
        { player_id: "b", is_winner: false },
      ],
    })),
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
      this.querySelector<HTMLButtonElement>('button[aria-label="Close dialog"]')?.focus();
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
});
it.each([
  ["Make a fight poster", "close"],
  ["Make a fight poster", "cancel"],
  ["Challenge Bravo", "close"],
  ["Challenge Bravo", "cancel"],
])("returns focus to %s after dialog %s", async (label, dismissal) => {
  render(<RivalryRoom />);
  const opener = await screen.findByRole("button", { name: new RegExp(label) });
  opener.focus();
  fireEvent.click(opener);
  const element = screen.getByRole("dialog");
  const close = screen.getByRole("button", { name: "Close dialog" });
  expect(close).toHaveFocus();
  if (dismissal === "cancel") fireEvent(element, new Event("cancel", { bubbles: false }));
  else fireEvent.click(close);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("keeps all pair game choices available after changing game and board filters", async () => {
  render(<RivalryRoom />);
  const game = await screen.findByLabelText("Game");
  fireEvent.change(game, { target: { value: "501" } });
  expect(screen.getByRole("option", { name: "Cricket" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Board"), {
    target: { value: "Soft Tip" },
  });
  expect(screen.getByRole("option", { name: "501" })).toBeInTheDocument();
  fireEvent.change(game, { target: { value: "Cricket" } });
  expect(game).toHaveValue("Cricket");
  expect(screen.getByRole("option", { name: "501" })).toBeInTheDocument();
});
it.each(["a", "b", "spectator"])(
  "uses an accurate completed headline on the page and poster for viewer %s",
  async (viewer) => {
    mocks.userId = viewer;
    const challenge = {
      id: "series",
      sender: "a",
      recipient: "b",
      game: "501",
      preset: "501-double-v1",
      board: "Steel Tip",
      best_of: 3,
      state: "completed",
      stored_state: "accepted",
      wins: [2, 0],
      target: 2,
      winner: "a",
      games: [],
      schedule: {
        title: "Review fixture",
        starts_at: "2026-10-01T12:00:00Z",
        status: "scheduled",
        event_revision: 1,
      },
    } as unknown as Challenge;
    mocks.feed.mockResolvedValue({ ...baseFeed, challenges: [challenge] });
    render(<RivalryRoom challengeId="series" />);
    await screen.findByRole("heading", { name: "THE CHAPTER IS WON." });
    fireEvent.click(
      screen.getByRole("button", { name: "Make a fight poster" }),
    );
    expect(screen.getByTestId("poster-headline")).toHaveTextContent(
      "THE CHAPTER IS WON.",
    );
  },
);
