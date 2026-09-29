import type { PlayerProfile } from "@/lib/league-night/types";
export type AvatarChoice = {
  user_id: string;
  avatar_id: string | null;
  revision: number;
};
export type RivalryNight = {
  night_id: string;
  title: string;
  venue: string | null;
  starts_at: string;
  event_revision: number;
};
export type ChallengeState =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "declined"
  | "withdrawn"
  | "expired"
  | "cancelled"
  | "abandoned"
  | "needs_reconfirmation"
  | "needs_review";
export type Challenge = {
  id: string;
  sender: string;
  recipient: string;
  night_id: string;
  game: string;
  preset: string;
  board: string;
  best_of: number;
  state: ChallengeState;
  stored_state: string;
  revision: number;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  event_revision: number;
  sender_confirmed: number | null;
  recipient_confirmed: number | null;
  abandonment_by: string | null;
  abandonment_reason: string | null;
  wins: [number, number];
  target: number;
  winner: string | null;
  games: {
    id: number;
    revision: number;
    played_at: string;
    winner: string | null;
    issue: string | null;
  }[];
  schedule: RivalryNight & { status: "scheduled" | "cancelled" };
};
export type RivalryFeed = {
  organizer: boolean;
  challenges: Challenge[];
  avatars: AvatarChoice[];
  nights: RivalryNight[];
  active_users: string[];
  server_time: string;
};
export type RivalryProfile = PlayerProfile;
export type RivalryRequest = {
  action: string;
  submitted_by: string;
  [key: string]: unknown;
};
export type RivalryReceipt = {
  challenge?: Challenge;
  avatar?: AvatarChoice;
  replayed: boolean;
};
