import { describe, it, expect, vi, beforeEach } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc } }));
import {
  loadRivalryFeed,
  readPending,
  definiteRejection,
  readRecovery,
  operationKey,
} from "./api";
beforeEach(() => rpc.mockReset());
const page = (total: number, offset = 0) => ({
  data: {
    challenges: offset ? [] : [{ id: "challenge" }],
    avatars: Array.from(
      { length: Math.min(500, Math.max(0, total - offset)) },
      (_, i) => ({ user_id: `player-${offset + i}` }),
    ),
    nights: [],
    active_users: [],
    member_total: 0,
    total: 1,
    avatar_total: total,
    night_total: 0,
    server_time: "2026-09-28",
  },
  error: null,
});
describe("complete reads and recovery boundaries", () => {
  it("preserves racing tabs in individual recovery slots", () => {
    localStorage.clear();
    const key = operationKey("a", "room");
    const old = {
      id: "2a84975e-9565-4ee5-8cc2-15df9b5f5934",
      payload: { submitted_by: "a", action: "accept" },
      createdAt: 1,
    };
    const newer = {
      ...old,
      id: "2a84975e-9565-4ee5-8cc2-15df9b5f5935",
      createdAt: 2,
    };
    localStorage.setItem(`${key}:op:${old.id}`, JSON.stringify(old));
    localStorage.setItem(`${key}:op:${newer.id}`, JSON.stringify(newer));
    localStorage.setItem(key, JSON.stringify(newer));
    expect(readRecovery(localStorage, key, "a")).toEqual(old);
    localStorage.removeItem(`${key}:op:${old.id}`);
    expect(readRecovery(localStorage, key, "a")).toEqual(newer);
    localStorage.clear();
  });
  it("pages every collection rather than trusting an API default limit", async () => {
    rpc.mockResolvedValueOnce(page(501)).mockResolvedValueOnce(page(501, 500));
    const feed = await loadRivalryFeed();
    expect(feed.avatars).toHaveLength(501);
    expect(feed.avatars.at(-1)).toEqual({ user_id: "player-500" });
    expect(rpc).toHaveBeenLastCalledWith("rdd_rivalry_read", {
      p_id: null,
      p_offset: 500,
    });
  });
  it("rejects changed total during pagination", async () => {
    rpc.mockResolvedValueOnce(page(501)).mockResolvedValueOnce(page(502, 500));
    await expect(loadRivalryFeed()).rejects.toThrow("changed during loading");
  });
  it("detects a smaller collection changing even when the maximum is stable", async () => {
    const second = page(501, 500);
    second.data.total = 0;
    rpc.mockResolvedValueOnce(page(501)).mockResolvedValueOnce(second);
    await expect(loadRivalryFeed()).rejects.toThrow("changed during loading");
  });
  it("rejects a truncated collection instead of displaying incomplete data", async () => {
    const first = page(501);
    first.data.avatars.pop();
    rpc.mockResolvedValueOnce(first);
    await expect(loadRivalryFeed()).rejects.toThrow("interrupted");
  });
  it("detects rows overlapping between pages", async () => {
    const second = page(501, 500);
    second.data.avatars[0].user_id = "player-0";
    rpc.mockResolvedValueOnce(page(501)).mockResolvedValueOnce(second);
    await expect(loadRivalryFeed()).rejects.toThrow("changed during loading");
  });
  it("validates all totals even if an invalid total is not the maximum", async () => {
    const first = page(501);
    first.data.member_total = -1;
    rpc.mockResolvedValueOnce(first);
    await expect(loadRivalryFeed()).rejects.toThrow("changed during loading");
  });
  it("does not convert a failed read into an empty rivalry", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(loadRivalryFeed()).rejects.toMatchObject({ code: "42501" });
  });
  it("rejects incomplete response envelopes", async () => {
    rpc.mockResolvedValue({ data: { challenges: [] }, error: null });
    await expect(loadRivalryFeed()).rejects.toThrow("interrupted");
  });
  it("scopes stored operations to their authenticated owner", () => {
    const raw = JSON.stringify({
      id: "2a84975e-9565-4ee5-8cc2-15df9b5f5934",
      payload: { submitted_by: "a", action: "accept" },
    });
    expect(readPending(raw, "a")).not.toBeNull();
    expect(readPending(raw, "b")).toBeNull();
    expect(readPending("broken", "a")).toBeNull();
  });
  it("keeps transport and edited-retry conflicts ambiguous", () => {
    expect(definiteRejection({ code: "40001" })).toBe(true);
    expect(definiteRejection({ code: "PT409" })).toBe(false);
    expect(definiteRejection(new Error("timeout"))).toBe(false);
  });
});
