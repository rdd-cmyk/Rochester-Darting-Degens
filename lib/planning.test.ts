import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));
import {
  ballotConfirmed,
  reconcileBallot,
  type PendingPlanning,
  isPlanningRejection,
  compareDateSupport,
  hasLowerDateSupport,
  type PlanningOption,
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
  it("only acknowledges the submitted draft and never overwrites a newer ballot on replay", () => {
    const poll = { id: "poll", ballot_revision: 0, availability_enabled: true, mine: [], date_responses: {},
      options: [{ id: "date", kind: "date", withdrawn: false }, { id: "venue", kind: "venue", withdrawn: false }] } as unknown as Poll;
    const receipt: PendingPlanning = { id: "operation", actor: "member", action: "vote", payload: {
      poll_id: "poll", revision: 0, options: ["venue"], date_responses: { date: "preferred" } } };
    expect(ballotConfirmed(poll, 0, ["venue"], { date: "preferred" }, receipt)).toBe(true);
    expect(ballotConfirmed(poll, 0, ["venue"], { date: "maybe" }, receipt)).toBe(false);
    expect(ballotConfirmed(poll, 1, ["venue"], { date: "preferred" }, receipt)).toBe(false);
    expect(reconcileBallot(poll, receipt)).toMatchObject({ ballot_revision: 1, mine: ["venue", "date"], date_responses: { date: "preferred" } });
    const newer = { ...poll, ballot_revision: 2, date_responses: { date: "cannot" as const } };
    expect(reconcileBallot(newer, receipt)).toBe(newer);
  });
  it("prioritizes attendance, uses preference for ties, and treats chronology as a display order", () => {
    const a = { votes: 6, starts_at: "2090-10-16", availability: { preferred: 5 } } as PlanningOption;
    const b = { votes: 9, starts_at: "2090-10-17", availability: { preferred: 3 } } as PlanningOption;
    expect(compareDateSupport(a, b)).toBeGreaterThan(0);
    expect(hasLowerDateSupport(a, b)).toBe(true);
    expect(hasLowerDateSupport({ ...a, votes: 9 }, b)).toBe(false);
    expect(compareDateSupport({ ...a, votes: 9 }, b)).toBeLessThan(0);
    expect(hasLowerDateSupport({ ...b, starts_at: "2090-10-18" }, b)).toBe(false);
    expect(compareDateSupport({ ...a, votes: null, availability: null }, { ...b, votes: null, availability: null })).toBeLessThan(0);
  });
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
