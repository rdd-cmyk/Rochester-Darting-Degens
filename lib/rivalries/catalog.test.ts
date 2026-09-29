import { it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { AVATARS, initials } from "./catalog";
it("keeps the shipped catalog, server whitelist and optimized files in sync", () => {
  const sql = readFileSync("supabase/tests/fixtures/rivalry_room.sql", "utf8");
  const roster = sql
    .match(/SELECT unnest\(ARRAY\[([^\]]+)\]/)![1]
    .split(",")
    .map((id) => id.trim().slice(1, -1));
  expect(AVATARS.map((a) => a.id)).toEqual(roster);
  expect(new Set(roster).size).toBe(24);
  for (const a of AVATARS) {
    expect(existsSync(`public${a.image}`)).toBe(true);
    expect(existsSync(`public${a.thumbnail}`)).toBe(true);
    expect(existsSync(`public${a.medium}`)).toBe(true);
  }
});
it("handles names with unicode and empty defaults", () => {
  expect(initials("🐻 Player")).toBe("🐻P");
  expect(initials("")).toBe("?");
});
