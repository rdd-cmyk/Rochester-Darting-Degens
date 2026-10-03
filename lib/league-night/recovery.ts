import { validateMatchWrite } from "./match-write";
import type { MatchWrite } from "./types";
import { DRAFT_LIFETIME } from "./draft";

export type PendingMatchSave = {
  operationId: string;
  payload: MatchWrite;
  dispatched?: boolean;
  released?: boolean;
};
export function pendingSaveKey(prefix: string, operationId: string) {
  return `${prefix}:${operationId}`;
}

/** Each operation has its own record; one tab cannot clear another tab's save. */
function readRecords(
  storage: Storage,
  prefix: string,
  now = Date.now(),
): PendingMatchSave[] {
  const records: (PendingMatchSave & { savedAt: number })[] = [];
  const keys = Array.from({ length: storage.length }, (_, i) =>
    storage.key(i),
  ).filter((key): key is string => Boolean(key?.startsWith(prefix + ":")));
  for (const key of keys) {
    try {
      const value = JSON.parse(storage.getItem(key) ?? "null");
      if (
        !value ||
        typeof value.operationId !== "string" ||
        pendingSaveKey(prefix, value.operationId) !== key ||
        !Number.isFinite(value.savedAt) ||
        value.savedAt > now + 60000 ||
        (value.released === true && now - value.savedAt > DRAFT_LIFETIME)
      )
        throw new Error("Invalid recovery record");
      validateMatchWrite(value.payload, now);
      records.push(value);
    } catch {
      storage.removeItem(key);
    }
  }
  return records.sort((a, b) => a.savedAt - b.savedAt);
}
export function readPendingSaves(
  storage: Storage,
  prefix: string,
  now = Date.now(),
) {
  return readRecords(storage, prefix, now).filter((record) => !record.released);
}
export function readSavedEntries(
  storage: Storage,
  prefix: string,
  now = Date.now(),
) {
  return readRecords(storage, prefix, now).filter((record) => record.released);
}
