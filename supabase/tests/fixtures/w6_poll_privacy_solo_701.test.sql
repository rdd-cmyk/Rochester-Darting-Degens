-- Synthetic acceptance only; all test records and writes roll back.
BEGIN;
CREATE FUNCTION pg_temp.check_it(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Acceptance failed: %',label; END IF; END $$;
INSERT INTO auth.users(id) VALUES ('f6000000-0000-4000-8000-000000000001'),('f6000000-0000-4000-8000-000000000002'),('f6000000-0000-4000-8000-000000000003');
INSERT INTO public.profiles(id,display_name) VALUES ('f6000000-0000-4000-8000-000000000001','Privacy organizer'),('f6000000-0000-4000-8000-000000000002','Privacy member'),('f6000000-0000-4000-8000-000000000003','Privacy provisional');
INSERT INTO public.league_members(user_id) VALUES ('f6000000-0000-4000-8000-000000000001'),('f6000000-0000-4000-8000-000000000002');
INSERT INTO rdd_private.planning_organizers(user_id) VALUES ('f6000000-0000-4000-8000-000000000001');
INSERT INTO rdd_private.planning_polls(id,title,scope,status,published_at,closes_at,created_by,created_at)
 VALUES ('f6000000-0000-4000-8000-000000000010','Privacy acceptance','venue','open',now(),now()+interval '1 day','f6000000-0000-4000-8000-000000000001',now()+interval '1 minute');
INSERT INTO rdd_private.planning_options(id,poll_id,kind,venue,suggested_by) VALUES
 ('f6000000-0000-4000-8000-000000000011','f6000000-0000-4000-8000-000000000010','venue','Synthetic hall','f6000000-0000-4000-8000-000000000002');
INSERT INTO rdd_private.planning_votes(poll_id,option_id,user_id) VALUES
 ('f6000000-0000-4000-8000-000000000010','f6000000-0000-4000-8000-000000000011','f6000000-0000-4000-8000-000000000002');
CREATE FUNCTION pg_temp.poll() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_path_query_first(public.rdd_planning_read(),'$.polls[*] ? (@.id == "f6000000-0000-4000-8000-000000000010")'); $$;
CREATE FUNCTION pg_temp.payload() RETURNS jsonb LANGUAGE sql AS $$
 SELECT '{"action":"save","submitted_by":"f6000000-0000-4000-8000-000000000002","id":"f6000000-0000-4000-8000-000000000020","session_id":"f6000000-0000-4000-8000-000000000021","played_at":"2026-09-29T23:00:00Z","timezone":"America/New_York","game_type":"701","board_type":"Steel Tip","preset":"701-double-v1","status":"completed","score":60,"score_unit":"3DA","include_in_stats":true,"night_id":null,"share_with_night":false}'::jsonb; $$;
SELECT pg_temp.check_it(NOT has_function_privilege('authenticated','invite_private.rdd_planning_read(integer,integer)','EXECUTE'),'private planning implementation inaccessible');
SELECT pg_temp.check_it(NOT has_table_privilege('authenticated','rdd_private.planning_votes','SELECT'),'raw ballots inaccessible');
SELECT pg_temp.check_it(NOT has_table_privilege('authenticated','rdd_private.planning_options','SELECT'),'raw suggestion authors inaccessible');
SELECT pg_temp.check_it(NOT has_function_privilege('anon','public.rdd_solo_write(uuid,jsonb)','EXECUTE'),'anonymous solo writer inaccessible');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->'votes'='null'::jsonb,'member option total masked');
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->'author'='null'::jsonb,'member suggestion author masked');
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->'suggested_by'='null'::jsonb,'member suggestion UUID masked');
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->>'is_mine'='true','own withdrawal marker retained');
SELECT pg_temp.check_it(pg_temp.poll()->>'voters'='1','participation count remains visible');
SELECT pg_temp.check_it(pg_temp.poll()->'pairs'='[]'::jsonb,'member overlap totals remain private');
SELECT pg_temp.check_it(public.rdd_solo_write('f6000000-0000-4000-8000-000000000022',pg_temp.payload())->>'revision'='1','701 saved with explicit preset');
SELECT pg_temp.check_it(public.rdd_solo_write('f6000000-0000-4000-8000-000000000022',pg_temp.payload())->>'replayed'='true','701 exact retry does not duplicate');
SELECT pg_temp.check_it(public.rdd_solo_write('f6000000-0000-4000-8000-000000000025',pg_temp.payload() || '{"id":"f6000000-0000-4000-8000-000000000024","preset":"unspecified"}'::jsonb)->>'revision'='1','701 UI default unspecified rules supported');
SELECT pg_temp.check_it((SELECT count(*) FROM public.solo_games WHERE id='f6000000-0000-4000-8000-000000000020' AND game_type='701')=1,'701 persisted once');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->>'votes'='1','organizer sees open totals');
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->>'suggested_by'='f6000000-0000-4000-8000-000000000002','organizer sees suggestion UUID');
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->'author'->>'display_name'='Privacy member','organizer sees author');
SELECT pg_temp.check_it((SELECT count(*) FROM public.solo_games WHERE id='f6000000-0000-4000-8000-000000000020')=0,'other member cannot see private 701 game');
RESET ROLE;
UPDATE rdd_private.planning_polls SET closes_at=now()-interval '1 minute' WHERE id='f6000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.check_it(pg_temp.poll()->>'status'='closed' AND pg_temp.poll()->'options'->0->>'votes'='1','automatic closure reveals total');
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->'author'->>'display_name'='Privacy member','automatic closure reveals author');
RESET ROLE;
UPDATE rdd_private.planning_polls SET status='closed',closes_at=NULL WHERE id='f6000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->>'votes'='1','manual closure reveals total');
SELECT pg_temp.check_it(pg_temp.poll()->'options'->0->>'suggested_by'='f6000000-0000-4000-8000-000000000002','manual closure reveals author UUID');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000003"}',true);
DO $$ BEGIN PERFORM public.rdd_planning_read(); RAISE EXCEPTION 'Provisional planning read incorrectly allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN PERFORM public.rdd_solo_write('f6000000-0000-4000-8000-000000000023',pg_temp.payload()); RAISE EXCEPTION 'Provisional solo write incorrectly allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
RESET ROLE;
ROLLBACK;
SELECT 'W6 poll privacy / 701 acceptance passed' AS result;
