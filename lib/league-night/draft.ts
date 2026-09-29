import type { NightDraft } from "./types";
import { defaultConfig } from "@/lib/games/catalog";
import type { Challenge } from "@/lib/rivalries/types";

export function challengeDraft(challenge: Challenge | null): NightDraft {
  if (!challenge) return freshDraft();
  return {
    ...freshDraft(),
    game: challenge.game,
    board: challenge.board,
    gameConfig: { ...defaultConfig(), preset: challenge.preset },
    players: [challenge.sender, challenge.recipient].map((playerId) => ({
      playerId,
      score: "",
      points: "",
    })),
  };
}

export const DRAFT_LIFETIME = 24 * 60 * 60_000;
export type StoredDraft = {
  version: 1;
  savedAt: number;
  tabId: string;
  draft: NightDraft;
};
export type SavedNightEntry = StoredDraft & {
  draft: NightDraft & { recoveredEntryId: string };
};
export function draftKey(
  environment: string,
  userId: string,
  nightId: string,
): string {
  return `rdd:night-draft:v1:${encodeURIComponent(environment)}:${userId}:${nightId}`;
}
export function decodeDraft(
  raw: string | null,
  now = Date.now(),
): StoredDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as StoredDraft;
    const d = data.draft;
    if (
      data.version !== 1 ||
      !Number.isFinite(data.savedAt) ||
      data.savedAt > now + 60_000 ||
      (!d?.pending && now - data.savedAt > DRAFT_LIFETIME) ||
      typeof data.tabId !== "string" ||
      !d
    )
      return null;
    if (
      !Array.isArray(d.players) ||
      d.players.length > 10 ||
      d.players.some(
        (p) =>
          typeof p.playerId !== "string" ||
          typeof p.score !== "string" ||
          typeof p.points !== "string",
      )
    )
      return null;
    if (
      typeof d.winnerId !== "string" ||
      typeof d.game !== "string" ||
      typeof d.board !== "string" ||
      typeof d.notes !== "string" ||
      typeof d.playedAt !== "string" ||
      typeof d.liveTime !== "boolean" ||
      !["3da", "ppd"].includes(d.mode)
    )
      return null;
    if (
      d.pending &&
      (typeof d.pending.operationId !== "string" ||
        !d.pending.payload ||
        !Array.isArray(d.pending.payload.players) ||
        !["rematch", "finish", "edit"].includes(d.pending.intent))
    )
      return null;
    if (
      d.recoveredEntryId != null &&
      (typeof d.recoveredEntryId !== "string" || !d.recoveredEntryId)
    )
      return null;
    if (
      d.original &&
      (typeof d.original.playedAt !== "string" ||
        (d.original.venue !== null && typeof d.original.venue !== "string"))
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
export function freshDraft(): NightDraft {
  return {
    players: [],
    winnerId: "",
    game: "501",
    board: "Soft Tip",
    mode: "3da",
    notes: "",
    playedAt: "",
    liveTime: true,
    editId: null,
    revision: null,
    recoveredEntryId: null,
    original: null,
    pending: null,
  };
}

export function nightOperationKey(key: string, operationId: string) {
  return `${key}:save:${operationId}`;
}
export function nightEntryKey(key: string, entryId: string) {
  return `${key}:entry:${entryId}`;
}

/** A definite no-write outcome is editable, but must not lose its own slot. */
export function retainNightEntry(
  storage: Storage,
  key: string,
  stored: StoredDraft,
): SavedNightEntry {
  const pending = stored.draft.pending;
  if (!pending)
    throw new Error("Only a confirmed no-write submission can be released.");
  const entry: SavedNightEntry = {
    ...stored,
    draft: {
      ...stored.draft,
      pending: null,
      recoveredEntryId: stored.draft.recoveredEntryId ?? pending.operationId,
    },
  };
  // Write first: a full/blocked store must not erase the pending recovery copy.
  storage.setItem(
    nightEntryKey(key, entry.draft.recoveredEntryId),
    JSON.stringify(entry),
  );
  storage.removeItem(nightOperationKey(key, pending.operationId));
  return entry;
}

export function readNightSavedEntries(
  storage: Storage,
  key: string,
  now = Date.now(),
): SavedNightEntry[] {
  const keys = Array.from({ length: storage.length }, (_, i) =>
    storage.key(i),
  ).filter((candidate): candidate is string =>
    Boolean(candidate?.startsWith(key + ":entry:")),
  );
  const entries: SavedNightEntry[] = [];
  for (const candidate of keys) {
    const stored = decodeDraft(storage.getItem(candidate), now);
    if (
      stored &&
      !stored.draft.pending &&
      stored.draft.recoveredEntryId &&
      nightEntryKey(key, stored.draft.recoveredEntryId) === candidate
    )
      entries.push(stored as SavedNightEntry);
    else storage.removeItem(candidate);
  }
  return entries.sort((a, b) => a.savedAt - b.savedAt);
}

export function readNightRecovery(
  storage: Storage,
  key: string,
  now = Date.now(),
): StoredDraft | null {
  const keys = Array.from({ length: storage.length }, (_, i) =>
    storage.key(i),
  ).filter((candidate): candidate is string =>
    Boolean(candidate?.startsWith(key + ":save:")),
  );
  const pending: StoredDraft[] = [];
  for (const candidate of keys) {
    const stored = decodeDraft(storage.getItem(candidate), now);
    if (
      stored?.draft.pending &&
      nightOperationKey(key, stored.draft.pending.operationId) === candidate
    )
      pending.push(stored);
    else storage.removeItem(candidate);
  }
  const raw = storage.getItem(key);
  const draft = decodeDraft(raw, now);
  if (raw && !draft) storage.removeItem(key);
  return pending.sort((a, b) => a.savedAt - b.savedAt)[0] ?? draft;
}
