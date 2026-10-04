import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { Challenge, RivalryFeed } from "@/lib/rivalries/types";
const mocks = vi.hoisted(() => ({
  feed: vi.fn(),
  matches: vi.fn(),
  submit: vi.fn(),
  profiles: vi.fn(),
  userId: "a",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/league-night/use-current-user", () => ({
  useCurrentUser: () => ({ user: { id: mocks.userId }, loading: false }),
}));
vi.mock("@/lib/league-night/api", () => ({
  loadMatches: mocks.matches,
  loadProfiles: mocks.profiles,
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
    submit: mocks.submit,
  }),
}));
vi.mock("@/components/avatars/PlayerAvatar", async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/avatars/PlayerAvatar')>(),
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
  mocks.submit.mockReset();
  mocks.profiles.mockResolvedValue([{ id: 'a', display_name: 'Alpha' }, { id: 'b', display_name: 'Bravo' }]);
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
it("shows the all-history Power Rating in cards and options regardless of rivalry filters", async () => {
  render(<RivalryRoom />);
  const rival = await screen.findByRole("button", { name: /Bravo · Power Rating 1,469 \(Provisional\)/ });
  expect(screen.getByTitle("Current Power Rating 1,531 (Provisional)").querySelector("b")).toHaveTextContent("1,531");
  expect(screen.getByTitle("Current Power Rating 1,469 (Provisional)").querySelector("b")).toHaveTextContent("1,469");
  expect(screen.getByRole("option", { name: "Bravo · Power Rating 1,469 (Provisional)" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Game"), { target: { value: "Cricket" } });
  fireEvent.change(screen.getByLabelText("Board"), { target: { value: "Steel Tip" } });
  expect(rival).toHaveTextContent("Power Rating 1,469");
  expect(screen.getByRole("option", { name: "Bravo · Power Rating 1,469 (Provisional)" })).toBeInTheDocument();
  fireEvent.click(rival);
  expect(screen.getByRole("combobox", { name: "Choose rival" })).toHaveValue("b");
});
it("shows the provisional starting rating for a player without rated matches", async () => {
  mocks.matches.mockResolvedValue([]);
  render(<RivalryRoom />);
  expect(await screen.findByRole("option", { name: "Bravo · Power Rating 1,500 (Provisional)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Bravo · Power Rating 1,500 \(Provisional\)/ })).toBeInTheDocument();
});
it("removes the provisional label after ten evidence games", async () => {
  mocks.matches.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({
    id: i + 1, played_at: "2026-09-28T12:00:00Z", game_type: "501", board_type: "Steel Tip",
    match_players: [{ player_id: "a", is_winner: true }, { player_id: "b", is_winner: false }],
  })));
  render(<RivalryRoom />);
  const rival = await screen.findByRole("button", { name: /Bravo · Power Rating/ });
  expect(rival).not.toHaveTextContent("Provisional");
  expect(screen.getByRole("option", { name: /Bravo · Power Rating/ })).not.toHaveTextContent("Provisional");
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
    expect(screen.getByTitle("Current Power Rating 1,531 (Provisional)")).toBeInTheDocument();
    expect(screen.getByTitle("Current Power Rating 1,469 (Provisional)")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Make a fight poster" }),
    );
    expect(screen.getByTestId("poster-headline")).toHaveTextContent(
      "THE CHAPTER IS WON.",
    );
  },
);

it.each(['a', 'b'])('creates a fresh rematch with the original terms for participant %s', async viewer => {
  mocks.userId = viewer;
  const old = { id: 'completed-series', sender: 'a', recipient: 'b', night_id: 'old-night',
    game: '301', preset: '301-double-v1', board: 'Soft Tip', best_of: 7, state: 'completed',
    stored_state: 'accepted', wins: [4, 0], target: 4, winner: 'a', games: [],
    schedule: { title: 'Original night', starts_at: '2026-10-01T12:00:00Z', status: 'scheduled', event_revision: 1 },
  } as unknown as Challenge;
  const before = JSON.stringify(old);
  mocks.feed.mockResolvedValue({ ...baseFeed, challenges: [old], nights: [
    { night_id: 'old-night', title: 'Original night', starts_at: '2026-10-01T12:00:00Z' },
    { night_id: 'past-night', title: 'Past night', starts_at: '2026-09-01T12:00:00Z' },
    { night_id: 'next-night', title: 'Next night', starts_at: '2026-10-02T12:00:00Z' },
  ] });
  render(<RivalryRoom challengeId={old.id} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Run it back' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByLabelText('Game')).toHaveValue('301');
  expect(dialog.getByLabelText('Rules')).toHaveValue('301-double-v1');
  expect(dialog.getByLabelText('Board')).toHaveValue('Soft Tip');
  expect(dialog.getByLabelText('Series')).toHaveValue('7');
  expect(dialog.getByLabelText('Scheduled League Night')).toHaveValue('');
  expect(dialog.queryByRole('option', { name: /Original night|Past night/ })).not.toBeInTheDocument();
  const send = dialog.getByRole('button', { name: /Send challenge/ });
  expect(send).toBeDisabled();
  fireEvent.change(dialog.getByLabelText('Scheduled League Night'), { target: { value: 'next-night' } });
  fireEvent.click(send);
  expect(mocks.submit).toHaveBeenCalledTimes(1);
  expect(mocks.submit.mock.calls[0][0]).toEqual({ action: 'create', id: expect.any(String), recipient: viewer === 'a' ? 'b' : 'a', night_id: 'next-night', game: '301', preset: '301-double-v1', board: 'Soft Tip', best_of: 7 });
  expect(mocks.submit.mock.calls[0][0].id).not.toBe(old.id);
  expect(JSON.stringify(old)).toBe(before);
});
it('does not offer a rematch to a spectator', async () => {
  mocks.userId = 'spectator';
  const challenge = { id: 'series', sender: 'a', recipient: 'b', night_id: 'old', game: '501', preset: '501-double-v1', board: 'Steel Tip', best_of: 3, state: 'completed', wins: [2, 0], target: 2, winner: 'a', games: [], schedule: { starts_at: '2026-10-01T12:00:00Z', status: 'scheduled' } } as unknown as Challenge;
  mocks.feed.mockResolvedValue({ ...baseFeed, challenges: [challenge] });
  render(<RivalryRoom challengeId="series" />);
  await screen.findByRole('heading', { name: 'THE CHAPTER IS WON.' });
  expect(screen.queryByRole('button', { name: 'Run it back' })).not.toBeInTheDocument();
});
it('keeps the selected rival when sorting and filtering the available opponents', async () => {
  mocks.profiles.mockResolvedValue([{ id: 'a', display_name: 'Alpha' }, { id: 'b', display_name: 'Bravo' }, { id: 'c', display_name: 'Charlie' }]);
  mocks.feed.mockResolvedValue({ ...baseFeed, active_users: ['a', 'b', 'c'] });
  render(<RivalryRoom />);
  const chooser = await screen.findByRole('combobox', { name: 'Choose rival' });
  fireEvent.change(chooser, { target: { value: 'b' } });
  fireEvent.change(screen.getByLabelText('Sort opponents'), { target: { value: 'never-played' } });
  expect(chooser).toHaveValue('b');
  expect(screen.getByRole('option', { name: /Current selection · Bravo/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Bravo · Power Rating/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Charlie · Power Rating/ }));
  fireEvent.change(screen.getByLabelText('Sort opponents'), { target: { value: 'most-played' } });
  expect(chooser).toHaveValue('c');
  expect(screen.getAllByRole('button', { name: /recorded singles wins$/ })[0]).toHaveAccessibleName(/^Bravo/);
});
