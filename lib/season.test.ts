import { describe, expect, it } from "vitest";
import { getSeason } from "./season";

describe("Eastern astronomical season calendar", () => {
  it.each([
    ["2026-03-20T04:00:00Z", "winter", "spring"],
    ["2026-06-21T04:00:00Z", "spring", "summer"],
    ["2026-09-22T04:00:00Z", "summer", "fall"],
    ["2026-12-21T05:00:00Z", "fall", "winter"],
    ["2025-06-20T04:00:00Z", "spring", "summer"],
    ["2027-09-23T04:00:00Z", "summer", "fall"],
    ["2028-03-19T04:00:00Z", "winter", "spring"],
  ])("switches at Eastern midnight on %s", (instant, before, after) => {
    const midnight = new Date(instant);
    expect(getSeason(new Date(midnight.getTime() - 1))).toBe(before);
    expect(getSeason(midnight)).toBe(after);
  });

  it("uses Eastern dates rather than the viewer's offset, including the year boundary", () => {
    expect(getSeason(new Date("2026-09-22T00:30:00Z"))).toBe("summer");
    expect(getSeason(new Date("2026-09-23T09:00:00+09:00"))).toBe("fall");
    expect(getSeason(new Date("2027-01-01T00:00:00Z"))).toBe("winter");
    expect(getSeason(new Date("2028-02-29T17:00:00Z"))).toBe("winter");
  });

  it("keeps a conventional calendar fallback outside the published table", () => {
    expect(getSeason(new Date("2101-10-17T12:00:00Z"))).toBe("fall");
  });
});
