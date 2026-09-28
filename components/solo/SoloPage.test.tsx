import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import SoloPage from "./SoloPage";
import { draftStorageKey, retainOperation } from "@/lib/solo/recovery";
const mocks = vi.hoisted(() => ({
  auth: { user: { id: "a" } as { id: string } | null, loading: false },
  write: vi.fn(),
  profile: vi.fn(),
  games: vi.fn(),
  nights: vi.fn(),
  history: vi.fn(),
  visibility: vi.fn(),
  setVisibility: vi.fn(),
}));
vi.mock("@/lib/league-night/use-current-user", () => ({
  useCurrentUser: () => mocks.auth,
}));
vi.mock("@/lib/league-night/api", () => ({ loadMatches: mocks.history }));
vi.mock("@/lib/solo/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/solo/api")>()),
  writeSolo: mocks.write,
  loadSoloGames: mocks.games,
  loadSoloProfile: mocks.profile,
  loadSoloNights: mocks.nights,
  soloVisibility: mocks.visibility,
  setSoloVisibility: mocks.setVisibility,
}));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetAllMocks();
  mocks.auth.user = { id: "a" };
  mocks.games.mockResolvedValue([]);
  mocks.profile.mockResolvedValue([]);
  mocks.nights.mockResolvedValue([]);
  mocks.history.mockResolvedValue([]);
  mocks.visibility.mockResolvedValue(false);
  mocks.write.mockResolvedValue({
    id: "x",
    revision: 1,
    replayed: false,
    deleted: false,
  });
});
describe("Solo Play persistence boundaries", () => {
  it("keeps visibility unconfirmed after an unknown write and failed reconciliation", async () => {
    mocks.visibility
      .mockResolvedValueOnce(false)
      .mockRejectedValue({ message: "Read unavailable" });
    mocks.setVisibility.mockRejectedValue({ message: "Write response lost" });
    render(<SoloPage />);
    await waitFor(() => expect(mocks.visibility).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Your progress" }));
    const sharing = screen.getByLabelText(/Share my solo summaries/);
    await waitFor(() => expect(sharing).not.toBeDisabled());
    fireEvent.click(sharing);
    await screen.findByText(/Profile visibility is unconfirmed/);
    expect(sharing).toBeChecked();
    expect(sharing).toBeDisabled();
  });
  it("does not turn failed history into an empty progress comparison", async () => {
    mocks.games.mockRejectedValue({
      message: "History temporarily unavailable",
    });
    render(<SoloPage />);
    await screen.findByText("History temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Your progress" }));
    expect(
      screen.queryByText("Not enough comparable nights yet."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("0 league + 0 solo")).not.toBeInTheDocument();
    expect(
      screen.getByText(/complete comparison cannot be shown/),
    ).toBeInTheDocument();
  });
  it("shows a signed-out introduction without reading personal data", () => {
    mocks.auth.user = null;
    render(<SoloPage />);
    expect(
      screen.getByRole("link", { name: "Sign in to log a game" }),
    ).toBeInTheDocument();
    expect(mocks.games).not.toHaveBeenCalled();
  });
  it("freezes an interrupted save and replays the exact operation before clearing its score", async () => {
    mocks.write
      .mockRejectedValueOnce({ message: "Network disconnected" })
      .mockResolvedValueOnce({
        id: "x",
        revision: 1,
        replayed: true,
        deleted: false,
      });
    render(<SoloPage />);
    await screen.findByRole("heading", { name: "Get a game in." });
    fireEvent.change(screen.getByLabelText("Game average"), {
      target: { value: "65.4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & play again" }));
    await screen.findByRole("button", { name: "Check / retry save" });
    expect(screen.getByLabelText("Game average")).toBeDisabled();
    const first = mocks.write.mock.calls[0][0];
    expect(first.payload.score).toBe(65.4);
    fireEvent.click(screen.getByRole("button", { name: "Check / retry save" }));
    await screen.findByText(/Previous operation confirmed/);
    expect(mocks.write.mock.calls[1][0]).toEqual(first);
    expect(screen.getByLabelText("Game average")).toHaveValue(null);
  });
  it("keeps an unrelated recovered draft when checking a previous operation", async () => {
    const key = draftStorageKey("a");
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        owner: "a",
        savedAt: Date.now(),
        draft: {
          entryId: "different",
          game: "Cricket",
          board: "Steel Tip",
          preset: "unspecified",
          score: "2.6",
          unit: "MPR",
          status: "completed",
          played: "2026-09-24T19:00",
          completed: "",
          raw: "",
          darts: "",
          include: true,
          night: "",
          share: false,
          notes: "Keep this draft",
          location: "",
          id: null,
          revision: null,
          session: "s",
          original: null,
        },
      }),
    );
    retainOperation("a", {
      operationId: "earlier",
      again: false,
      payload: {
        id: "old",
        action: "save",
        submitted_by: "a",
        expected_revision: null,
        game_type: "501",
        score: 60,
        score_unit: "3DA",
      },
    });
    render(<SoloPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Check / retry save" }),
    );
    await screen.findByText(/Saved · 501/);
    expect(screen.getByLabelText("Game average")).toHaveValue(2.6);
  });
  it("retains an invalid draft on a definite server rejection without blocking corrections", async () => {
    mocks.write.mockRejectedValueOnce({
      code: "22023",
      message: "Check raw totals",
    });
    render(<SoloPage />);
    fireEvent.change(await screen.findByLabelText("Game average"), {
      target: { value: "55" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save game" }));
    await screen.findByText("Check raw totals");
    expect(screen.getByLabelText("Game average")).toHaveValue(55);
    expect(
      screen.queryByRole("button", { name: "Check / retry save" }),
    ).not.toBeInTheDocument();
  });
  it("unmounts private history when the account changes", async () => {
    mocks.games.mockResolvedValue([
      {
        id: "g",
        played_at: "2026-09-24T23:00:00Z",
        game_type: "501",
        board_type: "Steel Tip",
        preset: "unspecified",
        score: 70,
        score_unit: "3DA",
        status: "completed",
        include_in_stats: true,
        notes: "Private first account",
      },
    ]);
    const view = render(<SoloPage />);
    await waitFor(() => expect(mocks.games).toHaveBeenCalledWith("a"));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Private first account");
    mocks.auth.user = null;
    view.rerender(<SoloPage />);
    expect(screen.queryByText("Private first account")).not.toBeInTheDocument();
  });
});
