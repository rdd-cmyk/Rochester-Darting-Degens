import { expect, it } from "vitest";
import { pendingSaveKey, readPendingSaves, readSavedEntries } from "./recovery";
import {
  freshDraft,
  nightOperationKey,
  readNightRecovery,
  DRAFT_LIFETIME,
} from "./draft";
const payload = {
  match_id: null,
  expected_revision: null,
  night_id: null,
  played_at: "2026-01-01T00:00:00Z",
  game_type: "501",
  board_type: null,
  venue: null,
  notes: null,
  allow_duplicate: false,
  players: [
    { player_id: "a", score: null, points_scored: null, is_winner: true },
    { player_id: "b", score: null, points_scored: null, is_winner: false },
  ],
};
it("preserves simultaneous Match submissions and removes only the acknowledged one", () => {
  const now = Date.now(),
    prefix = "test:classic:user";
  localStorage.clear();
  for (const operationId of ["a", "b"])
    localStorage.setItem(
      pendingSaveKey(prefix, operationId),
      JSON.stringify({ savedAt: now, operationId, payload }),
    );
  localStorage.setItem("another-user", "untouched");
  expect(readPendingSaves(localStorage, prefix)).toHaveLength(2);
  localStorage.removeItem(pendingSaveKey(prefix, "a"));
  expect(readPendingSaves(localStorage, prefix)[0].operationId).toBe("b");
  expect(localStorage.getItem("another-user")).toBe("untouched");
  expect(
    readPendingSaves(localStorage, prefix, now + DRAFT_LIFETIME + 1),
  ).toHaveLength(1);
  localStorage.setItem(
    pendingSaveKey(prefix, "b"),
    JSON.stringify({ savedAt: now, operationId: "b", payload, released: true }),
  );
  expect(readPendingSaves(localStorage, prefix)).toHaveLength(0);
  expect(readSavedEntries(localStorage, prefix)).toHaveLength(1);
  expect(
    readSavedEntries(localStorage, prefix, now + DRAFT_LIFETIME + 1),
  ).toHaveLength(0);
  localStorage.setItem(pendingSaveKey(prefix, "broken"), "bad json");
  expect(readPendingSaves(localStorage, prefix)).toHaveLength(0);
});
it("retains both night operations even when the shared recovery draft changes tabs", () => {
  localStorage.clear();
  const key = "test:night",
    now = Date.now();
  const draft = freshDraft();
  for (const operationId of ["a", "b"]) {
    const stored = {
      version: 1,
      savedAt: now + (operationId === "b" ? 1 : 0),
      tabId: operationId,
      draft: { ...draft, pending: { operationId, payload, intent: "rematch" } },
    };
    localStorage.setItem(
      nightOperationKey(key, operationId),
      JSON.stringify(stored),
    );
    localStorage.setItem(key, JSON.stringify(stored));
  }
  expect(readNightRecovery(localStorage, key)?.draft.pending?.operationId).toBe(
    "a",
  );
  localStorage.removeItem(nightOperationKey(key, "a"));
  expect(readNightRecovery(localStorage, key)?.draft.pending?.operationId).toBe(
    "b",
  );
  expect(
    readNightRecovery(localStorage, key, now + DRAFT_LIFETIME + 10)?.draft
      .pending?.operationId,
  ).toBe("b");
  localStorage.removeItem(nightOperationKey(key, "b"));
  localStorage.setItem(
    key,
    JSON.stringify({
      version: 1,
      savedAt: now,
      tabId: "b",
      draft: freshDraft(),
    }),
  );
  expect(
    readNightRecovery(localStorage, key, now + DRAFT_LIFETIME + 10),
  ).toBeNull();
  expect(localStorage.getItem(key)).toBeNull();
});
