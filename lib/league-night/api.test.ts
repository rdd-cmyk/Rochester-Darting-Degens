import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: mocks }));
import { loadNight, loadNights } from "./api";
const night = { id: "night", title: "Scheduled night" };
beforeEach(() => {
  vi.resetAllMocks();
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: [night], error: null });
  query.single.mockResolvedValue({ data: night, error: null });
  mocks.from.mockReturnValue(query);
  mocks.rpc.mockResolvedValue({ data: { night: "cancelled" }, error: null });
});
it("attaches cancellation to list entries", async () => {
  expect(await loadNights()).toEqual([
    { ...night, planning_status: "cancelled" },
  ]);
  expect(mocks.rpc).toHaveBeenCalledWith("rdd_planning_night_status", {
    p_night_ids: ["night"],
  });
});
it("loads status for a direct link independently of upcoming pagination", async () => {
  expect(await loadNight("night")).toEqual({
    ...night,
    planning_status: "cancelled",
  });
});
it("keeps legacy unscheduled nights", async () => {
  mocks.rpc.mockResolvedValue({ data: {}, error: null });
  expect(await loadNight("night")).toEqual({ ...night, planning_status: null });
});
it("supports a legacy installation without planning", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  expect(await loadNights()).toEqual([night]);
});
it("does not silently hide cancellations when a status read fails", async () => {
  const failure = { code: "42501", message: "Not authorized" };
  mocks.rpc.mockResolvedValue({ data: null, error: failure });
  await expect(loadNight("night")).rejects.toEqual(failure);
});
