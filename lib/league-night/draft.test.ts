import { expect, it, vi } from "vitest";
import { decodeDraft, draftKey, DRAFT_LIFETIME, freshDraft, nightEntryKey, nightOperationKey, readNightSavedEntries, retainNightEntry, type StoredDraft } from "./draft";
it("scopes recovery by environment, signed-in user and shared night", () => {
  const key = draftKey("https://one.test", "a", "night");
  expect(key).not.toBe(draftKey("https://two.test", "a", "night"));
  expect(key).not.toBe(draftKey("https://one.test", "b", "night"));
  expect(key).not.toBe(draftKey("https://one.test", "a", "other"));
});
it("rejects unsupported shapes and retains an interrupted operation exactly", () => {
  const draft = freshDraft();
  draft.pending = {
    operationId: "operation",
    payload: { players: [] } as never,
    intent: "rematch",
  };
  const stored = { version: 1, savedAt: 1000, tabId: "tab", draft };
  expect(decodeDraft(JSON.stringify(stored), 1001)?.draft.pending).toEqual(
    draft.pending,
  );
  expect(decodeDraft(null)).toBeNull();
  expect(
    decodeDraft(JSON.stringify({ ...stored, savedAt: 999999 }), 1001),
  ).toBeNull();
  expect(
    decodeDraft(
      JSON.stringify({ ...stored, draft: { ...draft, mode: "wrong" } }),
      1001,
    ),
  ).toBeNull();
  expect(
    decodeDraft(
      JSON.stringify({
        ...stored,
        draft: { ...draft, pending: { ...draft.pending, intent: "wrong" } },
      }),
      1001,
    ),
  ).toBeNull();
  expect(
    decodeDraft(
      JSON.stringify({
        ...stored,
        draft: {
          ...draft,
          players: Array.from({ length: 11 }, () => ({
            playerId: "a",
            score: "",
            points: "",
          })),
        },
      }),
      1001,
    ),
  ).toBeNull();
});
it("restores only supported, unexpired drafts", () => {
  const stored = {
    version: 1,
    savedAt: 1000,
    tabId: "tab",
    draft: freshDraft(),
  };
  expect(decodeDraft(JSON.stringify(stored), 1001)).toEqual(stored);
  expect(decodeDraft(JSON.stringify(stored), 1001 + DRAFT_LIFETIME)).toBeNull();
  expect(
    decodeDraft(JSON.stringify({ ...stored, version: 2 }), 1001),
  ).toBeNull();
  expect(decodeDraft("broken", 1001)).toBeNull();
  expect(
    decodeDraft(
      JSON.stringify({ ...stored, draft: { ...stored.draft, players: [{}] } }),
      1001,
    ),
  ).toBeNull();
});

function pendingEntry(): StoredDraft {
  return {
    version: 1, savedAt: 1000, tabId: "tab",
    draft: {
      ...freshDraft(),
      pending: { operationId: "a", payload: { players: [] } as never, intent: "edit" },
    },
  };
}

it("retains no-write entries separately, reuses their identity on rejection and expires them after 24 hours", () => {
  localStorage.clear();
  const stored = pendingEntry();
  localStorage.setItem(nightOperationKey("key", "a"), JSON.stringify(stored));
  const entry = retainNightEntry(localStorage, "key", stored);
  expect(localStorage.getItem(nightOperationKey("key", "a"))).toBeNull();
  expect(entry.draft.recoveredEntryId).toBe("a");
  expect(entry.draft.pending).toBeNull();
  expect(readNightSavedEntries(localStorage, "key", 1001)).toEqual([entry]);
  expect(readNightSavedEntries(localStorage, "other-user", 1001)).toEqual([]);

  const again = { ...entry, draft: { ...entry.draft, pending: { ...stored.draft.pending!, operationId: "b" } } };
  retainNightEntry(localStorage, "key", again);
  expect(readNightSavedEntries(localStorage, "key", 1001)).toHaveLength(1);
  expect(readNightSavedEntries(localStorage, "key", 1001 + DRAFT_LIFETIME)).toEqual([]);
  expect(localStorage.getItem(nightEntryKey("key", "a"))).toBeNull();
});

it("does not erase the submitted recovery record when retaining the rejected entry fails", () => {
  const storage = { setItem: vi.fn(() => { throw new Error("quota"); }), removeItem: vi.fn() };
  expect(() => retainNightEntry(storage as unknown as Storage, "key", pendingEntry())).toThrow("quota");
  expect(storage.removeItem).not.toHaveBeenCalled();
  const noSubmission = { ...pendingEntry(), draft: freshDraft() };
  expect(() => retainNightEntry(storage as unknown as Storage, "key", noSubmission)).toThrow(/no-write/);
});

it("ignores damaged/mismatched retained entries without touching pending operations", () => {
  localStorage.clear();
  const pending = pendingEntry();
  localStorage.setItem(nightOperationKey("key", "a"), JSON.stringify(pending));
  localStorage.setItem(nightEntryKey("key", "bad-json"), "broken");
  localStorage.setItem(nightEntryKey("key", "still-pending"), JSON.stringify(pending));
  localStorage.setItem(nightEntryKey("key", "mismatch"), JSON.stringify({ ...pending, draft: { ...freshDraft(), recoveredEntryId: "a" } }));
  expect(readNightSavedEntries(localStorage, "key", 1001)).toEqual([]);
  expect(localStorage.length).toBe(1);
  for (const recoveredEntryId of [42, ""]) {
    expect(decodeDraft(JSON.stringify({ ...pending, draft: { ...freshDraft(), recoveredEntryId } }), 1001)).toBeNull();
  }
});
