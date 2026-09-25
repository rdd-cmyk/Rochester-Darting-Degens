-- LOCAL ONLY. Synthetic fixtures are rolled back; never run with --linked.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);

select has_table('public', 'seasons', 'Seasons table exists');
select has_column('public', 'matches', 'season_id', 'Matches support seasons');
select has_column('public', 'match_players', 'darts_thrown', 'Raw denominator exists');
select has_view('public', 'stats_match_facts', 'Statistics view exists');
select ok((select reloptions @> array['security_invoker=true'] from pg_class
  where oid = 'public.stats_match_facts'::regclass), 'Statistics view uses caller permissions');
select is((select count(*)::integer from pg_class where oid in (
  'public.profiles'::regclass, 'public.matches'::regclass,
  'public.match_players'::regclass, 'public.seasons'::regclass)
  and relrowsecurity), 4, 'All application tables have RLS');

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000005');
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Local fixture one'),
  ('00000000-0000-4000-8000-000000000002', 'Local fixture two');
insert into public.matches (id, created_by, game_type) values
  (-900001, '00000000-0000-4000-8000-000000000001', '501');
insert into public.match_players (id, match_id, player_id, score, is_winner) values
  (-900001, -900001, '00000000-0000-4000-8000-000000000001', 50, true);
insert into public.seasons (id, name, starts_on) values
  ('00000000-0000-4000-8000-000000000003', 'Local test season', '2026-01-01');

select is((select detail_level from public.matches where id = -900001),
  'summary', 'Legacy-shaped inserts default to summary');
select is((select darts_thrown from public.match_players where id = -900001),
  null::integer, 'Missing raw denominator stays unknown');
select throws_ok($$update public.match_players set darts_thrown = 0 where id = -900001$$,
  '23514', null, 'Zero darts are rejected');
select throws_ok($$update public.match_players set checkout_attempts = 1, checkouts_made = 2 where id = -900001$$,
  '23514', null, 'Checkouts cannot exceed attempts');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.stats_match_facts where match_id = -900001),
  0, 'Anonymous callers cannot read match facts through the view');
select is((select count(*)::integer from public.seasons where id = '00000000-0000-4000-8000-000000000003'),
  1, 'Seasons are publicly readable');
select throws_ok($$insert into public.matches (id, game_type) values (-900002, '501')$$,
  '42501', null, 'Anonymous match creation is denied');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}', true);
select is((select count(*)::integer from public.stats_match_facts where match_id = -900001),
  1, 'Authenticated caller can read match facts');
with changed as (update public.matches set venue = 'Local fixture venue' where id = -900001 returning id)
select is((select count(*)::integer from changed), 1, 'Creator can update own match');
with changed as (update public.match_players set darts_thrown = 30 where id = -900001 returning id)
select is((select count(*)::integer from changed), 1, 'Creator can update own match participant');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002"}', true);
with changed as (update public.matches set venue = 'Forbidden' where id = -900001 returning id)
select is((select count(*)::integer from changed), 0, 'Noncreator cannot update match');
with changed as (update public.match_players set darts_thrown = 60 where id = -900001 returning id)
select is((select count(*)::integer from changed), 0, 'Noncreator cannot update participant');
select throws_ok($$insert into public.match_players (id, match_id, player_id, score)
  values (-900002, -900001, '00000000-0000-4000-8000-000000000002', 40)$$,
  '42501', null, 'Noncreator cannot add a participant to another match');
select throws_ok($$insert into public.seasons (name, starts_on) values ('Forbidden', '2026-01-01')$$,
  '42501', null, 'Authenticated users have no season-write policy');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004"}', true);
with inserted as (insert into public.profiles (id, display_name)
  values ('00000000-0000-4000-8000-000000000004', 'Local creator') returning id)
select is((select count(*)::integer from inserted), 1, 'Authenticated user can create own profile');
with inserted as (insert into public.matches (created_by, game_type, notes)
  values ('00000000-0000-4000-8000-000000000004', '501', 'pgTAP generated ID') returning id)
select ok((select id > 0 from inserted), 'Creator can insert match with sequence-generated ID');
with inserted as (insert into public.match_players (match_id, player_id, score)
  select id, '00000000-0000-4000-8000-000000000004', 45 from public.matches
  where notes = 'pgTAP generated ID' and created_by = '00000000-0000-4000-8000-000000000004'
  returning id)
select ok((select id > 0 from inserted), 'Creator can insert participant with sequence-generated ID');
select throws_ok($$insert into public.profiles (id, display_name)
  values ('00000000-0000-4000-8000-000000000005', 'Spoofed')$$,
  '42501', null, 'Cannot create another user profile');
select throws_ok($$insert into public.matches (created_by, game_type)
  values ('00000000-0000-4000-8000-000000000001', '501')$$,
  '42501', null, 'Cannot spoof the match creator');

reset role;
select * from finish();
rollback;
