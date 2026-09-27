import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));
import {
  isPlanningRejection,
  pendingKey,
  planningMessage,
  pollClosed,
  readPending,
  rochesterInput,
  rochesterTime,
  rsvpClosed,
  type Poll,
  type ScheduledNight,
} from "./planning";
describe("planning contracts", () => {
  beforeEach(() => localStorage.clear());
  it("renders and edits Rochester wall time independent of browser zone", () => {
    expect(rochesterInput("2027-07-01T23:00:00Z")).toBe("2027-07-01T19:00");
    expect(rochesterInput("2027-01-01T23:00:00Z")).toBe("2027-01-01T18:00");
    expect(rochesterTime("2027-07-01T23:00:00Z")).toContain("7:00 PM");
    expect(rochesterInput(null)).toBe("");
  });
  it("closes polls at the exact cutoff and preserves manual-only polls", () => {
    const poll = { status: "open", closes_at: "2027-07-01T20:00:00Z" } as Poll;
    expect(pollClosed(poll, Date.parse(poll.closes_at!) - 1)).toBe(false);
    expect(pollClosed(poll, Date.parse(poll.closes_at!))).toBe(true);
    expect(pollClosed({ ...poll, closes_at: null }, Infinity)).toBe(false);
    expect(pollClosed({ ...poll, status: "closed" }, 0)).toBe(true);
  });
  it("closes cancelled nights and elapsed RSVP deadlines", () => {
    const night = {
      status: "scheduled",
      rsvp_closes_at: "2027-07-01T20:00:00Z",
    } as ScheduledNight;
    expect(rsvpClosed(night, 0)).toBe(false);
    expect(rsvpClosed(night, Date.parse(night.rsvp_closes_at))).toBe(true);
    expect(rsvpClosed({ ...night, status: "cancelled" }, 0)).toBe(true);
  });
  it("only releases known server rejections, not unknown transport failures", () => {
    expect(isPlanningRejection({ code: "40001" })).toBe(true);
    expect(isPlanningRejection({ code: "PT410" })).toBe(true);
    expect(isPlanningRejection({ code: "23505" })).toBe(true);
    expect(isPlanningRejection({ code: "500", message: "timeout" })).toBe(
      false,
    );
    expect(
      isPlanningRejection({
        code: "40003",
        message: "statement completion unknown",
      }),
    ).toBe(false);
    expect(isPlanningRejection(new Error("Failed to fetch"))).toBe(false);
    expect(planningMessage({ code: "23505" })).toContain(
      "no suggestion was used",
    );
  });
  it("keeps pending requests scoped to the account and preserves invalid evidence", () => {
    const request = {
      id: "operation",
      action: "vote",
      actor: "a",
      payload: { options: [] },
    };
    localStorage.setItem(pendingKey("a"), JSON.stringify(request));
    expect(readPending("a")).toEqual(request);
    expect(readPending("b")).toBeNull();
    localStorage.setItem(pendingKey("b"), JSON.stringify(request));
    expect(() => readPending("b")).toThrow();
    expect(localStorage.getItem(pendingKey("b"))).not.toBeNull();
  });
});
