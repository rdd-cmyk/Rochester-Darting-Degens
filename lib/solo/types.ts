export type SoloGameType = "501" | "301" | "701" | "Cricket";
export type SoloGame = {
  id: string;
  owner_id: string;
  session_id: string;
  played_at: string;
  completed_at: string | null;
  timezone: string;
  game_type: SoloGameType;
  board_type: "Steel Tip" | "Soft Tip";
  preset: string;
  status: "completed" | "stopped";
  score: number | null;
  score_unit: "3DA" | "PPD" | "MPR";
  raw_total: number | null;
  darts: number | null;
  include_in_stats: boolean;
  night_id: string | null;
  share_with_night: boolean;
  location: string;
  notes: string;
  revision: number;
  deleted_at: string | null;
};
export type SoloWrite = Partial<
  Omit<SoloGame, "owner_id" | "revision" | "deleted_at">
> & {
  action: "save" | "delete" | "restore";
  submitted_by: string;
  id: string;
  expected_revision: number | null;
};
export type SoloReceipt = {
  id: string;
  revision: number;
  replayed: boolean;
  deleted: boolean;
};
export type SoloOperation = {
  operationId: string;
  payload: SoloWrite;
  again: boolean;
};
export type SoloCohort = {
  game_type: string;
  board_type: string;
  preset: string;
  games: number;
  scored: number;
  score_sum: number | null;
  best: number | null;
  raw_games?: number;
  raw_total_sum?: number | null;
  darts_sum?: number | null;
};
export type SoloNightItem = {
  id: string;
  owner_id: string;
  played_at: string;
  game_type: string;
  board_type: string;
  preset: string;
  status: string;
  score: number | null;
  score_unit: string;
  display_name: string | null;
  first_name: string | null;
  include_first_name_in_display: boolean | null;
};
export type SoloFilter = { game: string; board: string; preset: string };
