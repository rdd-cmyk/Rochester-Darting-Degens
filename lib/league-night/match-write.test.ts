import { describe, expect, it, vi } from "vitest";
import {
  parseCricketPoints,
  parseScore,
  validateMatchWrite,
  saveMatch,
  saveErrorMessage,
  isDefiniteSaveRejection,
} from "./match-write";
import type { MatchWrite } from "./types";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc } }));
const payload: MatchWrite = {
  match_id: null,
  expected_revision: null,
  night_id: null,
  played_at: "2026-09-01T18:00:00Z",
  game_type: "501",
  board_type: "Soft Tip",
  venue: null,
  notes: null,
  allow_duplicate: false,
  players: [
    { player_id: "a", score: 60, points_scored: null, is_winner: true },
    { player_id: "b", score: null, points_scored: null, is_winner: false },
  ],
};
describe("shared match validation", () => {
  it("binds the dispatched payload to the original signed-in user", async () => {
    rpc.mockResolvedValueOnce({
      data: { status: "saved", match_id: 1, revision: 1, replayed: false },
      error: null,
    });
    expect(
      (await saveMatch("operation", payload, "original-user")).status,
    ).toBe("saved");
    expect(rpc).toHaveBeenLastCalledWith("rdd_save_match", {
      p_operation_id: "operation",
      p_payload: { ...payload, submitted_by: "original-user" },
    });
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "40001", message: "changed" },
    });
    await expect(saveMatch("op", payload, "a")).rejects.toEqual({
      code: "40001",
      message: "changed",
    });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(saveMatch("op", payload, "a")).rejects.toThrow("interrupted");
  });
  it("separates acknowledged rejections from unknown save outcomes", () => {
    expect(isDefiniteSaveRejection({ code: "40001" })).toBe(true);
    expect(isDefiniteSaveRejection(new Error("network failure"))).toBe(false);
    expect(isDefiniteSaveRejection({ code: "503" })).toBe(false);
    expect(
      saveErrorMessage({ message: "rdd_save_match absent from schema cache" }),
    ).toContain("not available");
    expect(saveErrorMessage(new Error("review this conflict"))).toBe(
      "review this conflict",
    );
    expect(saveErrorMessage("offline")).toBe("offline");
  });
  it("rejects invalid sizes, missing identities and Cricket points on another format", () => {
    expect(() => validateMatchWrite({ ...payload, players: [] })).toThrow(
      "two to ten",
    );
    expect(() =>
      validateMatchWrite({
        ...payload,
        players: [{ ...payload.players[0], player_id: "" }, payload.players[1]],
      }),
    ).toThrow("different player");
    expect(() =>
      validateMatchWrite({
        ...payload,
        players: [
          { ...payload.players[0], points_scored: 50 },
          payload.players[1],
        ],
      }),
    ).toThrow("only supported");
    expect(
      validateMatchWrite({
        ...payload,
        game_type: "Cricket",
        players: payload.players.map((p) => ({
          ...p,
          score: 3,
          points_scored: 50,
        })),
      }),
    ).toBeTruthy();
    expect(() =>
      validateMatchWrite({ ...payload, venue: "x".repeat(50) }),
    ).toThrow("49");
  });
  it("keeps unrecorded scores absent and converts PPD to stored 3DA", () => {
    expect(parseScore("", "501")).toBeNull();
    expect(parseScore("20.5", "501", "ppd")).toBe(61.5);
  });
  it.each([
    ["0", "Gotcha"],
    ["-1", "301"],
    ["181", "501"],
    ["181", "301"],
    ["9.1", "Cricket"],
    ["3.2", "Other"],
    ["Infinity", "501"],
    ["5abc", "501"],
  ])("rejects invalid %s %s", (score, game) =>
    expect(() => parseScore(score, game)).toThrow(),
  );
  it("preserves exact supported boundaries", () => {
    expect(parseScore("167", "501")).toBe(167);
    expect(parseScore("150.5", "301")).toBe(150.5);
    expect(parseScore("9", "Cricket")).toBe(9);
    expect(parseScore("9999", "Other")).toBe(9999);
  });
  it("allows zero Cricket points with the additive schema", () => {
    expect(parseCricketPoints("")).toBeNull();
    expect(parseCricketPoints("12")).toBe(12);
    expect(parseCricketPoints("0")).toBe(0);
    expect(() => parseCricketPoints("1.5")).toThrow();
  });
  it("accepts summary results without inventing missing scores", () =>
    expect(validateMatchWrite(payload)).toEqual(payload));
  it("rejects duplicate players, missing winner, future time and overlong notes", () => {
    expect(() =>
      validateMatchWrite({
        ...payload,
        players: [payload.players[0], payload.players[0]],
      }),
    ).toThrow();
    expect(() =>
      validateMatchWrite({
        ...payload,
        players: payload.players.map((p) => ({ ...p, is_winner: false })),
      }),
    ).toThrow();
    expect(() =>
      validateMatchWrite({ ...payload, played_at: "2099-01-01T00:00:00Z" }),
    ).toThrow();
    expect(() =>
      validateMatchWrite({ ...payload, notes: "x".repeat(100) }),
    ).toThrow();
  });
});
