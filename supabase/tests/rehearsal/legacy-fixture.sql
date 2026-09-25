-- Only in the disposable local rehearsal database, AFTER baseline and BEFORE
-- the additive migration. Not part of the normal post-migration pgTAP suite.
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000099');
insert into public.profiles (id, display_name, first_name, include_first_name_in_display)
values ('00000000-0000-4000-8000-000000000099', 'Legacy fixture', 'Local', false);
insert into public.matches (id, played_at, game_type, created_by, notes, board_type, venue)
values (-990001, '2025-12-01 19:30:00+00', 'Cricket', '00000000-0000-4000-8000-000000000099',
  'Preserve this legacy note', 'Steel-tip', 'Local legacy venue');
insert into public.match_players (id, match_id, player_id, score, points_scored, is_winner)
values (-990001, -990001, '00000000-0000-4000-8000-000000000099', 2.75, 42, true);
-- Preserve complete original row values, not merely row counts.
create schema rdd_rehearsal;
create table rdd_rehearsal.original_profiles as table public.profiles;
create table rdd_rehearsal.original_matches as table public.matches;
create table rdd_rehearsal.original_participants as table public.match_players;
