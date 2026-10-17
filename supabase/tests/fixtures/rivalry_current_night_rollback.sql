-- Revert only current-night function changes; preserve all stored data.
BEGIN;
CREATE OR REPLACE FUNCTION rivalry_private.summary(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c rivalry_private.challenges; s rdd_private.planning_schedules; m public.matches; winner uuid;
 a integer:=0; b integer:=0; target integer; invalid integer:=0; extra integer:=0; games jsonb:='[]'; effective text;
BEGIN
 SELECT * INTO c FROM rivalry_private.challenges WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'This challenge is no longer available.' USING ERRCODE='P0002'; END IF;
 SELECT * INTO s FROM rdd_private.planning_schedules WHERE night_id=c.night_id;
 target:=(c.best_of+1)/2;
 FOR m IN SELECT matches.* FROM public.matches matches JOIN rivalry_private.links l ON l.match_id=matches.id
   WHERE l.challenge_id=c.id ORDER BY matches.played_at,matches.id LOOP
   winner:=NULL;
   IF rivalry_private.eligible(m,c) IS NOT TRUE THEN invalid:=invalid+1;
   ELSIF a>=target OR b>=target THEN extra:=extra+1;
   ELSE
     SELECT player_id INTO winner FROM public.match_players WHERE match_id=m.id AND is_winner;
     IF winner=c.sender THEN a:=a+1; ELSE b:=b+1; END IF;
   END IF;
   games:=games||jsonb_build_array(jsonb_build_object('id',m.id,'played_at',m.played_at,'revision',m.revision,'winner',winner,
     'issue',CASE WHEN rivalry_private.eligible(m,c) IS NOT TRUE THEN 'Changed result needs review' WHEN winner IS NULL THEN 'After the deciding game' ELSE NULL END));
 END LOOP;
 effective:=c.state;
 IF c.state='pending' AND (now()>=least(c.expires_at,s.starts_at) OR s.status='cancelled') THEN effective:=CASE WHEN s.status='cancelled' THEN 'cancelled' ELSE 'expired' END;
 ELSIF c.state='accepted' THEN
   IF invalid>0 OR extra>0 THEN effective:='needs_review';
   ELSIF a>=target OR b>=target THEN effective:='completed';
   ELSIF s.status='cancelled' AND a+b=0 THEN effective:='cancelled';
   ELSIF s.status='cancelled' OR c.sender_confirmed IS DISTINCT FROM s.event_revision OR c.recipient_confirmed IS DISTINCT FROM s.event_revision THEN effective:='needs_reconfirmation';
   ELSIF a+b>0 THEN effective:='in_progress'; END IF;
 END IF;
 RETURN to_jsonb(c)||jsonb_build_object('state',effective,'stored_state',c.state,'wins',jsonb_build_array(a,b),'target',target,'games',games,
   'winner',CASE WHEN effective='completed' THEN CASE WHEN a>=target THEN c.sender ELSE c.recipient END ELSE NULL END,
   'schedule',jsonb_build_object('title',(SELECT title FROM public.league_nights WHERE id=c.night_id),'venue',(SELECT venue FROM public.league_nights WHERE id=c.night_id),
     'starts_at',s.starts_at,'status',s.status,'event_revision',s.event_revision));
END $$;

CREATE OR REPLACE FUNCTION public.rdd_rivalry_read(p_id uuid DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM invite_private.require_admission();
 IF p_offset<0 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object(
  'challenges',coalesce((SELECT jsonb_agg(rivalry_private.summary(id) ORDER BY created_at DESC,id) FROM
    (SELECT id,created_at FROM rivalry_private.challenges WHERE p_id IS NULL OR id=p_id ORDER BY created_at DESC,id LIMIT 500 OFFSET p_offset) q),'[]'),
  'total',(SELECT count(*) FROM rivalry_private.challenges WHERE p_id IS NULL OR id=p_id),
  'avatars',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT a.* FROM rivalry_private.avatars a JOIN public.league_members lm ON lm.user_id=a.user_id AND lm.status='active' ORDER BY a.user_id LIMIT 500 OFFSET p_offset) q),'[]'),
  'avatar_total',(SELECT count(*) FROM rivalry_private.avatars a JOIN public.league_members lm ON lm.user_id=a.user_id AND lm.status='active'),
  'nights',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT s.night_id,n.title,n.venue,s.starts_at,s.event_revision FROM rdd_private.planning_schedules s JOIN public.league_nights n ON n.id=s.night_id
    WHERE s.status='scheduled' AND s.starts_at>now() ORDER BY s.starts_at,s.night_id LIMIT 500 OFFSET p_offset) q),'[]'),
  'night_total',(SELECT count(*) FROM rdd_private.planning_schedules WHERE status='scheduled' AND starts_at>now()),
  'active_users',coalesce((SELECT jsonb_agg(user_id ORDER BY user_id) FROM (SELECT user_id FROM public.league_members WHERE status='active' ORDER BY user_id LIMIT 500 OFFSET p_offset) q),'[]'),
  'member_total',(SELECT count(*) FROM public.league_members WHERE status='active'),
  'organizer',EXISTS(SELECT 1 FROM rdd_private.planning_organizers WHERE user_id=auth.uid()),
  'server_time',now());
END $$;

CREATE OR REPLACE FUNCTION public.rdd_rivalry_write(p_operation_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); action text:=p_payload->>'action'; prior rivalry_private.operations;
 c rivalry_private.challenges; s rdd_private.planning_schedules; av rivalry_private.avatars; result jsonb; target uuid;
 effective jsonb; selected text; mid bigint; m public.matches;
BEGIN
 PERFORM invite_private.require_admission();
 IF p_operation_id IS NULL OR jsonb_typeof(p_payload)<>'object' OR p_payload->>'submitted_by' IS DISTINCT FROM actor::text THEN
  RAISE EXCEPTION 'Sign in again before saving.' USING ERRCODE='42501'; END IF;
 -- League-sized write traffic: a single transaction lock gives caps, pair uniqueness,
 -- match linking and correction the same lock order, including concurrent clients.
 PERFORM pg_advisory_xact_lock(hashtextextended('rdd:rivalry:write',0));
 SELECT * INTO prior FROM rivalry_private.operations WHERE operations.actor=auth.uid() AND operation_id=p_operation_id;
 IF FOUND THEN
  IF prior.payload<>p_payload THEN RAISE EXCEPTION 'Earlier attempt has different content. Reconcile it first.' USING ERRCODE='PT409'; END IF;
  result:=prior.result||jsonb_build_object('replayed',true);
  IF result->'challenge'->>'id' IS NOT NULL THEN result:=result||jsonb_build_object('challenge',rivalry_private.summary((result->'challenge'->>'id')::uuid)); END IF;
  IF result ? 'avatar' THEN
   SELECT * INTO av FROM rivalry_private.avatars WHERE user_id=actor;
   result:=result||jsonb_build_object('avatar',to_jsonb(av),'avatar_superseded',av.revision IS DISTINCT FROM (prior.result->'avatar'->>'revision')::integer);
  END IF;
  RETURN result;
 END IF;
 IF action='avatar' THEN
  selected:=p_payload->>'avatar_id';
  IF selected IS NOT NULL AND NOT EXISTS(SELECT 1 FROM rivalry_private.avatar_catalog WHERE id=selected AND selectable) THEN
   RAISE EXCEPTION 'Choose an available avatar.' USING ERRCODE='22023'; END IF;
  SELECT * INTO av FROM rivalry_private.avatars WHERE user_id=actor FOR UPDATE;
  IF coalesce(av.revision,0) IS DISTINCT FROM (p_payload->>'expected_revision')::integer THEN
   RAISE EXCEPTION 'Your avatar changed in another tab. Refresh before choosing again.' USING ERRCODE='40001'; END IF;
  INSERT INTO rivalry_private.avatars(user_id,avatar_id,revision) VALUES(actor,selected,1)
   ON CONFLICT(user_id) DO UPDATE SET avatar_id=excluded.avatar_id,revision=avatars.revision+1 RETURNING * INTO av;
  result:=jsonb_build_object('avatar',to_jsonb(av));
 ELSIF action='create' THEN
  target:=(p_payload->>'id')::uuid;
  SELECT * INTO s FROM rdd_private.planning_schedules WHERE night_id=(p_payload->>'night_id')::uuid FOR UPDATE;
  IF NOT FOUND OR s.status<>'scheduled' OR s.starts_at<=now() THEN RAISE EXCEPTION 'Choose an upcoming scheduled League Night.' USING ERRCODE='22023'; END IF;
  IF (p_payload->>'recipient')::uuid=actor OR NOT EXISTS(SELECT 1 FROM public.league_members lm JOIN public.profiles p ON p.id=lm.user_id WHERE lm.user_id=(p_payload->>'recipient')::uuid AND lm.status='active') THEN
   RAISE EXCEPTION 'Choose a different active league member.' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM rivalry_private.challenges x WHERE x.sender=actor AND x.state='pending' AND x.expires_at>now()
      AND (rivalry_private.summary(x.id)->>'state')='pending')>=3 THEN RAISE EXCEPTION 'You already have three pending invitations.' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM rivalry_private.challenges x WHERE least(x.sender,x.recipient)=least(actor,(p_payload->>'recipient')::uuid)
    AND greatest(x.sender,x.recipient)=greatest(actor,(p_payload->>'recipient')::uuid) AND
    ((x.night_id=s.night_id AND (rivalry_private.summary(x.id)->>'state') IN ('pending','accepted','in_progress','needs_reconfirmation','needs_review'))
     OR (x.state IN ('declined','withdrawn') AND x.updated_at>now()-interval '24 hours'))) THEN
   RAISE EXCEPTION 'An unfinished challenge or a 24-hour invitation cooldown exists for this pair.' USING ERRCODE='22023'; END IF;
  INSERT INTO rivalry_private.challenges(id,sender,recipient,night_id,game,preset,board,best_of,expires_at,event_revision)
   VALUES(target,actor,(p_payload->>'recipient')::uuid,s.night_id,p_payload->>'game',p_payload->>'preset',p_payload->>'board',(p_payload->>'best_of')::integer,
    least(now()+interval '7 days',s.starts_at),s.event_revision) RETURNING * INTO c;
  result:=jsonb_build_object('challenge',rivalry_private.summary(c.id));
 ELSE
  SELECT * INTO c FROM rivalry_private.challenges WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge unavailable.' USING ERRCODE='P0002'; END IF;
  IF actor NOT IN (c.sender,c.recipient) AND NOT (action='resolve' AND EXISTS(SELECT 1 FROM rdd_private.planning_organizers WHERE user_id=actor)) THEN
   RAISE EXCEPTION 'Only participants can change this challenge.' USING ERRCODE='42501'; END IF;
  IF c.revision IS DISTINCT FROM (p_payload->>'expected_revision')::integer THEN RAISE EXCEPTION 'This challenge changed. Refresh before acting.' USING ERRCODE='40001'; END IF;
  SELECT * INTO s FROM rdd_private.planning_schedules WHERE night_id=c.night_id FOR UPDATE;
  effective:=rivalry_private.summary(c.id);
  IF action IN ('accept','reconfirm') AND (SELECT count(*) FROM public.league_members WHERE status='active' AND user_id IN (c.sender,c.recipient))<>2 THEN
   RAISE EXCEPTION 'Both participants must still be active league members.' USING ERRCODE='42501'; END IF;
  IF action IN ('accept','decline','withdraw') THEN
   IF effective->>'state'<>'pending' OR (action IN ('accept','decline') AND actor<>c.recipient) OR (action='withdraw' AND actor<>c.sender) THEN
    RAISE EXCEPTION 'This invitation cannot be changed by you now.' USING ERRCODE='42501'; END IF;
   IF action='accept' AND (p_payload->>'event_revision')::integer IS DISTINCT FROM s.event_revision THEN RAISE EXCEPTION 'The night changed. Review its new details.' USING ERRCODE='40001'; END IF;
   UPDATE rivalry_private.challenges SET state=CASE action WHEN 'accept' THEN 'accepted' WHEN 'decline' THEN 'declined' ELSE 'withdrawn' END,
    accepted_at=CASE WHEN action='accept' THEN now() ELSE NULL END, event_revision=s.event_revision,
    sender_confirmed=CASE WHEN c.event_revision=s.event_revision AND action='accept' THEN s.event_revision END,
    recipient_confirmed=CASE WHEN action='accept' THEN s.event_revision END WHERE id=c.id;
  ELSIF action='reconfirm' THEN
   IF effective->>'state'<>'needs_reconfirmation' OR s.status<>'scheduled' OR (p_payload->>'event_revision')::integer IS DISTINCT FROM s.event_revision THEN
    RAISE EXCEPTION 'Review the latest scheduled night before confirming.' USING ERRCODE='40001'; END IF;
   UPDATE rivalry_private.challenges SET sender_confirmed=CASE WHEN actor=c.sender THEN s.event_revision ELSE sender_confirmed END,
    recipient_confirmed=CASE WHEN actor=c.recipient THEN s.event_revision ELSE recipient_confirmed END WHERE id=c.id;
  ELSIF action='cancel' THEN
   IF c.state<>'accepted' OR jsonb_array_length(effective->'games')>0 THEN RAISE EXCEPTION 'A started series needs agreement to abandon.' USING ERRCODE='22023'; END IF;
   UPDATE rivalry_private.challenges SET state='cancelled' WHERE id=c.id;
  ELSIF action IN ('withdraw_abandon','decline_abandon') THEN
   IF c.state<>'accepted' OR c.abandonment_by IS NULL OR (action='withdraw_abandon' AND actor<>c.abandonment_by) OR (action='decline_abandon' AND actor=c.abandonment_by) THEN
    RAISE EXCEPTION 'Only the appropriate participant can change this proposal.' USING ERRCODE='42501'; END IF;
   UPDATE rivalry_private.challenges SET abandonment_by=NULL,abandonment_reason=NULL WHERE id=c.id;
  ELSIF action IN ('propose_abandon','confirm_abandon','resolve') THEN
   IF c.state<>'accepted' OR effective->>'state'='completed' THEN RAISE EXCEPTION 'This series cannot be abandoned.' USING ERRCODE='22023'; END IF;
   IF action='confirm_abandon' THEN
    IF c.abandonment_by IS NULL OR c.abandonment_by=actor THEN RAISE EXCEPTION 'The other participant must agree.' USING ERRCODE='42501'; END IF;
    UPDATE rivalry_private.challenges SET state='abandoned' WHERE id=c.id;
   ELSE
    IF length(trim(coalesce(p_payload->>'reason',''))) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Give a reason up to 300 characters.' USING ERRCODE='22023'; END IF;
    IF action='resolve' AND NOT EXISTS(SELECT 1 FROM rdd_private.planning_organizers WHERE user_id=actor) THEN RAISE EXCEPTION 'Organizer access required.' USING ERRCODE='42501'; END IF;
    UPDATE rivalry_private.challenges SET abandonment_by=actor,abandonment_reason=trim(p_payload->>'reason'),state=CASE WHEN action='resolve' THEN 'abandoned' ELSE state END WHERE id=c.id;
   END IF;
  ELSIF action IN ('link','unlink') THEN
   mid:=(p_payload->>'match_id')::bigint;
   SELECT * INTO m FROM public.matches WHERE id=mid FOR UPDATE;
   -- Participants own series membership, while the canonical creator retains
   -- sole authority to edit the underlying result through the base recorder.
   IF NOT FOUND THEN RAISE EXCEPTION 'Recorded result unavailable.' USING ERRCODE='P0002'; END IF;
   IF m.revision IS DISTINCT FROM (p_payload->>'match_revision')::integer THEN RAISE EXCEPTION 'The result changed. Review it again.' USING ERRCODE='40001'; END IF;
   IF action='link' THEN
    IF c.state<>'accepted' OR rivalry_private.eligible(m,c) IS NOT TRUE THEN RAISE EXCEPTION 'Result does not match the accepted series terms.' USING ERRCODE='22023'; END IF;
    INSERT INTO rivalry_private.links(match_id,challenge_id,linked_by) VALUES(mid,c.id,actor);
   ELSE
    DELETE FROM rivalry_private.links WHERE match_id=mid AND challenge_id=c.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'This result is not linked here.' USING ERRCODE='22023'; END IF;
   END IF;
  ELSE RAISE EXCEPTION 'Unknown challenge action.' USING ERRCODE='22023'; END IF;
  UPDATE rivalry_private.challenges SET revision=revision+1,updated_at=now() WHERE id=c.id;
  result:=jsonb_build_object('challenge',rivalry_private.summary(c.id));
 END IF;
 INSERT INTO rivalry_private.events(challenge_id,actor,action,detail) VALUES(c.id,actor,action,p_payload-'submitted_by');
 result:=result||jsonb_build_object('replayed',false);
 INSERT INTO rivalry_private.operations(actor,operation_id,payload,result) VALUES(actor,p_operation_id,p_payload,result);
 RETURN result;
END $$;
COMMIT;
