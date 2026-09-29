-- W2 focused final-state tests, synthetic only, all writes rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select ok((select reloptions @> array['security_invoker=true'] from pg_class
  where oid='public.stats_match_facts'::regclass), 'Final view uses caller privileges');
select ok(not has_table_privilege('anon','public.stats_match_facts','SELECT'), 'No anonymous view grant');
select ok(not has_table_privilege('anon','public.seasons','SELECT'), 'No anonymous season grant');
select ok(has_table_privilege('authenticated','public.stats_match_facts','SELECT'), 'Members may query final view');
select ok(not has_table_privilege('authenticated','public.seasons','INSERT,UPDATE,DELETE,TRUNCATE'), 'No client season administration');
select ok(not has_table_privilege('authenticated','public.stats_match_facts','INSERT,UPDATE,DELETE,TRUNCATE'), 'View is read only');
select ok(not has_table_privilege('authenticated','public.matches','INSERT,UPDATE,DELETE,TRUNCATE'), 'Matches are RPC-only');
select ok(not has_table_privilege('authenticated','public.match_players','INSERT,UPDATE,DELETE,TRUNCATE'), 'Participants are RPC-only');
select ok(not has_function_privilege('authenticated','public.set_matches_updated_at()','EXECUTE'), 'Timestamp trigger is not a callable client function');
select ok(not has_function_privilege('authenticated','invite_private.rdd_save_match(uuid,jsonb)','EXECUTE'), 'Private game-mode recorder is not callable');
select ok(not has_function_privilege('authenticated','rivalry_private.base_save_match(uuid,jsonb)','EXECUTE'), 'Private Rivalry recorder is not callable');
select is((select count(*)::integer from public.seasons), 0, 'Foundation creates no seasons');
select is((select count(*)::integer from information_schema.columns where table_schema='public'
  and table_name='stats_match_facts' and column_name in ('last_name','sex','favorite_checkout','created_by','notes')), 0, 'View omits private/unneeded profile and match fields');

insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000101'), ('00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000103'), ('00000000-0000-4000-8000-000000000104');
insert into public.profiles(id,display_name,last_name,sex) values
 ('00000000-0000-4000-8000-000000000101','Fictional owner','Private','Private'),
 ('00000000-0000-4000-8000-000000000102','Fictional other','Private','Private'),
 ('00000000-0000-4000-8000-000000000103','Fictional provisional','Private','Private'),
 ('00000000-0000-4000-8000-000000000104','Fictional teammate','Private','Private');
insert into public.league_members(user_id) values
 ('00000000-0000-4000-8000-000000000101'), ('00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000104');
insert into public.seasons(id,name,starts_on) values
 ('00000000-0000-4000-8000-000000000105','Fictional season','2026-01-01');
select throws_ok($q$insert into public.seasons(name,starts_on,ends_on) values('Bad','2026-02-01','2026-01-01')$q$,
 '23514',null,'Reversed season dates rejected');
select throws_ok($q$insert into public.seasons(name,starts_on) values(' ','2026-01-01')$q$,
 '23514',null,'Blank season names rejected');
insert into public.seasons(name,starts_on,is_active) values('Fictional active','2026-01-01',true);
select throws_ok($q$insert into public.seasons(name,starts_on,is_active) values('Second active','2026-01-01',true)$q$,
 '23505',null,'At most one active season');

-- SQL helper for a normal current recorder request, never enhanced stat entry.
create function pg_temp.payload() returns jsonb language sql as $$
 select '{"submitted_by":"00000000-0000-4000-8000-000000000101","played_at":"2026-02-01T19:00:00Z","game_type":"501","board_type":"Steel Tip","players":[{"player_id":"00000000-0000-4000-8000-000000000101","is_winner":true,"score":60},{"player_id":"00000000-0000-4000-8000-000000000102","is_winner":false,"score":45}]}'::jsonb;
$$;
create temp table receipts(kind text primary key, payload jsonb, result jsonb);
grant all on receipts to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000101"}',true);
insert into receipts values('create', pg_temp.payload(), public.rdd_save_match('00000000-0000-4000-8000-000000000110',pg_temp.payload()));
select is((select result->>'status' from receipts where kind='create'),'saved','Current save works through complete wrapper chain');
select is(public.rdd_save_match('00000000-0000-4000-8000-000000000110',pg_temp.payload())->>'replayed','true','Exact create retry works');
select is((select (r.result->>'revision')::bigint = m.revision from receipts r join public.matches m
 on m.id=(r.result->>'match_id')::bigint where kind='create'),true,'Receipt contains final revision after participant triggers');
select is((select count(*)::integer from public.stats_match_facts f join receipts r
 on f.match_id=(r.result->>'match_id')::bigint where r.kind='create'),2,'One view row per participant');
select is((select count(*)::integer from public.stats_match_facts f join receipts r
 on f.match_id=(r.result->>'match_id')::bigint where r.kind='create' and f.game_config is null
 and f.season_id is null and f.entry_source='manual' and f.detail_level='summary' and f.updated_at is not null
 and f.darts_thrown is null and f.highest_checkout is null),2,'Current saves retain unknown season/rules/raw stats and truthful defaults');
select is((select count(*)::integer from public.seasons),2,'Active members can read seasons');
select throws_ok($q$insert into public.seasons(name,starts_on) values('Forbidden','2026-01-01')$q$,'42501',null,'Member cannot administer seasons');
select throws_ok($q$update public.matches set entry_source='integration'$q$,'42501',null,'Owner cannot bypass recorder for match metadata');
select throws_ok($q$update public.match_players set darts_thrown=30$q$,'42501',null,'Owner cannot bypass recorder for raw fields');
select throws_ok($q$update public.stats_match_facts set darts_thrown=30$q$,'55000',null,'Joined view cannot be used to write enhanced fields');

reset role;
-- Trusted synthetic fixture only: future individual measurements on retained
-- participants. Current clients cannot perform these writes.
update public.matches set season_id='00000000-0000-4000-8000-000000000105',
 detail_level='enhanced',entry_source='csv',format_best_of=5
 where id=(select (result->>'match_id')::bigint from receipts where kind='create');
update public.match_players set darts_thrown=30,x01_points_scored=501,first_nine_average=90,
 throw_order=1,legs_won=3,legs_lost=2,checkout_attempts=5,checkouts_made=3,highest_checkout=180,
 scores_100_plus=2,scores_140_plus=1,scores_180=0
 where match_id=(select (result->>'match_id')::bigint from receipts where kind='create')
 and player_id='00000000-0000-4000-8000-000000000101';
update public.match_players set darts_thrown=25,legs_lost=3
 where match_id=(select (result->>'match_id')::bigint from receipts where kind='create')
 and player_id='00000000-0000-4000-8000-000000000102';
select is((select highest_checkout::integer from public.stats_match_facts where player_id='00000000-0000-4000-8000-000000000101'),180,'Storage permits open-out finish above double-out ceiling');
select throws_ok($q$update public.match_players set darts_thrown=0 where player_id='00000000-0000-4000-8000-000000000101'$q$,'23514',null,'Known denominator must be positive');
select throws_ok($q$update public.match_players set checkouts_made=6 where player_id='00000000-0000-4000-8000-000000000101'$q$,'23514',null,'Made checkouts cannot exceed known attempts');
select throws_ok($q$update public.match_players set first_nine_average=181 where player_id='00000000-0000-4000-8000-000000000101'$q$,'23514',null,'First-nine average uses a three-dart scale');
select throws_ok($q$update public.match_players set highest_checkout=-1 where player_id='00000000-0000-4000-8000-000000000101'$q$,'23514',null,'Negative checkout rejected');
select throws_ok($q$update public.match_players set scores_180=-1 where player_id='00000000-0000-4000-8000-000000000101'$q$,'23514',null,'Negative achievement count rejected');
select throws_ok($q$update public.matches set format_best_of=0$q$,'23514',null,'Best-of format must be positive');
select throws_ok($q$update public.matches set entry_source='guessed'$q$,'23514',null,'Unsupported provenance rejected');
select throws_ok($q$update public.matches set detail_level='guessed'$q$,'23514',null,'Unsupported detail level rejected');
create temp table preserved as select mp.* from public.match_players mp join receipts r
 on mp.match_id=(r.result->>'match_id')::bigint where r.kind='create';
-- Use a fixed old timestamp so trigger movement is tested inside one transaction
-- (now() is transaction-stable, not a wall clock).
update public.matches set updated_at='2000-01-01';
-- Trigger intentionally overwrites supplied timestamps; it is not client history.
select is((select updated_at from public.matches where id=(select (result->>'match_id')::bigint from receipts where kind='create')),now(),'Timestamp trigger records actual database update');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000101"}',true);
insert into receipts select 'edit', pg_temp.payload() || jsonb_build_object('match_id',(result->>'match_id')::bigint,
 'expected_revision',m.revision,'notes','Fictional correction','entry_source','integration','season_id',null,
 'players', jsonb_set(pg_temp.payload()->'players','{0,darts_thrown}','999'::jsonb)), null
 from receipts r join public.matches m on m.id=(r.result->>'match_id')::bigint where kind='create';
update receipts set result=public.rdd_save_match('00000000-0000-4000-8000-000000000111',payload) where kind='edit';
select is((select result->>'status' from receipts where kind='edit'),'saved','Correction still works with populated future fields');
select is(public.rdd_save_match('00000000-0000-4000-8000-000000000111',(select payload from receipts where kind='edit'))->>'replayed','true','Correction exact replay works');
select is((select (r.result->>'revision')::bigint = m.revision from receipts r join public.matches m
 on m.id=(r.result->>'match_id')::bigint where kind='edit'),true,'Correction receipt has final revision');
select is((select entry_source from public.matches where id=(select (result->>'match_id')::bigint from receipts where kind='create')),'csv','Recorder ignores unsupported provenance payload');
select is((select detail_level from public.matches where id=(select (result->>'match_id')::bigint from receipts where kind='create')),'enhanced','Recorder preserves detail metadata');
select is((select season_id from public.matches where id=(select (result->>'match_id')::bigint from receipts where kind='create')),'00000000-0000-4000-8000-000000000105'::uuid,'Recorder ignores unsupported season payload');
select is((select darts_thrown from public.match_players where match_id=(select (result->>'match_id')::bigint from receipts where kind='create')
 and player_id='00000000-0000-4000-8000-000000000101'),30,'Recorder ignores enhanced payload fields');
select is((select count(*)::integer from public.match_corrections),1,'Correction audit snapshot is recorded');
select is((select previous_players->0->>'darts_thrown' from public.match_corrections), '30','Correction snapshot retains enhanced measurements');
select throws_ok($q$select public.rdd_save_match('00000000-0000-4000-8000-000000000112',(select payload from receipts where kind='edit'))$q$,'40001',null,'Stale revision still fails');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000102"}',true);
select is((select count(*)::integer from public.stats_match_facts where match_id=(select (result->>'match_id')::bigint from receipts where kind='create')),2,'Active nonowner sees league facts');
select throws_ok($q$update public.match_players set darts_thrown=999$q$,'42501',null,'Nonowner cannot write future fields');
select throws_ok($q$select public.rdd_save_match('00000000-0000-4000-8000-000000000113',(select payload || jsonb_build_object('submitted_by','00000000-0000-4000-8000-000000000102','expected_revision',m.revision) from receipts r join public.matches m on m.id=(r.result->>'match_id')::bigint where kind='edit'))$q$,'42501',null,'Nonowner cannot correct canonical result');
reset role;
select results_eq('select id,throw_order,legs_won,legs_lost,darts_thrown,x01_points_scored,cricket_marks,first_nine_average,checkout_attempts,checkouts_made,highest_checkout,scores_100_plus,scores_140_plus,scores_180,cricket_misses,cricket_triple_bull_hits,marks_5_plus,marks_7_plus,marks_9 from public.match_players where match_id=(select (result->>''match_id'')::bigint from receipts where kind=''create'') order by id',
 'select id,throw_order,legs_won,legs_lost,darts_thrown,x01_points_scored,cricket_marks,first_nine_average,checkout_attempts,checkouts_made,highest_checkout,scores_100_plus,scores_140_plus,scores_180,cricket_misses,cricket_triple_bull_hits,marks_5_plus,marks_7_plus,marks_9 from preserved order by id','All retained optional participant fields survive current correction');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000101"}',true);
insert into receipts select 'rules',payload || jsonb_build_object('game_type','301','expected_revision',m.revision),null
 from receipts r join public.matches m on m.id=(r.result->>'match_id')::bigint where kind='edit';
update receipts set result=public.rdd_save_match('00000000-0000-4000-8000-000000000116',payload) where kind='rules';
select is((select result->>'status' from receipts where kind='rules'),'saved','Current rule correction remains supported');
select is((select x01_points_scored from public.match_players where match_id=(select (result->>'match_id')::bigint from receipts where kind='create')
 and player_id='00000000-0000-4000-8000-000000000101'),501,'Current API retains opaque future measurements on rule change; it does not reinterpret them');
insert into receipts select 'replace',jsonb_set(payload || jsonb_build_object('expected_revision',m.revision),'{players,1,player_id}',
 '"00000000-0000-4000-8000-000000000104"'::jsonb),null
 from receipts r join public.matches m on m.id=(r.result->>'match_id')::bigint where kind='rules';
update receipts set result=public.rdd_save_match('00000000-0000-4000-8000-000000000117',payload) where kind='replace';
select is((select result->>'status' from receipts where kind='replace'),'saved','Current participant replacement remains supported');
select is((select count(*)::integer from public.match_players where match_id=(select (result->>'match_id')::bigint from receipts where kind='create')
 and player_id='00000000-0000-4000-8000-000000000102'),0,'Removed participant no longer has a live measurement row');
select is((select darts_thrown from public.match_players where match_id=(select (result->>'match_id')::bigint from receipts where kind='create')
 and player_id='00000000-0000-4000-8000-000000000104'),null::integer,'Replacement participant measurements are unknown, never copied');
select is((select darts_thrown from public.match_players where match_id=(select (result->>'match_id')::bigint from receipts where kind='create')
 and player_id='00000000-0000-4000-8000-000000000101'),30,'Retained owner measurements survive replacement');
select is((select (r.result->>'revision')::bigint=m.revision from receipts r join public.matches m
 on m.id=(r.result->>'match_id')::bigint where kind='replace'),true,'Replacement receipt includes delete/insert revision triggers');
select is((select count(*)::integer from public.match_corrections c,jsonb_array_elements(c.previous_players) p
 where p->>'player_id'='00000000-0000-4000-8000-000000000102' and p->>'darts_thrown'='25'),3,'Owner audit snapshots retain removed fictional measurements');
reset role;

-- A fictional shared team total belongs solely in versioned configuration.
-- No measured personal raw counts are inferred from it.
update rdd_private.game_modes_control set enabled=true;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000101"}',true);
insert into receipts values('team','{"submitted_by":"00000000-0000-4000-8000-000000000101","played_at":"2026-02-02T19:00:00Z","game_type":"501","board_type":"Steel Tip","game_config":{"version":1,"preset":"501-open-v1","format":"2v2","context":"practice","status":"tied","handicap":true,"sides":{"00000000-0000-4000-8000-000000000101":"A","00000000-0000-4000-8000-000000000102":"A","00000000-0000-4000-8000-000000000104":"B","00000000-0000-4000-8000-000000000103":"B"},"teamScores":{"A":60,"B":55},"otherName":"","finish":"ordinary"},"players":[{"player_id":"00000000-0000-4000-8000-000000000101","is_winner":false},{"player_id":"00000000-0000-4000-8000-000000000102","is_winner":false},{"player_id":"00000000-0000-4000-8000-000000000104","is_winner":false},{"player_id":"00000000-0000-4000-8000-000000000103","is_winner":false}]}'::jsonb,null);
update receipts set result=public.rdd_save_match('00000000-0000-4000-8000-000000000114',payload) where kind='team';
select is((select result->>'status' from receipts where kind='team'),'saved','Team practice tie still saves');
select is((select count(*)::integer from public.stats_match_facts f join receipts r on f.match_id=(r.result->>'match_id')::bigint
 where r.kind='team' and f.game_config=r.payload->'game_config'),4,'Complete team/preset/practice/handicap/status context survives');
select is((select count(*)::integer from public.stats_match_facts f join receipts r on f.match_id=(r.result->>'match_id')::bigint
 where r.kind='team' and f.score is null and f.darts_thrown is null and f.x01_points_scored is null),4,'Shared team scores are not personal raw measurements');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000103"}',true);
select is((select count(*)::integer from public.stats_match_facts),0,'Populated view denies provisional identity even if participant');
select is((select count(*)::integer from public.seasons),0,'Populated seasons deny provisional identity');
select throws_ok($q$select public.rdd_save_match('00000000-0000-4000-8000-000000000115',pg_temp.payload())$q$,'42501',null,'Provisional identity cannot save');
reset role;
update public.league_members set status='revoked' where user_id='00000000-0000-4000-8000-000000000101';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000101"}',true);
select is((select count(*)::integer from public.stats_match_facts),0,'Revoked owner cannot read populated view');
select is((select count(*)::integer from public.seasons),0,'Revoked owner cannot read seasons');
select throws_ok($q$select public.rdd_save_match('00000000-0000-4000-8000-000000000110',pg_temp.payload())$q$,'42501',null,'Revoked owner cannot replay prior save');
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($q$select * from public.stats_match_facts$q$,'42501',null,'Anonymous populated view query denied');
select throws_ok($q$select * from public.seasons$q$,'42501',null,'Anonymous populated seasons query denied');
reset role;
select * from finish();
rollback;
