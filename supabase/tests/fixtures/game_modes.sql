-- Local-only additive fixture. Apply AFTER the accepted League Night schema.
-- New writes stay disabled until every live reader supports game_config.
BEGIN;
ALTER TABLE public.matches ADD COLUMN game_config jsonb;
ALTER TABLE public.match_players DROP CONSTRAINT match_players_score_check;
ALTER TABLE public.match_players ADD CONSTRAINT match_players_score_check CHECK(score >= 0 AND score < 'Infinity'::numeric);
ALTER TABLE public.match_players DROP CONSTRAINT match_players_points_scored_check;
ALTER TABLE public.match_players ADD CONSTRAINT match_players_points_scored_check CHECK(points_scored >= 0 AND points_scored < 'Infinity'::numeric);
CREATE TABLE rdd_private.game_modes_control(id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false);
INSERT INTO rdd_private.game_modes_control DEFAULT VALUES;
CREATE TABLE rdd_private.game_presets(id text PRIMARY KEY, game_type text NOT NULL);
INSERT INTO rdd_private.game_presets(id,game_type) VALUES
('501-double-v1','501'),
('501-open-v1','501'),
('501-dido-v1','501'),
('501-master-v1','501'),
('301-double-v1','301'),
('301-open-v1','301'),
('301-dido-v1','301'),
('301-master-v1','301'),
('701-double-v1','701'),
('701-open-v1','701'),
('701-dido-v1','701'),
('701-master-v1','701'),
('cricket-v1','Cricket'),
('cut-throat-v1','Cut-Throat Cricket'),
('no-score-v1','No-Score Cricket'),
('count-up-8-full-v1','Count-Up'),
('count-up-8-split-v1','Count-Up'),
('clock-v1','Around the Clock'),
('clock-doubles-v1','Around the Clock'),
('shanghai-7-v1','Shanghai'),
('gotcha-301-return-v1','Gotcha'),
('gotcha-301-subtract-v1','Gotcha'),
('half-it-9-v1','Halve-It / Bermuda Triangle'),
('bermuda-13-v1','Halve-It / Bermuda Triangle');
REVOKE ALL ON rdd_private.game_modes_control,rdd_private.game_presets FROM PUBLIC,anon,authenticated;
CREATE TABLE public.match_corrections(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id bigint NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  previous_match jsonb NOT NULL,
  previous_players jsonb NOT NULL
);
ALTER TABLE public.match_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_corrections FROM anon,authenticated;
GRANT SELECT ON public.match_corrections TO authenticated;
CREATE POLICY correction_owner_read ON public.match_corrections FOR SELECT TO authenticated USING (changed_by=auth.uid());
CREATE OR REPLACE FUNCTION public.rdd_save_match(p_operation_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE
  config jsonb; fmt text; size integer; result_status text; winning_side text; side text; side_score numeric;
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
  config := nullif(p_payload->'game_config','null'::jsonb);
  fmt := coalesce(config->>'format','individual');
  size := CASE fmt WHEN '2v2' THEN 2 WHEN '3v3' THEN 3 ELSE 1 END;
  result_status := coalesce(config->>'status','completed');
  target_id := (p_payload->>'match_id')::bigint;
  expected := (p_payload->>'expected_revision')::bigint;
  night := (p_payload->>'night_id')::uuid;
  played := (p_payload->>'played_at')::timestamptz;
  game := p_payload->>'game_type'; board := nullif(p_payload->>'board_type','');
  venue_value := nullif(p_payload->>'venue',''); note_value := nullif(p_payload->>'notes','');
  request := jsonb_build_object('match_id',target_id,'expected_revision',expected,'night_id',night,
    'played_at',played,'game_type',game,'board_type',board,'venue',venue_value,'notes',note_value,'players',participants);
  IF config IS NOT NULL THEN request := request || jsonb_build_object('game_config',config); END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('save:' || actor::text || p_operation_id::text,0));
  SELECT * INTO operation FROM rdd_private.match_save_operations WHERE user_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF operation.payload <> request THEN RAISE EXCEPTION 'Save identifier reused with different content.' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('status','saved','match_id',operation.match_id,'revision',operation.revision,'replayed',true);
  END IF;
  IF (config IS NOT NULL OR game NOT IN ('301','501','Cricket','Other')) AND NOT (SELECT enabled FROM rdd_private.game_modes_control WHERE id=true) THEN
    RAISE EXCEPTION 'New game rules and teams are not enabled yet. Your entry is preserved.' USING ERRCODE='22023';
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
    IF existing.game_config IS NOT NULL AND config IS NULL THEN
      RAISE EXCEPTION 'Refresh the site before editing this game format.' USING ERRCODE='22023';
    END IF;
    IF night IS DISTINCT FROM existing.night_id THEN
      RAISE EXCEPTION 'Changing a saved match''s night is not supported.' USING ERRCODE='22023';
    END IF;
  END IF;
  IF (game IS NULL OR game NOT IN ('501','301','701','Cricket','Cut-Throat Cricket','No-Score Cricket','Count-Up','Around the Clock','Shanghai','Gotcha','Halve-It / Bermuda Triangle','Other')) AND
    (target_id IS NULL OR game IS DISTINCT FROM existing.game_type) THEN
    RAISE EXCEPTION 'Choose a supported game type.' USING ERRCODE='22023';
  END IF;
  IF night IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.league_nights WHERE id=night) THEN
    RAISE EXCEPTION 'This league night no longer exists.' USING ERRCODE='22023';
  END IF;
  SELECT count(DISTINCT value->>'player_id'), count(*) FILTER (WHERE value->>'is_winner'='true')
    INTO distinct_count,winner_count FROM jsonb_array_elements(participants);
  IF distinct_count <> jsonb_array_length(participants) OR winner_count <> (CASE WHEN result_status='completed' THEN size ELSE 0 END) THEN
    RAISE EXCEPTION 'Choose distinct players and exactly one winner.' USING ERRCODE='22023';
  END IF;
  IF config IS NOT NULL THEN
    IF jsonb_typeof(config) IS DISTINCT FROM 'object' OR config->'version' IS DISTINCT FROM '1'::jsonb
      OR jsonb_typeof(config->'format') IS DISTINCT FROM 'string'
      OR jsonb_typeof(config->'status') IS DISTINCT FROM 'string'
      OR fmt NOT IN ('individual','2v2','3v3') OR result_status NOT IN ('completed','tied','abandoned')
      OR coalesce(config->>'context','') NOT IN ('competitive','practice')
      OR jsonb_typeof(config->'handicap') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(config->'otherName') IS DISTINCT FROM 'string' OR length(config->>'otherName')>60
      OR coalesce(config->>'finish','') NOT IN ('ordinary','shanghai')
      OR (config->>'finish'='shanghai' AND game IS DISTINCT FROM 'Shanghai')
      OR jsonb_typeof(config->'sides') IS DISTINCT FROM 'object'
      OR jsonb_typeof(config->'teamScores') IS DISTINCT FROM 'object'
      OR (coalesce(config->>'preset','') <> 'unspecified' AND NOT EXISTS
        (SELECT 1 FROM rdd_private.game_presets WHERE id=config->>'preset' AND game_type=game)) THEN
      RAISE EXCEPTION 'Invalid game configuration.' USING ERRCODE='22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(config) k WHERE k NOT IN ('version','preset','format','context','status','handicap','sides','teamScores','otherName','finish')) THEN
      RAISE EXCEPTION 'Unknown game configuration fields.' USING ERRCODE='22023';
    END IF;
    IF fmt='individual' THEN
      IF config->'sides' <> '{}'::jsonb OR config->'teamScores' <> '{}'::jsonb THEN
        RAISE EXCEPTION 'Individual results cannot have team scores.' USING ERRCODE='22023';
      END IF;
    ELSE
      IF jsonb_array_length(participants)<>size*2 OR (SELECT count(*) FROM jsonb_object_keys(config->'sides'))<>size*2
        OR EXISTS (SELECT 1 FROM jsonb_each_text(config->'sides') t WHERE value NOT IN ('A','B') OR NOT EXISTS
          (SELECT 1 FROM jsonb_array_elements(participants) p WHERE p->>'player_id'=t.key)) THEN
        RAISE EXCEPTION 'Assign every participant to a valid team.' USING ERRCODE='22023';
      END IF;
      FOREACH side IN ARRAY ARRAY['A','B'] LOOP
        IF (SELECT count(*) FROM jsonb_each_text(config->'sides') WHERE value=side)<>size THEN
          RAISE EXCEPTION 'Teams must have equal sizes.' USING ERRCODE='22023';
        END IF;
      END LOOP;
      SELECT min(config->'sides'->>(p->>'player_id')) INTO winning_side FROM jsonb_array_elements(participants) p WHERE (p->>'is_winner')::boolean;
      IF result_status='completed' AND EXISTS (SELECT 1 FROM jsonb_array_elements(participants) p
        WHERE (p->>'is_winner')::boolean IS DISTINCT FROM (config->'sides'->>(p->>'player_id')=winning_side)) THEN
        RAISE EXCEPTION 'Choose exactly one winning team.' USING ERRCODE='22023';
      END IF;
      FOR side IN SELECT jsonb_object_keys(config->'teamScores') LOOP
        IF side NOT IN ('A','B') OR jsonb_typeof(config->'teamScores'->side) NOT IN ('number','null') THEN
          RAISE EXCEPTION 'Invalid shared score.' USING ERRCODE='22023';
        END IF;
        side_score := (config->'teamScores'->>side)::numeric;
        IF side_score<0 OR side_score>(CASE WHEN game IN ('501','301','701') THEN 180 WHEN game IN ('Cricket','Cut-Throat Cricket') THEN 9 ELSE 9999 END)
          OR (game NOT IN ('501','301','701','Cricket','Cut-Throat Cricket') AND side_score<>trunc(side_score))
          OR (game IN ('No-Score Cricket','Around the Clock','Gotcha') AND side_score IS NOT NULL AND (side_score=0 OR side IS DISTINCT FROM winning_side)) THEN
          RAISE EXCEPTION 'Check the shared score and finishing team.' USING ERRCODE='22023';
        END IF;
      END LOOP;
    END IF;
  ELSIF game NOT IN ('501','301','Cricket','Other') AND (target_id IS NULL OR game IS DISTINCT FROM existing.game_type) THEN
    RAISE EXCEPTION 'New games require a versioned configuration.' USING ERRCODE='22023';
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
    IF score_value IS NOT NULL AND (score_value < 0 OR score_value > (CASE WHEN game IN ('501','301','701') THEN 180 WHEN game IN ('Cricket','Cut-Throat Cricket') THEN 9 ELSE 9999 END)
      OR (game NOT IN ('501','301','701','Cricket','Cut-Throat Cricket') AND score_value <> trunc(score_value))) THEN
      RAISE EXCEPTION 'Score is outside the supported range.' USING ERRCODE='22023';
    END IF;
    IF fmt<>'individual' AND game NOT IN ('501','301','701','Cricket','Cut-Throat Cricket') AND (score_value IS NOT NULL OR points_value IS NOT NULL) THEN
      RAISE EXCEPTION 'Shared scores belong to the team.' USING ERRCODE='22023';
    END IF;
    IF game IN ('No-Score Cricket','Around the Clock','Gotcha') AND score_value IS NOT NULL AND (score_value=0 OR participant->>'is_winner'<>'true') THEN
      RAISE EXCEPTION 'Darts to finish belong only to finishers.' USING ERRCODE='22023';
    END IF;
    IF points_value IS NOT NULL AND (game NOT IN ('Cricket','Cut-Throat Cricket') OR points_value < 0 OR points_value > 9999 OR points_value <> trunc(points_value)) THEN
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
        AND m.game_config IS NOT DISTINCT FROM config
        AND m.board_type IS NOT DISTINCT FROM board AND m.venue IS NOT DISTINCT FROM venue_value
        AND m.played_at BETWEEN played-interval '2 minutes' AND played+interval '2 minutes'
        AND (SELECT jsonb_agg(jsonb_build_object('player_id',mp.player_id,'score',mp.score,'points_scored',mp.points_scored,'is_winner',mp.is_winner) ORDER BY mp.player_id::text)
          FROM public.match_players mp WHERE mp.match_id=m.id) = participants;
      IF matching IS NOT NULL THEN RETURN jsonb_build_object('status','possible_duplicate','match_ids',matching); END IF;
    END IF;
    INSERT INTO public.matches(played_at,game_type,board_type,venue,notes,created_by,night_id,game_config)
      VALUES(played,game,board,venue_value,note_value,actor,night,config) RETURNING id INTO target_id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.match_players WHERE match_id=target_id GROUP BY player_id HAVING count(*)>1 OR player_id IS NULL) THEN
      RAISE EXCEPTION 'This legacy match has duplicate or unidentified participants and needs review.' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.match_corrections(match_id,changed_by,previous_match,previous_players)
      SELECT target_id,actor,to_jsonb(existing),coalesce(jsonb_agg(to_jsonb(mp) ORDER BY mp.id),'[]'::jsonb) FROM public.match_players mp WHERE mp.match_id=target_id;
    UPDATE public.matches SET game_config=config,played_at=played,game_type=game,board_type=board,venue=venue_value,notes=note_value WHERE id=target_id;
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

-- A parent installation may already expose an admission-checked wrapper.
-- Upgrade its private implementation, then retain the wrapper and closed grants.
-- If invitations are installed later, their parent fixture wraps this body.
DO $admission$
BEGIN
  IF to_regprocedure('invite_private.rdd_save_match(uuid,jsonb)') IS NOT NULL THEN
    EXECUTE replace(pg_get_functiondef('public.rdd_save_match(uuid,jsonb)'::regprocedure),
      'FUNCTION public.rdd_save_match(', 'FUNCTION invite_private.rdd_save_match(');
    EXECUTE $wrapper$
      CREATE OR REPLACE FUNCTION public.rdd_save_match(p_operation_id uuid,p_payload jsonb)
      RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
      BEGIN
        PERFORM invite_private.require_admission();
        RETURN invite_private.rdd_save_match(p_operation_id,p_payload);
      END; $body$;
    $wrapper$;
    REVOKE ALL ON FUNCTION invite_private.rdd_save_match(uuid,jsonb) FROM PUBLIC,anon,authenticated;
  END IF;
  IF to_regprocedure('public.league_is_member()') IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.match_corrections'::regclass AND polname='league_admission') THEN
    CREATE POLICY league_admission ON public.match_corrections AS RESTRICTIVE FOR ALL TO authenticated
      USING(public.league_is_member()) WITH CHECK(public.league_is_member());
  END IF;
END;
$admission$;

NOTIFY pgrst, 'reload schema';
COMMIT;
