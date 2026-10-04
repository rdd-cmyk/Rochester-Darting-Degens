import { supabase } from "@/lib/supabaseClient";
import type { PlayerProfile } from "@/lib/league-night/types";

export type Scope = "date" | "venue" | "both";
export type DateResponse = "preferred" | "can" | "maybe" | "cannot";
export const DATE_RESPONSES: { value: DateResponse; label: string }[] = [
  { value: "preferred", label: "Preferred" },
  { value: "can", label: "Can attend" },
  { value: "maybe", label: "Maybe" },
  { value: "cannot", label: "Can’t attend" },
];
export type DateAvailability = {
  can: number;
  preferred: number;
  maybe: number;
  cannot: number;
  unknown: number;
};
export type PlanningOption = {
  id: string;
  kind: "date" | "venue";
  starts_at: string | null;
  venue: string | null;
  detail: string;
  suggested_by: string | null;
  withdrawn: boolean;
  votes: number | null;
  availability?: DateAvailability | null;
  is_mine?: boolean;
  suggestion?: boolean;
  author: Omit<PlayerProfile, "id"> | null;
};
export type Poll = {
  id: string;
  title: string;
  scope: Scope;
  status: "draft" | "open" | "closed" | "cancelled" | "scheduled";
  fixed_start: string | null;
  fixed_venue: string | null;
  closes_at: string | null;
  revision: number;
  ballot_revision: number;
  mine: string[];
  date_responses?: Record<string, DateResponse>;
  availability_enabled?: boolean;
  suggestions_used: number;
  voters: number | null;
  options: PlanningOption[];
  pairs: { date_id: string; venue_id: string; support: number }[];
  night_id: string | null;
};
export type ScheduledNight = {
  night_id: string;
  title: string;
  venue: string;
  starts_at: string;
  rsvp_closes_at: string;
  notes: string;
  status: "scheduled" | "cancelled";
  source_poll: string | null;
  override_reason: string;
  revision: number;
  event_revision: number;
  responses: {
    user_id: string;
    going: boolean;
    profile: Omit<PlayerProfile, "id">;
  }[];
  mine: { going: boolean; event_revision: number; revision: number } | null;
};
export type PlanningFeed = {
  organizer: boolean;
  server_now: string;
  polls: Poll[];
  nights: ScheduledNight[];
  poll_total: number;
  night_total: number;
};
export type PlanningAction =
  | "save_poll"
  | "close_poll"
  | "cancel_poll"
  | "vote"
  | "suggest"
  | "withdraw"
  | "schedule"
  | "edit_night"
  | "cancel_night"
  | "rsvp";
export type PendingPlanning = {
  id: string;
  action: PlanningAction;
  payload: Record<string, unknown>;
  actor: string;
};
export async function loadPlanning(
  pollOffset = 0,
  eventOffset = 0,
): Promise<PlanningFeed> {
  const { data, error } = await supabase.rpc("rdd_planning_read", {
    p_poll_offset: pollOffset,
    p_event_offset: eventOffset,
  });
  if (error) throw error;
  return data;
}
export async function writePlanning(request: PendingPlanning) {
  const { data, error } = await supabase.rpc("rdd_planning_write", {
    p_operation_id: request.id,
    p_action: request.action,
    p_payload: { ...request.payload, actor_id: request.actor },
  });
  if (error) throw error;
  return data as { night_id?: string; poll_id?: string; replayed: boolean };
}
export function planningMessage(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === "23505")
    return "That option is already in this poll. Vote for it instead; no suggestion was used.";
  if (
    e.code === "23514" ||
    e.code === "23502" ||
    e.code === "22007" ||
    e.code === "22008"
  )
    return "Check the required fields and their length or date limits.";
  if (e.code === "PGRST202" || e.code === "42P01")
    return "Planning is not available on this server yet.";
  if (isPlanningRejection(error))
    return (
      e.message || "The server rejected this change. Refresh and review it."
    );
  return "Confirmation was interrupted. Check this saved request before making another change.";
}
export function isPlanningRejection(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? "";
  return (
    /^(22|23|42|PT)/.test(code) || ["40001", "40P01", "PGRST202"].includes(code)
  );
}
export function rochesterTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}
/** datetime-local fields intentionally represent Rochester, never browser time. */
export function rochesterInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function optionLabel(option: PlanningOption): string {
  return option.starts_at
    ? rochesterTime(option.starts_at)
    : (option.venue ?? "");
}
/** Attendance first; preferences break ties. Stable chronology never reveals hidden results. */
export function compareDateSupport(a: PlanningOption, b: PlanningOption): number {
  return (b.votes ?? 0) - (a.votes ?? 0) ||
    (b.availability?.preferred ?? 0) - (a.availability?.preferred ?? 0) ||
    (a.starts_at ?? "").localeCompare(b.starts_at ?? "");
}
export function hasLowerDateSupport(selected: PlanningOption, best: PlanningOption): boolean {
  return (selected.votes ?? 0) < (best.votes ?? 0) ||
    (selected.votes === best.votes &&
      (selected.availability?.preferred ?? 0) < (best.availability?.preferred ?? 0));
}
export function pollClosed(poll: Poll, now: number): boolean {
  return (
    poll.status !== "open" ||
    Boolean(poll.closes_at && Date.parse(poll.closes_at) <= now)
  );
}
export function rsvpClosed(night: ScheduledNight, now: number): boolean {
  return (
    night.status === "cancelled" || Date.parse(night.rsvp_closes_at) <= now
  );
}
export function pendingKey(userId: string): string {
  return `rdd-planning-pending-v1:${userId}`;
}
export function readPending(userId: string): PendingPlanning | null {
  const raw = localStorage.getItem(pendingKey(userId));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as PendingPlanning;
  if (
    parsed.actor !== userId ||
    typeof parsed.id !== "string" ||
    !parsed.payload ||
    typeof parsed.action !== "string"
  )
    throw new Error(
      "Stored planning request cannot be read. Keep this browser data and contact the organizer.",
    );
  return parsed;
}
