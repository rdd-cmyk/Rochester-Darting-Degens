-- Run with pg_prove only in the disposable staged rehearsal database.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);
select results_eq('select * from public.profiles order by id',
  'select * from rdd_rehearsal.original_profiles order by id', 'Every original profile value survives');
select results_eq('select id, played_at, game_type, created_by, notes, board_type, venue from public.matches order by id',
  'select * from rdd_rehearsal.original_matches order by id', 'Every original match value survives');
select results_eq('select id, match_id, player_id, score, is_winner, created_at, points_scored from public.match_players order by id',
  'select * from rdd_rehearsal.original_participants order by id', 'Every original participant value survives');
select is((select detail_level from public.matches where id = -990001), 'summary', 'Old match receives summary default');
select is((select entry_source from public.matches where id = -990001), 'manual', 'Old match receives manual source default');
select is((select darts_thrown from public.match_players where id = -990001), null::integer,
  'Old denominator remains unknown, not fabricated');
select is((select count(*)::integer from public.stats_match_facts
  where match_id = -990001 and score = 2.75 and legacy_cricket_points = 42
  and player_id = '00000000-0000-4000-8000-000000000099'), 1,
  'Legacy match relationships survive in the statistics view');
select * from finish();
rollback;
