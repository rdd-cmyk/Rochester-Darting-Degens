import { supabase } from "@/lib/supabaseClient";
import type {
  RivalryFeed,
  RivalryRequest,
  RivalryReceipt,
  Challenge,
} from "./types";
export async function loadRivalryFeed(id?: string): Promise<RivalryFeed> {
  const feed: RivalryFeed = {
    organizer: false,
    challenges: [],
    avatars: [],
    nights: [],
    active_users: [],
    server_time: "",
  };
  let total = 1;
  let counts: number[] | undefined;
  for (let offset = 0; offset < total; offset += 500) {
    const { data, error } = await supabase.rpc("rdd_rivalry_read", {
      p_id: id ?? null,
      p_offset: offset,
    });
    if (error) throw error;
    if (
      !data ||
      !Array.isArray(data.challenges) ||
      !Array.isArray(data.avatars) ||
      !Array.isArray(data.nights) ||
      !Array.isArray(data.active_users)
    )
      throw Error("The rivalry response was interrupted.");
    const pageCounts = [
      data.total,
      data.avatar_total,
      data.night_total,
      data.member_total,
    ];
    if (
      pageCounts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
      (counts && pageCounts.some((count, i) => count !== counts![i]))
    )
      throw Error(
        "League data changed during loading. Refresh to get a complete view.",
      );
    counts = pageCounts;
    total = Math.max(...counts);
    const collections = [
      data.challenges,
      data.avatars,
      data.nights,
      data.active_users,
    ];
    if (
      collections.some(
        (rows, i) =>
          rows.length !== Math.min(500, Math.max(0, counts![i] - offset)),
      )
    )
      throw Error(
        "The rivalry response was interrupted. Refresh to try again.",
      );
    feed.challenges.push(...data.challenges);
    feed.avatars.push(...data.avatars);
    feed.nights.push(...data.nights);
    feed.active_users.push(...data.active_users);
    feed.server_time = data.server_time;
    feed.organizer = data.organizer === true;
  }
  // Separate requests can overlap if rows move between pages. Never show a
  // partial league as though it were a complete result.
  const identities = [
    feed.challenges.map((row) => row.id),
    feed.avatars.map((row) => row.user_id),
    feed.nights.map((row) => row.night_id),
    feed.active_users,
  ];
  if (
    identities.some(
      (ids, i) =>
        ids.some((id) => typeof id !== "string" || !id) ||
        new Set(ids).size !== counts![i],
    )
  )
    throw Error(
      "League data changed during loading. Refresh to get a complete view.",
    );
  return feed;
}
export async function loadChallenge(id: string): Promise<Challenge> {
  const feed = await loadRivalryFeed(id);
  const c = feed.challenges.find((c) => c.id === id);
  if (!c) throw Error("This challenge is no longer available.");
  return c;
}
export async function rivalryWrite(
  id: string,
  payload: RivalryRequest,
): Promise<RivalryReceipt> {
  const { data, error } = await supabase.rpc("rdd_rivalry_write", {
    p_operation_id: id,
    p_payload: payload,
  });
  if (error) throw error;
  if (
    !data ||
    typeof data.replayed !== "boolean" ||
    (!data.challenge && !data.avatar)
  )
    throw Error(
      "Save confirmation was interrupted. Check the same operation again.",
    );
  return data;
}
export function rivalryError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (["PGRST202", "42P01", "PGRST205"].includes(e?.code ?? ""))
    return "The Rivalry Room is not available on this site yet.";
  if (e?.code === "42501")
    return "Your league access or permission changed. Sign in and refresh to continue.";
  return (
    e?.message ??
    "Could not reach the league. Your pending action is kept; check it again before making changes."
  );
}
export function definiteRejection(
  error: unknown,
  previouslyDispatched = false,
) {
  const code = (error as { code?: string })?.code ?? "";
  // Admission and endpoint availability are checked before durable receipts.
  // A rejected retry cannot establish that an earlier dispatch did not commit.
  if (previouslyDispatched && ["42501", "PGRST202"].includes(code))
    return false;
  return [
    "22023",
    "22003",
    "22P02",
    "23503",
    "23514",
    "23505",
    "40001",
    "42501",
    "P0002",
    "PGRST202",
  ].includes(code);
}
export type PendingAction = {
  id: string;
  payload: RivalryRequest;
  createdAt?: number;
  dispatched?: boolean;
};
export function operationKey(user: string, scope: string) {
  return `rdd:rivalry:v1:${encodeURIComponent(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "local")}:${user}:${scope}`;
}
export function readPending(
  raw: string | null,
  user: string,
): PendingAction | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return typeof p.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(p.id) &&
      p.payload?.submitted_by === user &&
      typeof p.payload.action === "string"
      ? p
      : null;
  } catch {
    return null;
  }
}
/** Each dispatched attempt has its own slot, so racing tabs cannot erase it. */
export function readRecovery(
  storage: Storage,
  key: string,
  user: string,
): PendingAction | null {
  const records: PendingAction[] = [];
  for (let i = 0; i < storage.length; i++) {
    const candidate = storage.key(i);
    if (candidate?.startsWith(key + ":op:")) {
      const p = readPending(storage.getItem(candidate), user);
      if (p && candidate === `${key}:op:${p.id}`) records.push(p);
    }
  }
  const legacy = readPending(storage.getItem(key), user);
  if (legacy && !records.some((p) => p.id === legacy.id)) records.push(legacy);
  return (
    records.sort(
      (a, b) =>
        (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id),
    )[0] ?? null
  );
}
