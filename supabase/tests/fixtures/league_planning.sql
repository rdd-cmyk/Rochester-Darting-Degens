-- LOCAL / DEFERRED ONLY. Requires the legacy schema and league_night.sql.
-- Never place in migrations until the existing hosted release gate is cleared.
BEGIN;
CREATE TABLE rdd_private.planning_organizers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rdd_private.planning_polls (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 100),
  scope text NOT NULL CHECK(scope IN ('date','venue','both')),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed','cancelled','scheduled')),
  fixed_start timestamptz, fixed_venue text CHECK(length(fixed_venue)<50),
  closes_at timestamptz, created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), revision integer NOT NULL DEFAULT 1
);
CREATE TABLE rdd_private.planning_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES rdd_private.planning_polls(id),
  kind text NOT NULL CHECK(kind IN ('date','venue')),
  starts_at timestamptz, venue text, detail text NOT NULL DEFAULT '' CHECK(length(detail)<=100),
  suggested_by uuid REFERENCES public.profiles(id), withdrawn boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id,id),
  CHECK((kind='date' AND starts_at IS NOT NULL AND isfinite(starts_at) AND venue IS NULL)
    OR (kind='venue' AND starts_at IS NULL AND venue IS NOT NULL AND length(btrim(venue)) BETWEEN 1 AND 49))
);
CREATE UNIQUE INDEX planning_date_unique ON rdd_private.planning_options(poll_id,starts_at) WHERE kind='date';
CREATE UNIQUE INDEX planning_venue_unique ON rdd_private.planning_options(poll_id,lower(regexp_replace(btrim(venue),'\s+',' ','g'))) WHERE kind='venue';
CREATE TABLE rdd_private.planning_ballots (
  poll_id uuid NOT NULL REFERENCES rdd_private.planning_polls(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id), revision integer NOT NULL DEFAULT 1,
  PRIMARY KEY(poll_id,user_id)
);
CREATE TABLE rdd_private.planning_votes (
  poll_id uuid NOT NULL, option_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  PRIMARY KEY(poll_id,option_id,user_id),
  FOREIGN KEY(poll_id,option_id) REFERENCES rdd_private.planning_options(poll_id,id)
);
CREATE TABLE rdd_private.planning_schedules (
  night_id uuid PRIMARY KEY REFERENCES public.league_nights(id),
  starts_at timestamptz NOT NULL CHECK(isfinite(starts_at)),
  rsvp_closes_at timestamptz NOT NULL CHECK(isfinite(rsvp_closes_at)),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500),
  status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','cancelled')),
  source_poll uuid UNIQUE REFERENCES rdd_private.planning_polls(id),
  override_reason text NOT NULL DEFAULT '' CHECK(length(override_reason)<=300),
  revision integer NOT NULL DEFAULT 1, event_revision integer NOT NULL DEFAULT 1,
  CHECK(rsvp_closes_at<=starts_at)
);
CREATE TABLE rdd_private.planning_rsvps (
  night_id uuid NOT NULL REFERENCES rdd_private.planning_schedules(night_id),
  user_id uuid NOT NULL REFERENCES public.profiles(id), going boolean NOT NULL,
  event_revision integer NOT NULL, revision integer NOT NULL DEFAULT 1,
  PRIMARY KEY(night_id,user_id)
);
CREATE TABLE rdd_private.planning_operations (
  user_id uuid NOT NULL REFERENCES public.profiles(id), operation_id uuid NOT NULL,
  action text NOT NULL, payload jsonb NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,operation_id)
);
-- The private schema is not exposed to PostgREST. No client table grants or
-- policies: all access goes through the narrow authenticated functions below.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['planning_organizers','planning_polls','planning_options','planning_ballots','planning_votes','planning_schedules','planning_rsvps','planning_operations'] LOOP
    EXECUTE format('ALTER TABLE rdd_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON rdd_private.%I FROM PUBLIC, anon, authenticated',t);
  END LOOP;
END $$;

-- Wall times are always Rochester time, regardless of the browser/session zone.
-- Reject DST gaps and repeated hours instead of silently choosing an occurrence.
CREATE FUNCTION rdd_private.planning_time(value text) RETURNS timestamptz
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE wall timestamp; instant timestamptz;
BEGIN
  IF value IS NULL OR value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' THEN
    RAISE EXCEPTION 'Choose a date and time in Rochester time.' USING ERRCODE='22023';
  END IF;
  wall := value::timestamp; instant := wall AT TIME ZONE 'America/New_York';
  IF NOT isfinite(instant) OR instant AT TIME ZONE 'America/New_York' <> wall
    OR (instant-interval '1 hour') AT TIME ZONE 'America/New_York'=wall
    OR (instant+interval '1 hour') AT TIME ZONE 'America/New_York'=wall THEN
    RAISE EXCEPTION 'This time is skipped or repeated by daylight saving. Choose another time.' USING ERRCODE='22023';
  END IF;
  RETURN instant;
END $$;
REVOKE ALL ON FUNCTION rdd_private.planning_time(text) FROM PUBLIC, anon, authenticated;

-- Read only lifecycle labels for the legacy lobby and direct links, including
-- nights outside the paginated upcoming feed. Never expose private RSVP data.
CREATE FUNCTION public.rdd_planning_night_status(p_night_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid()) THEN
    RAISE EXCEPTION 'Sign in with a player profile.' USING ERRCODE='42501'; END IF;
  IF p_night_ids IS NULL OR cardinality(p_night_ids)>40 THEN
    RAISE EXCEPTION 'Request up to 40 night statuses.' USING ERRCODE='22023'; END IF;
  RETURN coalesce((SELECT jsonb_object_agg(night_id,status)
    FROM rdd_private.planning_schedules WHERE night_id=ANY(p_night_ids)), '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.rdd_planning_night_status(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rdd_planning_night_status(uuid[]) TO authenticated;

-- Definer justification: private ballots and organizer grants must never be
-- client-readable. Only own selections and aggregate support leave this RPC.
CREATE FUNCTION public.rdd_planning_read(p_poll_offset integer DEFAULT 0, p_event_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); organizer boolean; polls jsonb; nights jsonb;
BEGIN
  IF actor IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN
    RAISE EXCEPTION 'Sign in with a player profile.' USING ERRCODE='42501';
  END IF;
  IF p_poll_offset IS NULL OR p_event_offset IS NULL OR p_poll_offset<0 OR p_event_offset<0 THEN
    RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
  organizer:=EXISTS(SELECT 1 FROM rdd_private.planning_organizers WHERE user_id=actor);
  SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC,id),'[]') INTO polls FROM (
    SELECT p.id,p.created_at,to_jsonb(p)||jsonb_build_object(
      'status',CASE WHEN p.status='open' AND p.closes_at<=clock_timestamp() THEN 'closed' ELSE p.status END,
      'ballot_revision',coalesce((SELECT revision FROM rdd_private.planning_ballots WHERE poll_id=p.id AND user_id=actor),0),
      'mine',coalesce((SELECT jsonb_agg(option_id ORDER BY option_id) FROM rdd_private.planning_votes WHERE poll_id=p.id AND user_id=actor),'[]'),
      'suggestions_used',(SELECT count(*) FROM rdd_private.planning_options WHERE poll_id=p.id AND suggested_by=actor),
      'voters',(SELECT count(DISTINCT user_id) FROM rdd_private.planning_votes v JOIN rdd_private.planning_options o ON o.id=v.option_id WHERE v.poll_id=p.id AND NOT o.withdrawn),
      'options',coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('votes',(SELECT count(*) FROM rdd_private.planning_votes WHERE option_id=o.id),
        'author',(SELECT jsonb_build_object('display_name',pr.display_name,'first_name',pr.first_name,'include_first_name_in_display',pr.include_first_name_in_display) FROM public.profiles pr WHERE pr.id=o.suggested_by)) ORDER BY o.created_at,o.id)
        FROM rdd_private.planning_options o WHERE o.poll_id=p.id),'[]'),
      'pairs',CASE WHEN organizer THEN coalesce((SELECT jsonb_agg(x) FROM (
        SELECT d.option_id AS date_id,v.option_id AS venue_id,count(*) AS support
        FROM rdd_private.planning_votes d JOIN rdd_private.planning_votes v ON d.poll_id=v.poll_id AND d.user_id=v.user_id
        JOIN rdd_private.planning_options od ON od.id=d.option_id AND od.kind='date' AND NOT od.withdrawn
        JOIN rdd_private.planning_options ov ON ov.id=v.option_id AND ov.kind='venue' AND NOT ov.withdrawn
        WHERE d.poll_id=p.id GROUP BY d.option_id,v.option_id) x),'[]') ELSE '[]'::jsonb END,
      'night_id',(SELECT night_id FROM rdd_private.planning_schedules WHERE source_poll=p.id)) AS item
    FROM (SELECT * FROM rdd_private.planning_polls WHERE status<>'draft' OR organizer ORDER BY created_at DESC,id LIMIT 20 OFFSET p_poll_offset) p
  ) q;
  SELECT coalesce(jsonb_agg(item ORDER BY starts_at,night_id),'[]') INTO nights FROM (
    SELECT s.starts_at,s.night_id,to_jsonb(s)||jsonb_build_object('title',n.title,'venue',n.venue,
      'responses',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',r.user_id,'going',r.going,'profile',jsonb_build_object('display_name',pr.display_name,'first_name',pr.first_name,'include_first_name_in_display',pr.include_first_name_in_display)) ORDER BY r.user_id)
        FROM rdd_private.planning_rsvps r JOIN public.profiles pr ON pr.id=r.user_id WHERE r.night_id=s.night_id AND r.event_revision=s.event_revision),'[]'),
      'mine',(SELECT to_jsonb(r) FROM rdd_private.planning_rsvps r WHERE r.night_id=s.night_id AND r.user_id=actor)) AS item
    FROM (SELECT * FROM rdd_private.planning_schedules WHERE starts_at>=clock_timestamp()-interval '12 hours' ORDER BY starts_at,night_id LIMIT 20 OFFSET p_event_offset) s
    JOIN public.league_nights n ON n.id=s.night_id
  ) q;
  RETURN jsonb_build_object('organizer',organizer,'server_now',clock_timestamp(),'polls',polls,'nights',nights,
    'poll_total',(SELECT count(*) FROM rdd_private.planning_polls WHERE status<>'draft' OR organizer),
    'night_total',(SELECT count(*) FROM rdd_private.planning_schedules WHERE starts_at>=clock_timestamp()-interval '12 hours'));
END $$;

CREATE FUNCTION public.rdd_planning_write(p_operation_id uuid,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
#variable_conflict use_variable
DECLARE
  actor uuid:=auth.uid(); organizer boolean; op rdd_private.planning_operations;
  poll rdd_private.planning_polls; opt rdd_private.planning_options; sched rdd_private.planning_schedules;
  old_night public.league_nights; answer rdd_private.planning_rsvps;
  result jsonb; poll_id uuid; night_id uuid; selected uuid[]; item jsonb;
  start_time timestamptz; cutoff timestamptz; venue_value text; title_value text;
  expected integer; current_revision integer; time_value timestamptz; changed boolean; date_id uuid; venue_id uuid;
BEGIN
  IF actor IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN
    RAISE EXCEPTION 'Sign in with a player profile.' USING ERRCODE='42501'; END IF;
  IF p_operation_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR (p_payload->>'actor_id')::uuid IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Your account changed. Check the request with the original account.' USING ERRCODE='42501'; END IF;
  organizer:=EXISTS(SELECT 1 FROM rdd_private.planning_organizers WHERE user_id=actor);
  IF p_action IN ('save_poll','close_poll','cancel_poll','schedule','edit_night','cancel_night') AND NOT organizer THEN
    RAISE EXCEPTION 'Only league organizers can manage planning.' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('planning-op:'||actor::text||p_operation_id::text,0));
  SELECT * INTO op FROM rdd_private.planning_operations WHERE user_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF op.action IS DISTINCT FROM p_action OR op.payload<>p_payload THEN
      RAISE EXCEPTION 'This request ID was already used with different content.' USING ERRCODE='PT409'; END IF;
    RETURN op.result||'{"replayed":true}'::jsonb;
  END IF;
  poll_id:=(p_payload->>'poll_id')::uuid; night_id:=(p_payload->>'night_id')::uuid;
  expected:=(p_payload->>'revision')::integer;
  IF poll_id IS NOT NULL THEN
    -- One lock order for every poll write, including scheduling and suggestions.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('planning-poll:'||poll_id::text,0));
    SELECT * INTO poll FROM rdd_private.planning_polls WHERE id=poll_id FOR UPDATE;
    IF NOT FOUND AND p_action<>'save_poll' THEN RAISE EXCEPTION 'Poll not found.' USING ERRCODE='22023'; END IF;
  END IF;
  IF p_action='save_poll' THEN
    IF poll_id IS NULL OR expected IS NULL OR (poll.id IS NULL AND expected<>0) OR (poll.id IS NOT NULL AND (poll.status<>'draft' OR poll.revision<>expected)) THEN
      RAISE EXCEPTION 'This poll changed. Refresh before editing.' USING ERRCODE='40001'; END IF;
    title_value:=btrim(p_payload->>'title');
    IF title_value IS NULL OR length(title_value) NOT BETWEEN 1 AND 100 OR p_payload->>'scope' IS NULL OR p_payload->>'scope' NOT IN ('date','venue','both')
      OR jsonb_typeof(p_payload->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'options')>20 THEN
      RAISE EXCEPTION 'Choose a title, poll type, and at most 20 initial options.' USING ERRCODE='22023'; END IF;
    cutoff:=CASE WHEN nullif(p_payload->>'closes_local','') IS NOT NULL THEN rdd_private.planning_time(p_payload->>'closes_local') END;
    IF cutoff<=clock_timestamp() THEN RAISE EXCEPTION 'Closing time must be in the future.' USING ERRCODE='22023'; END IF;
    start_time:=CASE WHEN nullif(p_payload->>'fixed_start_local','') IS NOT NULL THEN rdd_private.planning_time(p_payload->>'fixed_start_local') END;
    venue_value:=nullif(btrim(p_payload->>'fixed_venue'),'');
    IF start_time<=clock_timestamp() OR length(venue_value)>49 THEN RAISE EXCEPTION 'Check the fixed date and venue.' USING ERRCODE='22023'; END IF;
    INSERT INTO rdd_private.planning_polls(id,title,scope,fixed_start,fixed_venue,closes_at,created_by)
      VALUES(poll_id,title_value,p_payload->>'scope',start_time,venue_value,cutoff,actor)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,scope=excluded.scope,fixed_start=excluded.fixed_start,fixed_venue=excluded.fixed_venue,closes_at=excluded.closes_at,revision=planning_polls.revision+1;
    DELETE FROM rdd_private.planning_options WHERE planning_options.poll_id=poll_id;
    FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'options') LOOP
      IF item->>'kind' IS NULL OR item->>'kind' NOT IN ('date','venue') OR (p_payload->>'scope'<>'both' AND item->>'kind'<>p_payload->>'scope') THEN
        RAISE EXCEPTION 'Option does not match this poll.' USING ERRCODE='22023'; END IF;
      time_value:=CASE WHEN item->>'kind'='date' THEN rdd_private.planning_time(item->>'starts_local') END;
      IF time_value<=clock_timestamp() OR time_value<=cutoff THEN RAISE EXCEPTION 'Date options must follow the voting deadline and be in the future.' USING ERRCODE='22023'; END IF;
      INSERT INTO rdd_private.planning_options(poll_id,kind,starts_at,venue,detail)
        VALUES(poll_id,item->>'kind',time_value,CASE WHEN item->>'kind'='venue' THEN btrim(item->>'venue') END,coalesce(item->>'detail',''));
    END LOOP;
    IF coalesce((p_payload->>'publish')::boolean,false) THEN
      IF EXISTS(SELECT 1 FROM unnest(CASE p_payload->>'scope' WHEN 'both' THEN ARRAY['date','venue'] ELSE ARRAY[p_payload->>'scope'] END) k
        WHERE NOT EXISTS(SELECT 1 FROM rdd_private.planning_options o WHERE o.poll_id=poll_id AND o.kind=k)) THEN
        RAISE EXCEPTION 'Add at least one option in each voting category.' USING ERRCODE='22023'; END IF;
      IF start_time IS NOT NULL AND cutoff>=start_time THEN RAISE EXCEPTION 'Close voting before the fixed start time.' USING ERRCODE='22023'; END IF;
      UPDATE rdd_private.planning_polls SET status='open' WHERE id=poll_id;
    END IF;
    result:=jsonb_build_object('poll_id',poll_id);
  ELSIF p_action IN ('vote','suggest','withdraw') THEN
    IF poll.id IS NULL OR poll.status<>'open' OR poll.closes_at<=clock_timestamp() THEN
      RAISE EXCEPTION 'Voting is closed. Refresh to see the final results.' USING ERRCODE='PT410'; END IF;
    IF p_action='vote' THEN
      IF jsonb_typeof(p_payload->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid ballot.' USING ERRCODE='22023'; END IF;
      SELECT coalesce(array_agg(DISTINCT value::uuid),'{}') INTO selected FROM jsonb_array_elements_text(p_payload->'options');
      IF EXISTS(SELECT 1 FROM unnest(selected) x WHERE NOT EXISTS(SELECT 1 FROM rdd_private.planning_options o WHERE o.id=x AND o.poll_id=poll_id AND NOT o.withdrawn)) THEN
        RAISE EXCEPTION 'An option changed. Refresh and review your vote.' USING ERRCODE='40001'; END IF;
      SELECT revision INTO current_revision FROM rdd_private.planning_ballots b WHERE b.poll_id=poll_id AND user_id=actor;
      IF expected IS DISTINCT FROM coalesce(current_revision,0) THEN RAISE EXCEPTION 'Your ballot changed on another device. Refresh first.' USING ERRCODE='40001'; END IF;
      INSERT INTO rdd_private.planning_ballots VALUES(poll_id,actor,1) ON CONFLICT ON CONSTRAINT planning_ballots_pkey DO UPDATE SET revision=planning_ballots.revision+1;
      DELETE FROM rdd_private.planning_votes v WHERE v.poll_id=poll_id AND user_id=actor;
      INSERT INTO rdd_private.planning_votes SELECT poll_id,x,actor FROM unnest(selected) x;
    ELSIF p_action='suggest' THEN
      IF (SELECT count(*) FROM rdd_private.planning_options o WHERE o.poll_id=poll_id AND suggested_by=actor)>=2 THEN
        RAISE EXCEPTION 'You have used both suggestions for this poll.' USING ERRCODE='PT422'; END IF;
      IF p_payload->>'kind' IS NULL OR p_payload->>'kind' NOT IN ('date','venue') OR (poll.scope<>'both' AND p_payload->>'kind'<>poll.scope) THEN
        RAISE EXCEPTION 'Option does not match this poll.' USING ERRCODE='22023'; END IF;
      time_value:=CASE WHEN p_payload->>'kind'='date' THEN rdd_private.planning_time(p_payload->>'starts_local') END;
      IF time_value<=clock_timestamp() OR time_value<=poll.closes_at THEN RAISE EXCEPTION 'Suggest a future date after voting closes.' USING ERRCODE='22023'; END IF;
      INSERT INTO rdd_private.planning_options(poll_id,kind,starts_at,venue,detail,suggested_by)
        VALUES(poll_id,p_payload->>'kind',time_value,CASE WHEN p_payload->>'kind'='venue' THEN btrim(p_payload->>'venue') END,coalesce(p_payload->>'detail',''),actor);
    ELSE
      SELECT * INTO opt FROM rdd_private.planning_options WHERE id=(p_payload->>'option_id')::uuid AND planning_options.poll_id=poll_id;
      IF NOT FOUND OR opt.suggested_by IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Only your own suggestions can be withdrawn.' USING ERRCODE='42501'; END IF;
      UPDATE rdd_private.planning_options SET withdrawn=true WHERE id=opt.id;
      -- Retain the option and votes for history; exclude withdrawn options from
      -- support/overlap and scheduling. Withdrawal never refunds a suggestion.
    END IF;
    result:=jsonb_build_object('poll_id',poll_id);
  ELSIF p_action IN ('close_poll','cancel_poll') THEN
    IF poll.id IS NULL OR expected IS DISTINCT FROM poll.revision OR poll.status='scheduled' THEN
      RAISE EXCEPTION 'Poll changed. Refresh first.' USING ERRCODE='40001'; END IF;
    IF p_action='close_poll' AND poll.status NOT IN ('open','closed') THEN RAISE EXCEPTION 'This poll cannot be closed.' USING ERRCODE='22023'; END IF;
    UPDATE rdd_private.planning_polls SET status=CASE WHEN p_action='cancel_poll' THEN 'cancelled' ELSE 'closed' END,revision=revision+1 WHERE id=poll_id;
    result:=jsonb_build_object('poll_id',poll_id);
  ELSIF p_action IN ('schedule','edit_night') THEN
    title_value:=btrim(p_payload->>'title'); venue_value:=btrim(p_payload->>'venue');
    IF p_action='schedule' AND poll_id IS NOT NULL THEN
      IF poll.status='scheduled' THEN RAISE EXCEPTION 'This poll already has a scheduled night. Refresh to open it.' USING ERRCODE='PT409'; END IF;
      IF NOT(poll.status='closed' OR (poll.status='open' AND poll.closes_at IS NOT NULL AND poll.closes_at<=clock_timestamp())) THEN RAISE EXCEPTION 'Close voting before scheduling.' USING ERRCODE='22023'; END IF;
      date_id:=(p_payload->>'date_option')::uuid; venue_id:=(p_payload->>'venue_option')::uuid;
      IF poll.scope IN ('date','both') THEN
        SELECT starts_at INTO start_time FROM rdd_private.planning_options WHERE id=date_id AND planning_options.poll_id=poll_id AND kind='date' AND NOT withdrawn;
        IF NOT FOUND THEN RAISE EXCEPTION 'Choose a date from this poll.' USING ERRCODE='22023'; END IF;
      ELSE start_time:=coalesce(poll.fixed_start,rdd_private.planning_time(p_payload->>'starts_local')); END IF;
      IF poll.scope IN ('venue','both') THEN
        SELECT venue INTO venue_value FROM rdd_private.planning_options WHERE id=venue_id AND planning_options.poll_id=poll_id AND kind='venue' AND NOT withdrawn;
        IF NOT FOUND THEN RAISE EXCEPTION 'Choose a venue from this poll.' USING ERRCODE='22023'; END IF;
      ELSE venue_value:=coalesce(poll.fixed_venue,venue_value); END IF;
      IF EXISTS(SELECT 1 FROM rdd_private.planning_options o WHERE o.poll_id=poll_id AND NOT withdrawn AND
        (SELECT count(*) FROM rdd_private.planning_votes WHERE option_id=o.id)>
        (SELECT count(*) FROM rdd_private.planning_votes WHERE option_id=CASE o.kind WHEN 'date' THEN date_id ELSE venue_id END))
        AND length(btrim(coalesce(p_payload->>'override_reason','')))=0 THEN
        RAISE EXCEPTION 'Explain why you chose an option with fewer votes.' USING ERRCODE='22023'; END IF;
    ELSE start_time:=rdd_private.planning_time(p_payload->>'starts_local'); END IF;
    cutoff:=CASE WHEN nullif(p_payload->>'rsvp_closes_local','') IS NULL THEN start_time ELSE rdd_private.planning_time(p_payload->>'rsvp_closes_local') END;
    IF title_value IS NULL OR length(title_value) NOT BETWEEN 1 AND 60 OR venue_value IS NULL OR length(venue_value) NOT BETWEEN 1 AND 49
      OR start_time IS NULL OR start_time<=clock_timestamp() OR cutoff>start_time
      OR (p_action='schedule' AND cutoff<=clock_timestamp()) THEN
      RAISE EXCEPTION 'Choose a future start, venue, title, and RSVP cutoff no later than the start.' USING ERRCODE='22023'; END IF;
    IF p_action='schedule' THEN
      night_id:=gen_random_uuid();
      INSERT INTO public.league_nights(id,title,venue,night_date,created_by) VALUES(night_id,title_value,venue_value,(start_time AT TIME ZONE 'America/New_York')::date,actor);
      INSERT INTO rdd_private.planning_schedules(night_id,starts_at,rsvp_closes_at,notes,source_poll,override_reason)
        VALUES(night_id,start_time,cutoff,coalesce(p_payload->>'notes',''),poll_id,coalesce(p_payload->>'override_reason',''));
      IF poll_id IS NOT NULL THEN UPDATE rdd_private.planning_polls SET status='scheduled',revision=revision+1 WHERE id=poll_id; END IF;
    ELSE
      SELECT * INTO sched FROM rdd_private.planning_schedules WHERE planning_schedules.night_id=night_id FOR UPDATE;
      IF NOT FOUND OR expected IS DISTINCT FROM sched.revision OR sched.status<>'scheduled' OR sched.starts_at<=clock_timestamp() THEN
        RAISE EXCEPTION 'Night changed or has started. Refresh before editing.' USING ERRCODE='40001'; END IF;
      -- Corrections must not force an organizer to reopen closed RSVPs.
      -- Read the existing cutoff under the same lock as the revision check.
      IF cutoff<=clock_timestamp() AND cutoff IS DISTINCT FROM sched.rsvp_closes_at THEN
        RAISE EXCEPTION 'Keep the existing RSVP cutoff or choose a future cutoff.' USING ERRCODE='22023'; END IF;
      SELECT * INTO old_night FROM public.league_nights WHERE id=night_id;
      changed:=sched.starts_at IS DISTINCT FROM start_time OR old_night.venue IS DISTINCT FROM venue_value;
      UPDATE public.league_nights SET title=title_value,venue=venue_value,night_date=(start_time AT TIME ZONE 'America/New_York')::date WHERE id=night_id;
      UPDATE rdd_private.planning_schedules SET starts_at=start_time,rsvp_closes_at=cutoff,notes=coalesce(p_payload->>'notes',''),revision=revision+1,event_revision=event_revision+CASE WHEN changed THEN 1 ELSE 0 END WHERE planning_schedules.night_id=night_id;
    END IF;
    result:=jsonb_build_object('night_id',night_id);
  ELSIF p_action IN ('rsvp','cancel_night') THEN
    SELECT * INTO sched FROM rdd_private.planning_schedules WHERE planning_schedules.night_id=night_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Night not found.' USING ERRCODE='22023'; END IF;
    IF p_action='cancel_night' THEN
      IF expected IS DISTINCT FROM sched.revision OR sched.starts_at<=clock_timestamp() THEN RAISE EXCEPTION 'Night changed or started. Refresh first.' USING ERRCODE='40001'; END IF;
      UPDATE rdd_private.planning_schedules SET status='cancelled',revision=revision+1 WHERE planning_schedules.night_id=night_id;
    ELSE
      IF sched.status<>'scheduled' OR sched.rsvp_closes_at<=clock_timestamp() THEN RAISE EXCEPTION 'RSVPs are closed for this night.' USING ERRCODE='PT410'; END IF;
      IF (p_payload->>'event_revision')::integer IS DISTINCT FROM sched.event_revision THEN RAISE EXCEPTION 'The date or venue changed. Review it and respond again.' USING ERRCODE='40001'; END IF;
      IF jsonb_typeof(p_payload->'going') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Choose Going or Not going.' USING ERRCODE='22023'; END IF;
      SELECT * INTO answer FROM rdd_private.planning_rsvps r WHERE r.night_id=night_id AND user_id=actor;
      IF expected IS DISTINCT FROM coalesce(answer.revision,0) THEN RAISE EXCEPTION 'Your response changed on another device. Refresh first.' USING ERRCODE='40001'; END IF;
      INSERT INTO rdd_private.planning_rsvps VALUES(night_id,actor,(p_payload->>'going')::boolean,sched.event_revision,1)
        ON CONFLICT ON CONSTRAINT planning_rsvps_pkey DO UPDATE SET going=excluded.going,event_revision=excluded.event_revision,revision=planning_rsvps.revision+1;
    END IF;
    result:=jsonb_build_object('night_id',night_id);
  ELSE RAISE EXCEPTION 'Unknown planning action.' USING ERRCODE='22023';
  END IF;
  INSERT INTO rdd_private.planning_operations VALUES(actor,p_operation_id,p_action,p_payload,result,now());
  RETURN result||'{"replayed":false}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.rdd_planning_read(integer,integer),public.rdd_planning_write(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rdd_planning_read(integer,integer),public.rdd_planning_write(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
