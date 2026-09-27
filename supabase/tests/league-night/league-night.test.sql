-- Synthetic local-only fixtures. All writes are rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();
INSERT INTO auth.users(id) VALUES ('aaaaaaaa-0000-4000-8000-000000000001'),('bbbbbbbb-0000-4000-8000-000000000002'),('cccccccc-0000-4000-8000-000000000003');
INSERT INTO public.profiles(id,display_name) VALUES ('aaaaaaaa-0000-4000-8000-000000000001','Synthetic A'),('bbbbbbbb-0000-4000-8000-000000000002','Synthetic B'),('cccccccc-0000-4000-8000-000000000003','Synthetic C');
CREATE FUNCTION pg_temp.payload() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('match_id',null,'expected_revision',null,'night_id','11111111-0000-4000-8000-000000000001',
 'played_at','2026-09-01T18:00:00Z','game_type','501','board_type','Soft Tip','notes','Synthetic transaction test','venue','Local only',
 'players',jsonb_build_array(jsonb_build_object('player_id','aaaaaaaa-0000-4000-8000-000000000001','score',60,'points_scored',null,'is_winner',true),
 jsonb_build_object('player_id','bbbbbbbb-0000-4000-8000-000000000002','score',50,'points_scored',null,'is_winner',false)))
$$;
SELECT ok(to_regclass('public.seasons') IS NULL,'New feature does not depend on deferred statistics schema');
SELECT ok(NOT has_table_privilege('authenticated','rdd_private.match_save_operations','INSERT'),'Clients cannot forge replay records');
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000001',pg_temp.payload())$$,'42501',null,'Signed-out saves are denied');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"aaaaaaaa-0000-4000-8000-000000000001"}',true);
SELECT lives_ok($$SELECT public.rdd_create_night('11111111-0000-4000-8000-000000000001','Synthetic night','Local only','2026-09-01')$$,'Signed-in player can start a night');
SELECT lives_ok($$SELECT public.rdd_create_night('11111111-0000-4000-8000-000000000001','Synthetic night','Local only','2026-09-01')$$,'Night creation retries are idempotent');
SELECT is(public.rdd_set_attendance('11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',true,0)->>'present','true','Attendance can be recorded');
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000020',pg_temp.payload() || '{"submitted_by":"bbbbbbbb-0000-4000-8000-000000000002"}')$$,'42501',null,'An account switch cannot submit another account draft');
SELECT throws_ok($$SELECT public.rdd_set_attendance('11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',false,0)$$,'40001',null,'Stale attendance changes require a refresh');
SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000001',pg_temp.payload())->>'status','saved','Complete match saves');
SELECT is((SELECT count(*)::integer FROM public.match_players WHERE match_id=(SELECT id FROM public.matches WHERE notes='Synthetic transaction test')),2,'Both participant rows are committed');
SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000001',pg_temp.payload())->>'replayed','true','Retry returns original outcome');
SELECT is((SELECT count(*)::integer FROM public.matches WHERE notes='Synthetic transaction test'),1,'Retry does not duplicate match');
SET LOCAL timezone = 'America/New_York';
SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000001',jsonb_set(pg_temp.payload(),'{played_at}','"2026-09-01T14:00:00-04:00"'))->>'replayed','true','Equivalent timestamp retries across request timezones');
SET LOCAL timezone = 'UTC';
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000001',jsonb_set(pg_temp.payload(),'{notes}','"changed"'))$$,'22023',null,'Same save ID with changed content is rejected');
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000002',jsonb_set(pg_temp.payload(),'{players,1,player_id}','"AAAAAAAA-0000-4000-8000-000000000001"'))$$,'22023',null,'Alternate UUID spelling cannot duplicate a player');
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000002',jsonb_set(pg_temp.payload(),'{players,1,is_winner}','true'))$$,'22023',null,'Two winners are rejected');
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000002',jsonb_set(pg_temp.payload(),'{players,0,score}','168'))$$,'22023',null,'Server score bounds are enforced');
SELECT throws_ok($$INSERT INTO public.matches(game_type) VALUES('501')$$,'42501',null,'Legacy split creates are blocked after enforcement');
SELECT throws_ok($$UPDATE public.match_players SET score=20$$,'42501',null,'Direct participant writes cannot bypass revisions');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"bbbbbbbb-0000-4000-8000-000000000002"}',true);
SELECT is((SELECT count(*)::integer FROM public.league_nights WHERE id='11111111-0000-4000-8000-000000000001'),1,'Other signed-in players see the shared night');
SELECT is(public.rdd_set_attendance('11111111-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000003',true,0)->>'present','true','Any signed-in player can add a late arrival');
SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000003',pg_temp.payload() #- '{players,0,points_scored}' #- '{players,1,points_scored}')->>'status','possible_duplicate','Another recorder gets a warning for equivalent omitted/null results');
SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000003',pg_temp.payload() || '{"allow_duplicate":true}'::jsonb)->>'status','saved','Intentional rematch override works for another recorder');
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000004',pg_temp.payload() ||
 jsonb_build_object('match_id',(SELECT min(id) FROM public.matches WHERE notes='Synthetic transaction test'),'expected_revision',1))$$,'42501',null,'Other recorder cannot edit the original match');
RESET ROLE;
CREATE TEMP TABLE before_edit AS SELECT * FROM public.match_players WHERE match_id=(SELECT min(id) FROM public.matches WHERE notes='Synthetic transaction test');
GRANT SELECT ON before_edit TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"aaaaaaaa-0000-4000-8000-000000000001"}',true);
SELECT lives_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000005',pg_temp.payload() ||
 jsonb_build_object('match_id',(SELECT min(id) FROM public.matches WHERE notes='Synthetic transaction test'),
 'expected_revision',(SELECT revision FROM public.matches WHERE id=(SELECT min(id) FROM public.matches WHERE notes='Synthetic transaction test')),'notes','Edited safely'))$$,'Creator can edit complete match');
SELECT is((SELECT array_agg(id ORDER BY id) FROM public.match_players WHERE match_id=(SELECT match_id FROM before_edit LIMIT 1)),(SELECT array_agg(id ORDER BY id) FROM before_edit),'Edit retains participant identities');
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000006',pg_temp.payload() || jsonb_build_object('match_id',(SELECT match_id FROM before_edit LIMIT 1),'expected_revision',1))$$,'40001',null,'Stale edit is rejected');
SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000001',pg_temp.payload())->>'replayed','true','Old committed create replay does not reapply old values');
SELECT is((SELECT notes FROM public.matches WHERE id=(SELECT match_id FROM before_edit LIMIT 1)),'Edited safely','Replay preserves a later edit');
RESET ROLE;
CREATE FUNCTION pg_temp.fail_participant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.score=42.42 THEN RAISE EXCEPTION 'Synthetic participant failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER synthetic_failure BEFORE INSERT OR UPDATE ON public.match_players FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_participant();
CREATE TEMP TABLE before_failure AS SELECT to_jsonb(m) AS row FROM public.matches m WHERE id=(SELECT match_id FROM before_edit LIMIT 1);
GRANT SELECT ON before_failure TO authenticated;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000007',jsonb_set(pg_temp.payload(),'{players,1,score}','42.42') ||
 jsonb_build_object('match_id',(SELECT match_id FROM before_edit LIMIT 1),'expected_revision',(SELECT revision FROM public.matches WHERE id=(SELECT match_id FROM before_edit LIMIT 1)),'notes','Should roll back'))$$,'23514',null,'Injected participant failure aborts the whole edit');
SELECT is((SELECT to_jsonb(m) FROM public.matches m WHERE id=(SELECT match_id FROM before_edit LIMIT 1)),(SELECT row FROM before_failure),'Failed edit restores match metadata and revision');
SELECT is((SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.match_players p WHERE match_id=(SELECT match_id FROM before_edit LIMIT 1)),(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM before_edit p),'Failed edit restores every participant value');
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000008',jsonb_set(pg_temp.payload(),'{players,1,score}','42.42') || '{"allow_duplicate":true}')$$,'23514',null,'Injected failure aborts a new match');
SELECT is((SELECT count(*)::integer FROM public.matches WHERE notes='Synthetic transaction test'),1,'Failed new save leaves no orphan match');
RESET ROLE;
INSERT INTO public.match_players(match_id,player_id,score,is_winner) VALUES((SELECT match_id FROM before_edit LIMIT 1),NULL,20,false);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000009',pg_temp.payload() ||
 jsonb_build_object('match_id',(SELECT match_id FROM before_edit LIMIT 1),'expected_revision',(SELECT revision FROM public.matches WHERE id=(SELECT match_id FROM before_edit LIMIT 1))))$$,'22023',null,'Unidentified legacy participants require review without data loss');
SELECT is((SELECT count(*)::integer FROM public.match_players WHERE match_id=(SELECT match_id FROM before_edit LIMIT 1) AND player_id IS NULL),1,'Unidentified historical row is preserved');
SELECT * FROM finish();
ROLLBACK;
