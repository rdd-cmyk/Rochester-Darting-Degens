-- Local rehearsal only. Apply after invitations, planning and game modes.
-- This file is intentionally outside deployable migrations.
BEGIN;
CREATE SCHEMA IF NOT EXISTS rivalry_private;
REVOKE ALL ON SCHEMA rivalry_private FROM PUBLIC, anon, authenticated;
CREATE TABLE rivalry_private.avatar_catalog(id text PRIMARY KEY, selectable boolean NOT NULL DEFAULT true);
INSERT INTO rivalry_private.avatar_catalog(id) SELECT unnest(ARRAY['raccoon','fox','bull','owl','robot','skeleton','badger','panther','bear','crocodile','octopus','rabbit','wolf','red-panda','eagle','pig','alien','shark','tiger','bulldog','penguin','lion','tortoise','cat','cactus','gorilla','dragon']);
CREATE TABLE rivalry_private.avatars (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  avatar_id text REFERENCES rivalry_private.avatar_catalog(id), revision integer NOT NULL DEFAULT 1
);
CREATE TABLE rivalry_private.challenges (
  id uuid PRIMARY KEY, sender uuid NOT NULL REFERENCES public.profiles(id), recipient uuid NOT NULL REFERENCES public.profiles(id),
  night_id uuid NOT NULL REFERENCES public.league_nights(id), game text NOT NULL CHECK(game IN ('301','501','Cricket')),
  preset text NOT NULL, board text NOT NULL CHECK(board IN ('Soft Tip','Steel Tip')), best_of integer NOT NULL CHECK(best_of IN (3,5,7)),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','declined','withdrawn','cancelled','abandoned')),
  revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, accepted_at timestamptz, event_revision integer NOT NULL,
  sender_confirmed integer, recipient_confirmed integer, abandonment_by uuid, abandonment_reason text,
  CHECK(sender<>recipient), CHECK((game='Cricket' AND preset='cricket-v1') OR (game IN ('301','501') AND preset IN (game||'-double-v1',game||'-open-v1',game||'-dido-v1',game||'-master-v1')))
);
CREATE INDEX ON rivalry_private.challenges(sender,recipient,night_id);
CREATE TABLE rivalry_private.links (
  match_id bigint PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES rivalry_private.challenges(id), linked_by uuid NOT NULL, linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON rivalry_private.links(challenge_id);
CREATE TABLE rivalry_private.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, challenge_id uuid REFERENCES rivalry_private.challenges(id),
  actor uuid, action text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rivalry_private.operations (
  actor uuid NOT NULL, operation_id uuid NOT NULL, payload jsonb NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor,operation_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA rivalry_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rivalry_private FROM PUBLIC, anon, authenticated;
ALTER TABLE rivalry_private.avatar_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivalry_private.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivalry_private.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivalry_private.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivalry_private.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivalry_private.operations ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION rivalry_private.eligible(m public.matches,c rivalry_private.challenges) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT m.night_id=c.night_id AND m.game_type=c.game AND m.board_type=c.board
 AND m.played_at>=c.accepted_at AND m.game_config->>'preset'=c.preset
 AND m.game_config->>'format'='individual' AND m.game_config->>'context'='competitive'
 AND m.game_config->>'status'='completed' AND m.game_config->>'handicap'='false'
 AND (SELECT count(*)=2 AND count(DISTINCT player_id)=2 AND count(*) FILTER(WHERE is_winner)=1
       AND bool_and(player_id IN (c.sender,c.recipient) AND is_winner IS NOT NULL) FROM public.match_players WHERE match_id=m.id)
$$;

CREATE FUNCTION rivalry_private.summary(p_id uuid) RETURNS jsonb
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

CREATE FUNCTION public.rdd_avatar_read(p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM invite_private.require_admission();
 IF p_offset<0 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('avatars',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM
  (SELECT a.* FROM rivalry_private.avatars a JOIN public.league_members lm ON lm.user_id=a.user_id AND lm.status='active' ORDER BY a.user_id LIMIT 500 OFFSET p_offset) q),'[]'),
  'total',(SELECT count(*) FROM rivalry_private.avatars a JOIN public.league_members lm ON lm.user_id=a.user_id AND lm.status='active'));
END $$;
CREATE FUNCTION public.rdd_avatar_self() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM invite_private.require_admission();
 RETURN coalesce((SELECT to_jsonb(a) FROM rivalry_private.avatars a WHERE user_id=auth.uid()),jsonb_build_object('user_id',auth.uid(),'avatar_id',NULL,'revision',0));
END $$;
CREATE FUNCTION public.rdd_rivalry_read(p_id uuid DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb
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

CREATE FUNCTION public.rdd_rivalry_write(p_operation_id uuid,p_payload jsonb) RETURNS jsonb
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

-- Preserve the existing recorder, validation, admission, corrections and receipts.
ALTER FUNCTION public.rdd_save_match(uuid,jsonb) SET SCHEMA rivalry_private;
ALTER FUNCTION rivalry_private.rdd_save_match(uuid,jsonb) RENAME TO base_save_match;
CREATE FUNCTION public.rdd_save_match(p_operation_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); cid uuid; c rivalry_private.challenges; prior rivalry_private.operations;
 result jsonb; m public.matches; existing_link uuid;
BEGIN
 PERFORM invite_private.require_admission();
 PERFORM pg_advisory_xact_lock(hashtextextended('rdd:rivalry:write',0));
 IF p_payload->>'submitted_by' IS DISTINCT FROM actor::text OR p_operation_id IS NULL THEN RAISE EXCEPTION 'Sign in again.' USING ERRCODE='42501'; END IF;
 SELECT * INTO prior FROM rivalry_private.operations WHERE operations.actor=auth.uid() AND operation_id=p_operation_id;
 IF FOUND THEN
  IF prior.payload<>p_payload THEN RAISE EXCEPTION 'Earlier attempt has different content.' USING ERRCODE='PT409'; END IF;
  result:=prior.result||jsonb_build_object('replayed',true);
  IF result->>'challenge_id' IS NOT NULL THEN result:=result||jsonb_build_object('challenge',rivalry_private.summary((result->>'challenge_id')::uuid)); END IF;
  RETURN result;
 END IF;
 cid:=(p_payload->>'challenge_id')::uuid;
 IF p_payload->>'match_id' IS NOT NULL THEN
  SELECT challenge_id INTO existing_link FROM rivalry_private.links WHERE match_id=(p_payload->>'match_id')::bigint;
  IF cid IS NOT NULL AND cid IS DISTINCT FROM existing_link THEN RAISE EXCEPTION 'Repair an existing result link explicitly.' USING ERRCODE='22023'; END IF;
  cid:=existing_link;
 END IF;
 IF cid IS NOT NULL THEN
  SELECT * INTO c FROM rivalry_private.challenges WHERE id=cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Series unavailable.' USING ERRCODE='P0002'; END IF;
  IF p_payload->>'match_id' IS NULL THEN
   IF actor NOT IN (c.sender,c.recipient) THEN RAISE EXCEPTION 'Only series participants can record this challenge.' USING ERRCODE='42501'; END IF;
   PERFORM 1 FROM rdd_private.planning_schedules WHERE night_id=c.night_id FOR UPDATE;
   IF (SELECT count(*) FROM public.league_members WHERE status='active' AND user_id IN (c.sender,c.recipient))<>2 THEN
    RAISE EXCEPTION 'Both participants must still be active league members.' USING ERRCODE='42501'; END IF;
   IF c.revision IS DISTINCT FROM (p_payload->>'challenge_revision')::integer THEN RAISE EXCEPTION 'Series changed. Refresh before recording.' USING ERRCODE='40001'; END IF;
   IF (rivalry_private.summary(cid)->>'state') NOT IN ('accepted','in_progress') OR c.abandonment_by IS NOT NULL THEN
    RAISE EXCEPTION 'This series needs attention before another game.' USING ERRCODE='22023'; END IF;
  END IF;
 END IF;
 result:=rivalry_private.base_save_match(p_operation_id,p_payload-'challenge_id'-'challenge_revision');
 IF result->>'status'='saved' THEN
  IF cid IS NOT NULL THEN
   SELECT * INTO m FROM public.matches WHERE id=(result->>'match_id')::bigint;
   -- Ordinary creator corrections may invalidate a link; the summary marks it
   -- for repair and removes any winning presentation instead of blocking truth.
   IF p_payload->>'match_id' IS NULL THEN
    IF result->>'replayed'='true' THEN RAISE EXCEPTION 'Link an existing recorded game through explicit repair.' USING ERRCODE='22023'; END IF;
    IF rivalry_private.eligible(m,c) IS NOT TRUE THEN RAISE EXCEPTION 'Game must match the accepted players, rules, board and night.' USING ERRCODE='22023'; END IF;
    INSERT INTO rivalry_private.links(match_id,challenge_id,linked_by) VALUES(m.id,cid,actor);
   END IF;
   UPDATE rivalry_private.challenges SET revision=revision+1,updated_at=now() WHERE id=cid;
   INSERT INTO rivalry_private.events(challenge_id,actor,action,detail) VALUES(cid,actor,CASE WHEN p_payload->>'match_id' IS NULL THEN 'game_saved' ELSE 'game_corrected' END,jsonb_build_object('match_id',m.id));
   result:=result||jsonb_build_object('challenge_id',cid,'challenge',rivalry_private.summary(cid));
  END IF;
  INSERT INTO rivalry_private.operations(actor,operation_id,payload,result) VALUES(actor,p_operation_id,p_payload,result);
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION rivalry_private.touch_result() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mid bigint; cid uuid;
BEGIN
 IF TG_TABLE_NAME='matches' THEN mid:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
 ELSE mid:=CASE WHEN TG_OP='DELETE' THEN OLD.match_id ELSE NEW.match_id END; END IF;
 SELECT challenge_id INTO cid FROM rivalry_private.links WHERE match_id=mid;
 IF cid IS NOT NULL THEN
  UPDATE rivalry_private.challenges SET revision=revision+1,updated_at=now() WHERE id=cid;
  INSERT INTO rivalry_private.events(challenge_id,actor,action,detail) VALUES(cid,auth.uid(),'source_result_changed',jsonb_build_object('match_id',mid,'table',TG_TABLE_NAME,'operation',TG_OP));
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER rivalry_match_changed AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION rivalry_private.touch_result();
CREATE TRIGGER rivalry_match_deleted BEFORE DELETE ON public.matches FOR EACH ROW EXECUTE FUNCTION rivalry_private.touch_result();
CREATE TRIGGER rivalry_player_changed AFTER INSERT OR UPDATE OR DELETE ON public.match_players FOR EACH ROW EXECUTE FUNCTION rivalry_private.touch_result();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rivalry_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rdd_avatar_read(integer), public.rdd_avatar_self(), public.rdd_rivalry_read(uuid,integer), public.rdd_rivalry_write(uuid,jsonb), public.rdd_save_match(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rdd_avatar_read(integer), public.rdd_avatar_self(), public.rdd_rivalry_read(uuid,integer), public.rdd_rivalry_write(uuid,jsonb), public.rdd_save_match(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
