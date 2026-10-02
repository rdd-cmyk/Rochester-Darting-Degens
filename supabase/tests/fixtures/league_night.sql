-- Reviewed locally before promotion to a timestamped migration. NOT auto-deployed.
-- Requires the existing matches/match_players/profiles schema, not the deferred
-- statistics fixture. See docs/league-night-database-rollout.md before hosting.
BEGIN;

CREATE SCHEMA IF NOT EXISTS rdd_private;
REVOKE ALL ON SCHEMA rdd_private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.league_nights (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 60),
  venue text CHECK (length(venue) < 50),
  night_date date NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.league_night_attendees (
  night_id uuid NOT NULL REFERENCES public.league_nights(id),
  player_id uuid NOT NULL REFERENCES public.profiles(id),
  present boolean NOT NULL DEFAULT true,
  revision bigint NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (night_id, player_id)
);
ALTER TABLE public.matches ADD COLUMN night_id uuid REFERENCES public.league_nights(id);
ALTER TABLE public.matches ADD COLUMN revision bigint NOT NULL DEFAULT 1;
CREATE INDEX matches_night_id_idx ON public.matches(night_id, played_at, id);
CREATE INDEX league_nights_date_idx ON public.league_nights(night_date DESC, id);

ALTER TABLE public.league_nights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_night_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY nights_read ON public.league_nights FOR SELECT TO authenticated USING (true);
CREATE POLICY attendees_read ON public.league_night_attendees FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.league_nights, public.league_night_attendees FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.league_nights, public.league_night_attendees TO authenticated;

CREATE TABLE rdd_private.match_save_operations (
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  operation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  match_id bigint NOT NULL REFERENCES public.matches(id),
  revision bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id)
);
ALTER TABLE rdd_private.match_save_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rdd_private.match_save_operations FROM PUBLIC, anon, authenticated;

-- Definer justification: callers cannot write the replay log or perform split
-- match writes. These narrowly scoped functions authenticate every call and
-- enforce creator ownership explicitly. No dynamic SQL or caller-selected role.
CREATE FUNCTION public.rdd_create_night(p_id uuid, p_title text, p_venue text, p_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); existing public.league_nights;
BEGIN
  IF actor IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Sign in to start a night.' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 60
    OR length(coalesce(p_venue,'')) >= 50 OR p_date IS NULL OR NOT isfinite(p_date) THEN
    RAISE EXCEPTION 'Choose a title, date and venue within the field limits.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('night:' || p_id::text, 0));
  SELECT * INTO existing FROM public.league_nights WHERE id = p_id;
  IF FOUND THEN
    IF existing.created_by <> actor OR existing.title <> btrim(p_title)
      OR existing.venue IS DISTINCT FROM nullif(btrim(p_venue),'') OR existing.night_date <> p_date THEN
      RAISE EXCEPTION 'This night identifier has already been used.' USING ERRCODE = '22023';
    END IF;
    RETURN to_jsonb(existing);
  END IF;
  INSERT INTO public.league_nights(id,title,venue,night_date,created_by)
    VALUES (p_id,btrim(p_title),nullif(btrim(p_venue),''),p_date,actor) RETURNING * INTO existing;
  RETURN to_jsonb(existing);
END;
$$;

CREATE FUNCTION public.rdd_set_attendance(p_night_id uuid, p_player_id uuid, p_present boolean, p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); attendee public.league_night_attendees;
BEGIN
  IF actor IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Sign in to update attendance.' USING ERRCODE = '42501';
  END IF;
  IF p_night_id IS NULL OR p_player_id IS NULL OR p_present IS NULL OR p_revision IS NULL THEN
    RAISE EXCEPTION 'Attendance details are incomplete.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('attend:' || p_night_id::text || p_player_id::text, 0));
  SELECT * INTO attendee FROM public.league_night_attendees WHERE night_id=p_night_id AND player_id=p_player_id;
  IF FOUND THEN
    -- Idempotent retry of the same state is safe even after another identical update.
    IF attendee.present = p_present THEN RETURN to_jsonb(attendee); END IF;
    IF attendee.revision <> p_revision THEN
      RAISE EXCEPTION 'Attendance changed. Refresh before trying again.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.league_night_attendees SET present=p_present, revision=revision+1,
      updated_by=actor, updated_at=now() WHERE night_id=p_night_id AND player_id=p_player_id RETURNING * INTO attendee;
  ELSE
    IF p_revision <> 0 THEN RAISE EXCEPTION 'Attendance changed. Refresh first.' USING ERRCODE = '40001'; END IF;
    INSERT INTO public.league_night_attendees(night_id,player_id,present,updated_by)
      VALUES(p_night_id,p_player_id,p_present,actor) RETURNING * INTO attendee;
  END IF;
  RETURN to_jsonb(attendee);
END;
$$;

CREATE FUNCTION rdd_private.bump_match_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.revision := OLD.revision + 1; RETURN NEW; END;
$$;
CREATE TRIGGER rdd_match_revision BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION rdd_private.bump_match_revision();
CREATE FUNCTION rdd_private.bump_participant_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN UPDATE public.matches SET revision=revision WHERE id=OLD.match_id; END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.match_id IS DISTINCT FROM OLD.match_id) THEN
    UPDATE public.matches SET revision=revision WHERE id=NEW.match_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER rdd_participant_revision AFTER INSERT OR UPDATE OR DELETE ON public.match_players
FOR EACH ROW EXECUTE FUNCTION rdd_private.bump_participant_revision();

CREATE FUNCTION public.rdd_save_match(p_operation_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE
  actor uuid := auth.uid(); request jsonb; participants jsonb; participant jsonb;
  existing public.matches; operation rdd_private.match_save_operations;
  target_id bigint; expected bigint; night uuid; played timestamptz; game text; board text;
  venue_value text; note_value text; score_value numeric; points_value numeric;
  player uuid; winner_count integer; distinct_count integer; matching bigint[]; saved_revision bigint;
BEGIN
  IF actor IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Sign in to save a match.' USING ERRCODE='42501';
  END IF;
  IF p_operation_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_payload->'players') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid match request.' USING ERRCODE='22023';
  END IF;
  IF p_payload ? 'submitted_by' AND (p_payload->>'submitted_by')::uuid IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Your account changed. Return to the original account to check this save.' USING ERRCODE='42501';
  END IF;
  IF jsonb_array_length(p_payload->'players') NOT BETWEEN 2 AND 10 THEN
    RAISE EXCEPTION 'Choose between two and ten players.' USING ERRCODE='22023';
  END IF;
  FOR participant IN SELECT value FROM jsonb_array_elements(p_payload->'players') LOOP
    IF jsonb_typeof(participant) <> 'object' OR jsonb_typeof(participant->'is_winner') IS DISTINCT FROM 'boolean'
      OR (participant->'score' IS NOT NULL AND jsonb_typeof(participant->'score') NOT IN ('number','null'))
      OR (participant->'points_scored' IS NOT NULL AND jsonb_typeof(participant->'points_scored') NOT IN ('number','null')) THEN
      RAISE EXCEPTION 'Invalid player result.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  SELECT jsonb_agg(jsonb_build_object('player_id',(value->>'player_id')::uuid,'score',(value->>'score')::numeric,
    'points_scored',(value->>'points_scored')::numeric,'is_winner',(value->>'is_winner')::boolean)
    ORDER BY (value->>'player_id')::uuid) INTO participants FROM jsonb_array_elements(p_payload->'players');
  target_id := (p_payload->>'match_id')::bigint;
  expected := (p_payload->>'expected_revision')::bigint;
  night := (p_payload->>'night_id')::uuid;
  played := (p_payload->>'played_at')::timestamptz;
  game := p_payload->>'game_type'; board := nullif(p_payload->>'board_type','');
  venue_value := nullif(p_payload->>'venue',''); note_value := nullif(p_payload->>'notes','');
  request := jsonb_build_object('match_id',target_id,'expected_revision',expected,'night_id',night,
    'played_at',played,'game_type',game,'board_type',board,'venue',venue_value,'notes',note_value,'players',participants);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('save:' || actor::text || p_operation_id::text,0));
  SELECT * INTO operation FROM rdd_private.match_save_operations WHERE user_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF operation.payload <> request THEN RAISE EXCEPTION 'Save identifier reused with different content.' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('status','saved','match_id',operation.match_id,'revision',operation.revision,'replayed',true);
  END IF;
  IF played IS NULL OR NOT isfinite(played) OR played > now()+interval '5 minutes'
    OR length(coalesce(venue_value,'')) >= 50 OR length(coalesce(note_value,'')) >= 100
    OR (board IS NOT NULL AND board NOT IN ('Soft Tip','Steel Tip')) THEN
    RAISE EXCEPTION 'Check the date, board, venue and note limits.' USING ERRCODE='22023';
  END IF;
  IF target_id IS NOT NULL THEN
    SELECT * INTO existing FROM public.matches WHERE id=target_id FOR UPDATE;
    IF NOT FOUND OR existing.created_by IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'You can only edit matches you created.' USING ERRCODE='42501';
    END IF;
    IF expected IS NULL OR expected <> existing.revision THEN
      RAISE EXCEPTION 'This match changed. Reload it before editing.' USING ERRCODE='40001';
    END IF;
    IF night IS DISTINCT FROM existing.night_id THEN
      RAISE EXCEPTION 'Changing a saved match''s night is not supported.' USING ERRCODE='22023';
    END IF;
  END IF;
  IF (game IS NULL OR game NOT IN ('501','301','Cricket','Other')) AND
    (target_id IS NULL OR game IS DISTINCT FROM existing.game_type) THEN
    RAISE EXCEPTION 'Choose a supported game type.' USING ERRCODE='22023';
  END IF;
  IF night IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.league_nights WHERE id=night) THEN
    RAISE EXCEPTION 'This league night no longer exists.' USING ERRCODE='22023';
  END IF;
  SELECT count(DISTINCT value->>'player_id'), count(*) FILTER (WHERE value->>'is_winner'='true')
    INTO distinct_count,winner_count FROM jsonb_array_elements(participants);
  IF distinct_count <> jsonb_array_length(participants) OR winner_count <> 1 THEN
    RAISE EXCEPTION 'Choose distinct players and exactly one winner.' USING ERRCODE='22023';
  END IF;
  FOR participant IN SELECT value FROM jsonb_array_elements(participants) LOOP
    IF jsonb_typeof(participant) <> 'object' OR jsonb_typeof(participant->'is_winner') IS DISTINCT FROM 'boolean'
      OR (participant->'score' IS NOT NULL AND jsonb_typeof(participant->'score') NOT IN ('number','null'))
      OR (participant->'points_scored' IS NOT NULL AND jsonb_typeof(participant->'points_scored') NOT IN ('number','null')) THEN
      RAISE EXCEPTION 'Invalid player result.' USING ERRCODE='22023';
    END IF;
    player := (participant->>'player_id')::uuid;
    IF player IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=player) THEN
      RAISE EXCEPTION 'Choose an existing player.' USING ERRCODE='22023';
    END IF;
    score_value := (participant->>'score')::numeric; points_value := (participant->>'points_scored')::numeric;
    IF score_value IS NOT NULL AND (score_value <= 0 OR score_value > CASE game WHEN '501' THEN 167 WHEN '301' THEN 150.5 WHEN 'Cricket' THEN 9 ELSE 9999 END
      OR (game='Other' AND score_value <> trunc(score_value))) THEN
      RAISE EXCEPTION 'Score is outside the supported range.' USING ERRCODE='22023';
    END IF;
    IF points_value IS NOT NULL AND (game IS DISTINCT FROM 'Cricket' OR points_value <= 0 OR points_value > 9999 OR points_value <> trunc(points_value)) THEN
      RAISE EXCEPTION 'Cricket points must be a positive whole number, or left blank.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF target_id IS NULL THEN
    -- A shared lock serializes duplicate checks across recorders, including
    -- simultaneous identical submissions. A deliberate rematch may override.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duplicate:' || coalesce(night::text,'ordinary') || coalesce(game,'') || coalesce(board,'') ||
      (SELECT string_agg(value->>'player_id',',' ORDER BY value->>'player_id') FROM jsonb_array_elements(participants)),0));
    IF coalesce((p_payload->>'allow_duplicate')::boolean,false) = false THEN
      SELECT array_agg(m.id ORDER BY m.id) INTO matching FROM public.matches m
      WHERE m.night_id IS NOT DISTINCT FROM night AND m.game_type IS NOT DISTINCT FROM game
        AND m.board_type IS NOT DISTINCT FROM board AND m.venue IS NOT DISTINCT FROM venue_value
        AND m.played_at BETWEEN played-interval '2 minutes' AND played+interval '2 minutes'
        AND (SELECT jsonb_agg(jsonb_build_object('player_id',mp.player_id,'score',mp.score,'points_scored',mp.points_scored,'is_winner',mp.is_winner) ORDER BY mp.player_id::text)
          FROM public.match_players mp WHERE mp.match_id=m.id) = participants;
      IF matching IS NOT NULL THEN RETURN jsonb_build_object('status','possible_duplicate','match_ids',matching); END IF;
    END IF;
    INSERT INTO public.matches(played_at,game_type,board_type,venue,notes,created_by,night_id)
      VALUES(played,game,board,venue_value,note_value,actor,night) RETURNING id INTO target_id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.match_players WHERE match_id=target_id GROUP BY player_id HAVING count(*)>1 OR player_id IS NULL) THEN
      RAISE EXCEPTION 'This legacy match has duplicate or unidentified participants and needs review.' USING ERRCODE='22023';
    END IF;
    UPDATE public.matches SET played_at=played,game_type=game,board_type=board,venue=venue_value,notes=note_value WHERE id=target_id;
    DELETE FROM public.match_players WHERE match_id=target_id AND player_id NOT IN
      (SELECT (value->>'player_id')::uuid FROM jsonb_array_elements(participants));
  END IF;
  FOR participant IN SELECT value FROM jsonb_array_elements(participants) LOOP
    player := (participant->>'player_id')::uuid;
    UPDATE public.match_players SET score=(participant->>'score')::numeric,points_scored=(participant->>'points_scored')::numeric,
      is_winner=(participant->>'is_winner')::boolean WHERE match_id=target_id AND player_id=player;
    IF NOT FOUND THEN
      INSERT INTO public.match_players(match_id,player_id,score,points_scored,is_winner)
        VALUES(target_id,player,(participant->>'score')::numeric,(participant->>'points_scored')::numeric,(participant->>'is_winner')::boolean);
    END IF;
  END LOOP;
  SELECT revision INTO saved_revision FROM public.matches WHERE id=target_id;
  INSERT INTO rdd_private.match_save_operations(user_id,operation_id,payload,match_id,revision)
    VALUES(actor,p_operation_id,request,target_id,saved_revision);
  RETURN jsonb_build_object('status','saved','match_id',target_id,'revision',saved_revision,'replayed',false);
END;
$$;

-- Direct-write enforcement is a separate rollout step in league_night_enforce.sql.
-- The new app uses only these functions. Drain legacy writes before enforcement.
REVOKE ALL ON FUNCTION public.rdd_create_night(uuid,text,text,date),
  public.rdd_set_attendance(uuid,uuid,boolean,bigint), public.rdd_save_match(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rdd_create_night(uuid,text,text,date),
  public.rdd_set_attendance(uuid,uuid,boolean,bigint), public.rdd_save_match(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION rdd_private.bump_match_revision(), rdd_private.bump_participant_revision() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
