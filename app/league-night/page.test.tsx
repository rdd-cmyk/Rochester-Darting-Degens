import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LeagueNightPage from "./page";
import { draftKey, freshDraft, nightEntryKey, nightOperationKey, readNightSavedEntries, type StoredDraft } from "@/lib/league-night/draft";
import type { LeagueNight, MatchWrite, NightMatch } from "@/lib/league-night/types";
import { defaultConfig } from "@/lib/games/catalog";

const mocks = vi.hoisted(() => ({ save: vi.fn(), matches: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/lib/league-night/use-current-user", () => ({
  useCurrentUser: () => ({ user: { id: "recorder" }, loading: false }),
}));
vi.mock("@/lib/league-night/match-write", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/league-night/match-write")>()),
  saveMatch: mocks.save,
}));
vi.mock("@/lib/league-night/api", () => ({
  loadNights: async () => [night],
  loadNight: async () => night,
  loadProfiles: async () => ["ace", "bee"].map((id) => ({
    id, display_name: id, first_name: null, include_first_name_in_display: false,
  })),
  loadAttendees: async () => [],
  loadMatches: mocks.matches,
  setAttendance: vi.fn(),
}));

const night: LeagueNight = {
  id: "night", title: "Recovery test night", venue: null,
  night_date: "2026-09-26", created_by: "recorder", created_at: "2026-09-26T20:00:00Z",
};
const key = draftKey("http://127.0.0.1:55421", "recorder", night.id);
function seed(operationId: string, score: string, editId: number | null): StoredDraft {
  const payload: MatchWrite = {
    match_id: editId, expected_revision: editId ? 1 : null, night_id: night.id,
    played_at: "2026-09-26T20:00:00Z", game_type: "501", board_type: "Soft Tip",
    venue: null, notes: null, allow_duplicate: false,
    players: [
      { player_id: "ace", score: Number(score), points_scored: null, is_winner: true },
      { player_id: "bee", score: 50, points_scored: null, is_winner: false },
    ],
  };
  const stored: StoredDraft = {
    version: 1, savedAt: Date.now() - (operationId === "a" ? 2000 : 1000), tabId: "earlier-tab",
    draft: {
      ...freshDraft(), players: [
        { playerId: "ace", score, points: "" }, { playerId: "bee", score: "50", points: "" },
      ], winnerId: "ace", editId, revision: payload.expected_revision,
      playedAt: "2026-09-26T16:00", liveTime: false,
      original: editId ? { playedAt: payload.played_at, venue: null } : null,
      pending: { operationId, payload, intent: editId ? "edit" : "rematch" },
    },
  };
  localStorage.setItem(nightOperationKey(key, operationId), JSON.stringify(stored));
  localStorage.setItem(key, JSON.stringify(stored));
  return stored;
}
async function openRecovery() {
  const view = render(<LeagueNightPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Restore draft" }));
  return view;
}
const scoreInput = () => screen.getAllByRole("textbox", { name: "3DA optional" })[0];

beforeEach(() => {
  delete night.planning_status;
  vi.resetAllMocks();
  localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55421");
  window.history.replaceState({}, "", "/league-night?night=night");
  mocks.matches.mockResolvedValue([]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each(["tied", "abandoned"] as const)("starts a completed rematch after recording a %s game", async (status) => {
  const stored = seed("unrated", "60", null);
  stored.draft.pending = null;
  stored.draft.winnerId = "";
  stored.draft.gameConfig = { ...defaultConfig(), preset: "501-double-v1", status };
  localStorage.removeItem(nightOperationKey(key, "unrated"));
  localStorage.setItem(key, JSON.stringify(stored));
  mocks.save.mockResolvedValue({ status: "saved", match_id: 13, revision: 1, replayed: false });
  await openRecovery();
  fireEvent.click(screen.getByRole("button", { name: "Save & Rematch" }));
  await screen.findByText(/Saved match #13/);
  expect(mocks.save.mock.calls[0][1].game_config.status).toBe(status);
  expect(mocks.save.mock.calls[0][1].players.every((p: {is_winner:boolean}) => !p.is_winner)).toBe(true);
  expect(screen.getByRole("combobox", { name: "Result status" })).toHaveValue("completed");
  expect(screen.getByRole("combobox", { name: "Rule preset" })).toHaveValue("501-double-v1");
  expect(screen.getByRole("button", { name: "Save & Rematch" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "ace is the winner" }));
  fireEvent.click(screen.getByRole("button", { name: "Save & Rematch" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  expect(mocks.save.mock.calls[1][1].game_config.status).toBe("completed");
  expect(mocks.save.mock.calls[1][1].players.filter((p: {is_winner:boolean}) => p.is_winner)).toHaveLength(1);
});

it.each(["/league-night", "/league-night?night=night"])("shows cancellation on %s", async (url) => {
  night.planning_status = "cancelled";
  window.history.replaceState({}, "", url);
  render(<LeagueNightPage />);
  await screen.findByText(url.includes("?") ? "This league night was cancelled." : "Cancelled");
});

it("keeps rejected A's corrections recoverable when another pending save B is restored", async () => {
  seed("a", "88.88", 12);
  seed("b", "60", null);
  mocks.save.mockRejectedValueOnce({ code: "40001", message: "This match changed. Reload it before editing." });
  const first = await openRecovery();
  fireEvent.click(screen.getByRole("button", { name: "Check / retry this save" }));
  await screen.findByText("This match changed. Reload it before editing.");
  expect(scoreInput()).toHaveValue("88.88");
  await waitFor(() => expect(scoreInput()).toBeEnabled());
  first.unmount();

  await openRecovery();
  expect(scoreInput()).toHaveValue("60");
  expect(Object.values(localStorage).some((value) => value.includes("88.88"))).toBe(true);
  mocks.save.mockResolvedValueOnce({ status: "saved", match_id: 13, revision: 3, replayed: true });
  fireEvent.click(screen.getByRole("button", { name: "Check / retry this save" }));
  await screen.findByText(/Saved match #13/);
  fireEvent.click(screen.getByRole("button", { name: "Restore saved entry" }));
  expect(scoreInput()).toHaveValue("88.88");
  expect(scoreInput()).toBeEnabled();
  expect(screen.getByRole("heading", { name: "Edit match #12" })).toBeInTheDocument();
});

it("retains a duplicate-dismissed entry through an unknown replacement and clears it only on confirmation", async () => {
  seed("a", "88.88", null);
  mocks.save.mockResolvedValueOnce({ status: "possible_duplicate", match_ids: [12] });
  await openRecovery();
  fireEvent.click(screen.getByRole("button", { name: "Check / retry this save" }));
  fireEvent.click(await screen.findByRole("button", { name: "Keep existing result" }));
  expect(readNightSavedEntries(localStorage, key)[0].draft.players[0].score).toBe("88.88");
  expect(localStorage.getItem(nightOperationKey(key, "a"))).toBeNull();

  fireEvent.change(scoreInput(), { target: { value: "89.99" } });
  mocks.save.mockRejectedValueOnce(new Error("Response interrupted"));
  fireEvent.click(screen.getByRole("button", { name: "Save & Rematch" }));
  await screen.findByText("Response interrupted");
  const replacementId = mocks.save.mock.calls[1][0];
  expect(replacementId).not.toBe("a");
  expect(readNightSavedEntries(localStorage, key)[0].draft.players[0].score).toBe("89.99");
  expect(screen.getByRole("button", { name: "Discard saved entry" })).toBeDisabled();

  mocks.save.mockResolvedValueOnce({ status: "saved", match_id: 14, revision: 3, replayed: true });
  fireEvent.click(screen.getByRole("button", { name: "Check / retry this save" }));
  await screen.findByText(/Saved match #14/);
  expect(mocks.save.mock.calls[2][0]).toBe(replacementId);
  expect(readNightSavedEntries(localStorage, key)).toEqual([]);
  expect(localStorage.getItem(nightOperationKey(key, replacementId))).toBeNull();
});

it("does not clear a retained correction when an unrelated saved match is edited", async () => {
  const a = seed("a", "88.88", 12);
  const unrelated: NightMatch = {
    id: 44, revision: 5, night_id: night.id, created_by: "recorder",
    played_at: a.draft.pending!.payload.played_at, game_type: "501", board_type: "Soft Tip",
    venue: null, notes: null,
    match_players: a.draft.pending!.payload.players.map((p, index) => ({
      ...p, id: index, score: 60,
      profiles: { display_name: p.player_id, first_name: null, include_first_name_in_display: false },
    })),
  };
  mocks.matches.mockResolvedValue([unrelated]);
  mocks.save.mockRejectedValueOnce({ code: "40001", message: "Stale edit" });
  await openRecovery();
  fireEvent.click(screen.getByRole("button", { name: "Check / retry this save" }));
  await screen.findByText("Stale edit");
  fireEvent.change(scoreInput(), { target: { value: "89.99" } });
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect(scoreInput()).toHaveValue("60");
  mocks.save.mockResolvedValueOnce({ status: "saved", match_id: 44, revision: 8, replayed: false });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText(/Saved match #44/);
  expect(readNightSavedEntries(localStorage, key)[0].draft.players[0].score).toBe("89.99");
  fireEvent.click(screen.getByRole("button", { name: "Restore saved entry" }));
  expect(scoreInput()).toHaveValue("89.99");
  expect(screen.getByRole("heading", { name: "Edit match #12" })).toBeInTheDocument();
});

it("keeps a rejected operation retryable if retaining its unsent entry fails", async () => {
  seed("a", "88.88", 12);
  mocks.save.mockRejectedValue({ code: "40001", message: "Stale edit" });
  await openRecovery();
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, itemKey, value) {
    if (itemKey.includes(":entry:")) throw new Error("Storage full");
    setItem.call(this, itemKey, value);
  });
  fireEvent.click(screen.getByRole("button", { name: "Check / retry this save" }));
  await screen.findByText(/Could not retain this unsaved entry safely/);
  expect(localStorage.getItem(nightOperationKey(key, "a"))).not.toBeNull();
  expect(scoreInput()).toHaveValue("88.88");
  expect(screen.getByRole("button", { name: "Check / retry this save" })).toBeEnabled();
});

it("discards only the confirmed unsent entry and never a different user's record", async () => {
  seed("a", "88.88", 12);
  localStorage.setItem("unrelated-user", "untouched");
  mocks.save.mockRejectedValueOnce({ code: "40001", message: "Stale edit" });
  const first = await openRecovery();
  fireEvent.click(screen.getByRole("button", { name: "Check / retry this save" }));
  await screen.findByText("Stale edit");
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "Discard saved entry" }));
  expect(localStorage.getItem(nightEntryKey(key, "a"))).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Discard saved entry" }));
  expect(localStorage.getItem(nightEntryKey(key, "a"))).toBeNull();
  expect(localStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem("unrelated-user")).toBe("untouched");
  first.unmount();
  render(<LeagueNightPage />);
  await screen.findByRole("heading", { name: night.title });
  expect(screen.queryByRole("button", { name: "Restore draft" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Saved unsent entries" })).not.toBeInTheDocument();
});
