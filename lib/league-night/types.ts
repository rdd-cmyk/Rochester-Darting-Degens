export type PlayerProfile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  include_first_name_in_display: boolean | null;
};
export type LeagueNight = {
  id: string;
  title: string;
  venue: string | null;
  night_date: string;
  created_by: string;
  created_at: string;
};
export type Attendee = {
  night_id: string;
  player_id: string;
  present: boolean;
  revision: number;
  updated_by: string;
  updated_at: string;
};
export type MatchParticipant = {
  id: number;
  player_id: string;
  score: number | null;
  points_scored: number | null;
  is_winner: boolean | null;
  profiles?: Omit<PlayerProfile, "id"> | Omit<PlayerProfile, "id">[] | null;
};
export type NightMatch = {
  id: number;
  played_at: string;
  game_type: string | null;
  board_type: string | null;
  venue: string | null;
  notes: string | null;
  created_by: string | null;
  night_id: string | null;
  revision: number;
  match_players: MatchParticipant[] | null;
};
export type MatchWrite = {
  match_id: number | null;
  expected_revision: number | null;
  night_id: string | null;
  played_at: string;
  game_type: string | null;
  board_type: string | null;
  venue: string | null;
  notes: string | null;
  players: {
    player_id: string;
    score: number | null;
    points_scored: number | null;
    is_winner: boolean;
  }[];
  allow_duplicate: boolean;
};
export type SaveResult =
  | { status: "saved"; match_id: number; revision: number; replayed: boolean }
  | { status: "possible_duplicate"; match_ids: number[] };
export type PlayerDraft = { playerId: string; score: string; points: string };
export type NightDraft = {
  players: PlayerDraft[];
  winnerId: string;
  game: string;
  board: string;
  mode: "3da" | "ppd";
  notes: string;
  playedAt: string;
  liveTime: boolean;
  editId: number | null;
  revision: number | null;
  // Identifies the independently retained unsent entry being edited, if any.
  // Optional so existing version-1 device drafts remain readable.
  recoveredEntryId?: string | null;
  original: { playedAt: string; venue: string | null } | null;
  pending: {
    operationId: string;
    payload: MatchWrite;
    intent: "rematch" | "finish" | "edit";
  } | null;
};
