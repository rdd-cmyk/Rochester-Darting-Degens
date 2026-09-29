import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc } }));
import { useRivalryOperation } from "./use-operation";
import { operationKey } from "./api";
beforeEach(() => {
  localStorage.clear();
  rpc.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("retains an unknown action across navigation and checks the exact same attempt", async () => {
  const confirmed = vi.fn();
  rpc.mockRejectedValueOnce(new Error("connection interrupted"));
  const first = renderHook(() => useRivalryOperation("a", "room", confirmed));
  await waitFor(() => expect(first.result.current.ready).toBe(true));
  await act(() =>
    first.result.current.submit({
      action: "accept",
      id: "challenge",
      expected_revision: 1,
    }),
  );
  const original = rpc.mock.calls[0][1];
  expect(first.result.current.pending).not.toBeNull();
  expect(localStorage.getItem(operationKey("a", "room"))).not.toBeNull();
  first.unmount();
  rpc.mockResolvedValueOnce({
    data: {
      avatar: { user_id: "a", avatar_id: "fox", revision: 1 },
      replayed: true,
    },
    error: null,
  });
  const next = renderHook(() => useRivalryOperation("a", "room", confirmed));
  await waitFor(() => expect(next.result.current.pending).not.toBeNull());
  await act(() =>
    next.result.current.submit({ action: "decline", id: "different" }),
  );
  expect(rpc.mock.calls[1][1]).toEqual(original);
  expect(confirmed).toHaveBeenCalledOnce();
  expect(next.result.current.pending).toBeNull();
});
it("clears only definite no-write rejections", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: "40001", message: "changed" },
  });
  const hook = renderHook(() => useRivalryOperation("a", "room", vi.fn()));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  await act(() => hook.result.current.submit({ action: "accept" }));
  expect(hook.result.current.pending).toBeNull();
  expect(localStorage.getItem(operationKey("a", "room"))).toBeNull();
});
it("does not dispatch when durable operation storage fails", async () => {
  const hook = renderHook(() => useRivalryOperation("a", "room", vi.fn()));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("storage full");
  });
  await act(() =>
    hook.result.current.submit({ action: "avatar", avatar_id: "fox" }),
  );
  expect(rpc).not.toHaveBeenCalled();
  expect(hook.result.current.pending).not.toBeNull();
});
it("ignores an old user receipt after its component unmounts", async () => {
  let resolve!: (v: unknown) => void;
  rpc.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const confirmed = vi.fn();
  const hook = renderHook(() => useRivalryOperation("a", "room", confirmed));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  let request!: Promise<void>;
  act(() => {
    request = hook.result.current.submit({
      action: "avatar",
      avatar_id: "fox",
    });
  });
  hook.unmount();
  await act(async () => {
    resolve({
      data: {
        avatar: { user_id: "a", avatar_id: "fox", revision: 1 },
        replayed: false,
      },
      error: null,
    });
    await request;
  });
  expect(confirmed).not.toHaveBeenCalled();
});
