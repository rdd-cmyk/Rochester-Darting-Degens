import { beforeEach, describe, it, expect } from "vitest";
import {
  retainOperation,
  readOperations,
  clearOperation,
  draftStorageKey,
  recoveryPrefix,
} from "./recovery";
import type { SoloOperation } from "./types";
const op: SoloOperation = {
  operationId: "operation",
  again: false,
  payload: {
    id: "game",
    action: "delete",
    submitted_by: "a",
    expected_revision: 1,
  },
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
describe("solo device recovery", () => {
  it("separates accounts and keeps exact submitted payloads across draft changes", () => {
    retainOperation("a", op);
    expect(readOperations("a")).toEqual([op]);
    expect(readOperations("b")).toEqual([]);
    expect(draftStorageKey("a")).not.toBe(draftStorageKey("b"));
    clearOperation("a", "operation");
    expect(readOperations("a")).toEqual([]);
  });
  it("ignores malformed and cross-account recovery without deleting evidence", () => {
    localStorage.setItem(recoveryPrefix("a") + "broken", "{");
    localStorage.setItem(
      recoveryPrefix("a") + "wrong",
      JSON.stringify({ ...op, payload: { ...op.payload, submitted_by: "b" } }),
    );
    expect(readOperations("a")).toEqual([]);
    expect(localStorage.length).toBe(2);
  });
  it("keeps one tab draft identity while allowing independently retained operations", () => {
    expect(draftStorageKey("a")).toBe(draftStorageKey("a"));
    retainOperation("a", op);
    retainOperation("a", { ...op, operationId: "another" });
    expect(readOperations("a")).toHaveLength(2);
  });
  it("refuses edited retries and cross-account snapshots before overwriting evidence", () => {
    retainOperation("a", op);
    expect(() =>
      retainOperation("a", {
        ...op,
        payload: { ...op.payload, expected_revision: 2 },
      }),
    ).toThrow(/different content/);
    expect(() => retainOperation("b", op)).toThrow(/another account/);
    expect(readOperations("a")).toEqual([op]);
  });
});
