-- Transactional synthetic regression; leaves no users, nights or challenges.
BEGIN;
DO $test$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); n uuid:=gen_random_uuid();
 c uuid:=gen_random_uuid(); result jsonb; payload jsonb; feed jsonb; failed boolean;
BEGIN
 INSERT INTO auth.users(id,email) VALUES(a,a||'@example.test'),(b,b||'@example.test');
 INSERT INTO public.profiles(id,display_name) VALUES(a,'Window QA A'),(b,'Window QA B') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.league_members(user_id,status) VALUES(a,'active'),(b,'active');
 INSERT INTO public.league_nights(id,title,night_date,created_by) VALUES(n,'Current-night window QA',current_date,a);
 INSERT INTO rdd_private.planning_schedules(night_id,starts_at,rsvp_closes_at) VALUES(n,now()-interval '2 hours',now()-interval '2 hours');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 feed:=public.rdd_rivalry_read();
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(feed->'nights') x WHERE x->>'night_id'=n::text) THEN RAISE EXCEPTION 'Current night missing from feed'; END IF;
 payload:=jsonb_build_object('action','create','submitted_by',a,'id',c,'recipient',b,'night_id',n,'game','501','preset','501-double-v1','board','Steel Tip','best_of',3);
 result:=public.rdd_rivalry_write(gen_random_uuid(),payload)->'challenge';
 IF result->>'state'<>'pending' OR (result->>'expires_at')::timestamptz<>now()+interval '10 hours' THEN RAISE EXCEPTION 'Current-night invitation must stay pending until cutoff'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 result:=public.rdd_rivalry_write(gen_random_uuid(),jsonb_build_object('action','accept','submitted_by',b,'id',c,'expected_revision',1,'event_revision',1))->'challenge';
 IF result->>'state'<>'accepted' THEN RAISE EXCEPTION 'Recipient cannot accept during night'; END IF;
 -- A pending invitation also expires when a reschedule moves the window past.
 UPDATE rivalry_private.challenges SET state='pending',expires_at=now()+interval '7 days' WHERE id=c;
 UPDATE rdd_private.planning_schedules SET starts_at=now()-interval '12 hours',rsvp_closes_at=now()-interval '12 hours' WHERE night_id=n;
 IF rivalry_private.summary(c)->>'state'<>'expired' THEN RAISE EXCEPTION 'Pending invitation did not expire at cutoff'; END IF;
 feed:=public.rdd_rivalry_read();
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(feed->'nights') x WHERE x->>'night_id'=n::text) THEN RAISE EXCEPTION 'Closed night remains selectable'; END IF;
 failed:=false;
 BEGIN
  PERFORM public.rdd_rivalry_write(gen_random_uuid(),payload||jsonb_build_object('submitted_by',b,'recipient',a,'id',gen_random_uuid()));
 EXCEPTION WHEN SQLSTATE '22023' THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Creation allowed at cutoff'; END IF;
 UPDATE rivalry_private.challenges SET state='cancelled' WHERE id=c;
 UPDATE rdd_private.planning_schedules SET starts_at=now()+interval '2 days' WHERE night_id=n;
 result:=public.rdd_rivalry_write(gen_random_uuid(),payload||jsonb_build_object('submitted_by',b,'recipient',a,'id',gen_random_uuid()))->'challenge';
 IF result->>'state'<>'pending' THEN RAISE EXCEPTION 'Upcoming night broken'; END IF;
 UPDATE rdd_private.planning_schedules SET status='cancelled' WHERE night_id=n;
 IF rivalry_private.summary((result->>'id')::uuid)->>'state'<>'cancelled' THEN RAISE EXCEPTION 'Cancelled night invitation still active'; END IF;
 failed:=false;
 BEGIN
  PERFORM public.rdd_rivalry_write(gen_random_uuid(),payload||jsonb_build_object('submitted_by',b,'recipient',a,'id',gen_random_uuid()));
 EXCEPTION WHEN SQLSTATE '22023' THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Cancelled night accepts challenges'; END IF;
END $test$;
SELECT 'current-night create/accept, cutoff, future and cancellation checks passed' AS result;
ROLLBACK;

