import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { useState } from "react";
import { ProfileSoloStats } from "./ProfileSoloStats";
const mocks = vi.hoisted(() => ({
  user: { id: "viewer" } as { id: string } | null,
  profile: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@/lib/league-night/use-current-user", () => ({
  useCurrentUser: () => ({ user: mocks.user, loading: false }),
}));
vi.mock("@/lib/solo/api", () => ({
  loadSoloProfile: mocks.profile,
  soloError: (e: { message: string }) => e.message,
}));
vi.mock("@/lib/league-night/api", () => ({ loadMatches: mocks.history }));
function Fixture({ owner = "owner" }: { owner?: string }) {
  const [scope, setScope] = useState<"league" | "solo" | "all">("league");
  return (
    <ProfileSoloStats owner={owner} scope={scope} onScopeChange={setScope} />
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: "viewer" };
  mocks.profile.mockResolvedValue(null);
  mocks.history.mockResolvedValue([]);
});
it("opens on League without prefetching private summaries and distinguishes denied access from zero games", async () => {
  render(<Fixture />);
  expect(mocks.profile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Solo" }));
  await screen.findByText("This player’s solo summary is private.");
  expect(screen.queryByText("0 league + 0 solo")).not.toBeInTheDocument();
});
it("hides the old summary immediately when viewer or profile changes and ignores late responses", async () => {
  mocks.profile.mockResolvedValueOnce([
    {
      game_type: "501",
      board_type: "Steel Tip",
      preset: "unspecified",
      games: 8,
      scored: 8,
      score_sum: 512,
      best: 70,
    },
  ]);
  const view = render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "Solo" }));
  await screen.findByText("64.00");
  let finish: (value: null) => void = () => {};
  mocks.profile.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mocks.user = { id: "different-viewer" };
  view.rerender(<Fixture />);
  expect(screen.queryByText("64.00")).not.toBeInTheDocument();
  expect(screen.getByText("Loading scoring summary…")).toBeInTheDocument();
  view.rerender(<Fixture owner="other-owner" />);
  await screen.findByText("This player’s solo summary is private.");
  finish(null);
  await waitFor(() =>
    expect(screen.queryByText("64.00")).not.toBeInTheDocument(),
  );
});
it("does not show a partial All play total when competitive history fails", async () => {
  mocks.profile.mockResolvedValue([]);
  mocks.history.mockRejectedValue({ message: "League history unavailable" });
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "All play" }));
  await screen.findByText("League history unavailable");
  expect(screen.queryByText("0 league + 0 solo")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Retry solo summary" }),
  ).toBeInTheDocument();
});
it("checks current consent before showing a summary when returning to the same scope", async () => {
  mocks.profile.mockResolvedValueOnce([{
    game_type: "501", board_type: "Steel Tip", preset: "unspecified",
    games: 1, scored: 1, score_sum: 64, best: 64,
  }]);
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "Solo" }));
  await screen.findByText("64.00");
  let finish: (value: null) => void = () => {};
  mocks.profile.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "League" }));
  fireEvent.click(screen.getByRole("button", { name: "Solo" }));
  expect(screen.queryByText("64.00")).not.toBeInTheDocument();
  expect(screen.getByText("Loading scoring summary…")).toBeInTheDocument();
  finish(null);
  await screen.findByText("This player’s solo summary is private.");
  expect(screen.queryByText("64.00")).not.toBeInTheDocument();
});
