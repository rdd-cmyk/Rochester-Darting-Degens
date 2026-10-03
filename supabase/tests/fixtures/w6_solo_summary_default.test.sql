-- Synthetic acceptance only; all test records and writes roll back.
BEGIN;
CREATE FUNCTION pg_temp.check_it(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Acceptance failed: %',label; END IF; END $$;
INSERT INTO auth.users(id) VALUES ('f6000000-0000-4000-8000-000000000001'),('f6000000-0000-4000-8000-000000000002'),('f6000000-0000-4000-8000-000000000003');
INSERT INTO public.profiles(id,display_name) VALUES ('f6000000-0000-4000-8000-000000000001','Privacy organizer'),('f6000000-0000-4000-8000-000000000002','Privacy member'),('f6000000-0000-4000-8000-000000000003','Privacy provisional');
INSERT INTO public.league_members(user_id) VALUES ('f6000000-0000-4000-8000-000000000001'),('f6000000-0000-4000-8000-000000000002');
CREATE FUNCTION pg_temp.payload() RETURNS jsonb LANGUAGE sql AS $$
 SELECT '{"action":"save","submitted_by":"f6000000-0000-4000-8000-000000000002","id":"f6000000-0000-4000-8000-000000000020","session_id":"f6000000-0000-4000-8000-000000000021","played_at":"2026-09-29T23:00:00Z","timezone":"America/New_York","game_type":"701","board_type":"Steel Tip","preset":"701-double-v1","status":"completed","score":60,"score_unit":"3DA","include_in_stats":true,"night_id":null,"share_with_night":false}'::jsonb; $$;
SELECT pg_temp.check_it(NOT has_function_privilege('anon','public.rdd_solo_profile(uuid)','EXECUTE'),'anonymous summary RPC denied');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000002"}',true);
SELECT public.rdd_solo_write('f6000000-0000-4000-8000-000000000022',pg_temp.payload());
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.check_it(jsonb_array_length(public.rdd_solo_profile('f6000000-0000-4000-8000-000000000002'))=1,'unset preference shares aggregate by default');
SELECT pg_temp.check_it((SELECT count(*) FROM public.solo_games WHERE owner_id='f6000000-0000-4000-8000-000000000002')=0,'individual history stays private');
SELECT pg_temp.check_it(NOT (public.rdd_solo_profile('f6000000-0000-4000-8000-000000000002')->0 ? 'notes'),'summary omits notes');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000002"}',true);
SELECT public.rdd_set_solo_visibility(false);
SELECT pg_temp.check_it((SELECT share_summary FROM public.solo_preferences WHERE owner_id=auth.uid())=false,'explicit opt-out stored');
SELECT pg_temp.check_it(jsonb_array_length(public.rdd_solo_profile(auth.uid()))=1,'owner retains own summary after opting out');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.check_it(public.rdd_solo_profile('f6000000-0000-4000-8000-000000000002') IS NULL,'saved opt-out respected');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000002"}',true);
SELECT public.rdd_set_solo_visibility(true);
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.check_it(jsonb_array_length(public.rdd_solo_profile('f6000000-0000-4000-8000-000000000002'))=1,'opt-in restores shared summary');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"f6000000-0000-4000-8000-000000000003"}',true);
DO $$ BEGIN PERFORM public.rdd_solo_profile('f6000000-0000-4000-8000-000000000002'); RAISE EXCEPTION 'Provisional summary read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
RESET ROLE;
INSERT INTO public.solo_preferences(owner_id) VALUES('f6000000-0000-4000-8000-000000000001');
SELECT pg_temp.check_it((SELECT share_summary FROM public.solo_preferences WHERE owner_id='f6000000-0000-4000-8000-000000000001')=true,'new preference row defaults on');
ROLLBACK;
SELECT 'W6 solo summary default acceptance passed' AS result;
