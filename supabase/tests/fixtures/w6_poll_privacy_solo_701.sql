-- Supplemental W6 acceptance SQL. Requires the full reviewed W5 chain.
-- Deferred for production; test on isolated targets only.
BEGIN;
CREATE OR REPLACE FUNCTION invite_private.rdd_planning_read(p_poll_offset integer DEFAULT 0, p_event_offset integer DEFAULT 0)
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
      'options',coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('votes',CASE WHEN (organizer OR p.status IN ('closed','scheduled','cancelled') OR (p.status='open' AND p.closes_at<=clock_timestamp())) THEN (SELECT count(*) FROM rdd_private.planning_votes WHERE option_id=o.id) ELSE NULL END,
        'suggested_by',CASE WHEN (organizer OR p.status IN ('closed','scheduled','cancelled') OR (p.status='open' AND p.closes_at<=clock_timestamp())) THEN o.suggested_by ELSE NULL END,
        'is_mine',o.suggested_by=actor, 'suggestion',o.suggested_by IS NOT NULL,
        'author',CASE WHEN (organizer OR p.status IN ('closed','scheduled','cancelled') OR (p.status='open' AND p.closes_at<=clock_timestamp())) THEN (SELECT jsonb_build_object('display_name',pr.display_name,'first_name',pr.first_name,'include_first_name_in_display',pr.include_first_name_in_display) FROM public.profiles pr WHERE pr.id=o.suggested_by) ELSE NULL END) ORDER BY o.created_at,o.id)
        FROM rdd_private.planning_options o WHERE o.poll_id=p.id),'[]'),
      'pairs',CASE WHEN organizer THEN coalesce((SELECT jsonb_agg(x) FROM (
        SELECT d.option_id AS date_id,v.option_id AS venue_id,count(*) AS support
        FROM rdd_private.planning_votes d JOIN rdd_private.planning_votes v ON d.poll_id=v.poll_id AND d.user_id=v.user_id
        JOIN rdd_private.planning_options od ON od.id=d.option_id AND od.kind='date' AND NOT od.withdrawn
        JOIN rdd_private.planning_options ov ON ov.id=v.option_id AND ov.kind='venue' AND NOT ov.withdrawn
        WHERE d.poll_id=p.id GROUP BY d.option_id,v.option_id) x),'[]') ELSE '[]'::jsonb END,
      'night_id',(SELECT night_id FROM rdd_private.planning_schedules WHERE source_poll=p.id)) AS item
    FROM (SELECT * FROM rdd_private.planning_polls WHERE published_at IS NOT NULL OR organizer ORDER BY created_at DESC,id LIMIT 20 OFFSET p_poll_offset) p
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
    'poll_total',(SELECT count(*) FROM rdd_private.planning_polls WHERE published_at IS NOT NULL OR organizer),
    'night_total',(SELECT count(*) FROM rdd_private.planning_schedules WHERE starts_at>=clock_timestamp()-interval '12 hours'));
END $$;


ALTER TABLE public.solo_games DROP CONSTRAINT solo_games_game_type_check;
ALTER TABLE public.solo_games ADD CONSTRAINT solo_games_game_type_check CHECK(game_type IN ('501','301','701','Cricket'));
CREATE OR REPLACE FUNCTION public.rdd_solo_write(p_operation_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); prior rdd_private.solo_operations; existing public.solo_games;
  result public.solo_games; target uuid; session uuid; action text; expected bigint;
  played timestamptz; finished timestamptz; zone text; game text; board text; rule text;
  score_value numeric; raw_value numeric; dart_value integer; unit text; result_status text;
  night uuid; share boolean; included boolean; note text; place text; saved_revision bigint;
BEGIN
  IF actor IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Sign in to save solo games.' USING ERRCODE='42501'; END IF;
  PERFORM invite_private.require_admission();
  IF p_operation_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR (p_payload->>'submitted_by')::uuid IS DISTINCT FROM actor
    OR p_payload - ARRAY['action','submitted_by','id','session_id','expected_revision','played_at','completed_at','timezone','game_type','board_type','preset','status','score','score_unit','raw_total','darts','include_in_stats','night_id','share_with_night','location','notes']::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Check your solo request and account.' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('solo-op:'||actor::text||p_operation_id::text,0));
  SELECT * INTO prior FROM rdd_private.solo_operations WHERE owner_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF prior.payload<>p_payload THEN RAISE EXCEPTION 'This save identifier has different content. Check the original save first.' USING ERRCODE='PT409'; END IF;
    SELECT * INTO result FROM public.solo_games WHERE id=prior.game_id;
    RETURN jsonb_build_object('id',prior.game_id,'revision',prior.revision,'replayed',true,'deleted',result.deleted_at IS NOT NULL);
  END IF;
  target:=(p_payload->>'id')::uuid; action:=p_payload->>'action'; expected:=(p_payload->>'expected_revision')::bigint;
  IF target IS NULL OR action IS NULL OR action NOT IN ('save','delete','restore') THEN
    RAISE EXCEPTION 'Choose a valid solo operation.' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('solo-game:'||target::text,0));
  SELECT * INTO existing FROM public.solo_games WHERE id=target FOR UPDATE;
  IF FOUND THEN
    IF existing.owner_id<>actor THEN RAISE EXCEPTION 'You can only change your own solo games.' USING ERRCODE='42501'; END IF;
    IF expected IS NULL OR existing.revision<>expected THEN RAISE EXCEPTION 'This game changed. Reload before editing.' USING ERRCODE='40001'; END IF;
    IF action='save' AND existing.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'This game was deleted. Restore it first.' USING ERRCODE='40001'; END IF;
  ELSIF action<>'save' OR expected IS NOT NULL THEN
    RAISE EXCEPTION 'This game is unavailable. Reload your history.' USING ERRCODE='40001';
  END IF;
  IF action IN ('delete','restore') THEN
    UPDATE public.solo_games SET deleted_at=CASE WHEN action='delete' THEN now() ELSE NULL END,
      revision=revision+1,updated_at=now() WHERE id=target RETURNING * INTO result;
  ELSE
    session:=(p_payload->>'session_id')::uuid;
    played:=(p_payload->>'played_at')::timestamptz; finished:=(p_payload->>'completed_at')::timestamptz;
    zone:=p_payload->>'timezone'; game:=p_payload->>'game_type'; board:=p_payload->>'board_type'; rule:=p_payload->>'preset';
    unit:=p_payload->>'score_unit'; result_status:=p_payload->>'status';
    IF jsonb_typeof(p_payload->'include_in_stats') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_payload->'share_with_night') IS DISTINCT FROM 'boolean'
      OR (p_payload->'score' IS NOT NULL AND jsonb_typeof(p_payload->'score') NOT IN ('number','null'))
      OR (p_payload->'raw_total' IS NOT NULL AND jsonb_typeof(p_payload->'raw_total') NOT IN ('number','null'))
      OR (p_payload->'darts' IS NOT NULL AND jsonb_typeof(p_payload->'darts') NOT IN ('number','null')) THEN
      RAISE EXCEPTION 'Check solo score and visibility fields.' USING ERRCODE='22023'; END IF;
    score_value:=(p_payload->>'score')::numeric; raw_value:=(p_payload->>'raw_total')::numeric; dart_value:=(p_payload->>'darts')::integer;
    included:=(p_payload->>'include_in_stats')::boolean; share:=(p_payload->>'share_with_night')::boolean;
    night:=(p_payload->>'night_id')::uuid; note:=coalesce(p_payload->>'notes',''); place:=coalesce(p_payload->>'location','');
    IF session IS NULL OR played IS NULL OR NOT isfinite(played) OR played>now()+interval '5 minutes'
      OR (finished IS NOT NULL AND (NOT isfinite(finished) OR finished<played OR finished>now()+interval '5 minutes'))
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=zone)
      OR game IS NULL OR game NOT IN ('501','301','701','Cricket') OR board IS NULL OR board NOT IN ('Steel Tip','Soft Tip')
      OR unit IS NULL OR unit NOT IN ('3DA','PPD','MPR') OR result_status IS NULL OR result_status NOT IN ('completed','stopped')
      OR (game='Cricket')<>(unit='MPR') OR length(note)>500 OR length(place)>60
      OR rule IS NULL OR NOT (rule='unspecified' OR (game='Cricket' AND rule='cricket-v1') OR (game IN ('501','301','701') AND rule IN (game||'-double-v1',game||'-open-v1',game||'-dido-v1',game||'-master-v1')))
      OR (score_value IS NOT NULL AND (score_value::text IN ('NaN','Infinity','-Infinity') OR score_value<0 OR score_value>CASE unit WHEN 'MPR' THEN 9 WHEN 'PPD' THEN 60 ELSE 180 END))
      OR ((raw_value IS NULL)<>(dart_value IS NULL)) OR (raw_value IS NOT NULL AND (raw_value::text IN ('NaN','Infinity','-Infinity') OR raw_value<0 OR dart_value<=0 OR raw_value>dart_value*CASE WHEN game='Cricket' THEN 3 ELSE 60 END))
      OR (raw_value IS NOT NULL AND raw_value<>trunc(raw_value))
      OR (p_payload->>'darts' IS NOT NULL AND (p_payload->>'darts')::numeric<>dart_value)
      OR (result_status='stopped' AND finished IS NOT NULL) THEN
      RAISE EXCEPTION 'Check the format, rules, date, score and raw-data limits.' USING ERRCODE='22023'; END IF;
    IF share AND night IS NULL THEN RAISE EXCEPTION 'Choose a night before sharing practice.' USING ERRCODE='22023'; END IF;
    IF night IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.league_nights n WHERE n.id=night AND n.night_date=(played AT TIME ZONE 'America/New_York')::date) THEN
      RAISE EXCEPTION 'Choose an existing night on the date played, or keep this game unlinked.' USING ERRCODE='22023'; END IF;
    IF existing.id IS NOT NULL AND session<>existing.session_id THEN RAISE EXCEPTION 'Keep the original session when editing.' USING ERRCODE='22023'; END IF;
    INSERT INTO public.solo_sessions(id,owner_id) VALUES(session,actor) ON CONFLICT(id) DO NOTHING;
    IF NOT EXISTS(SELECT 1 FROM public.solo_sessions WHERE id=session AND owner_id=actor) THEN
      RAISE EXCEPTION 'Choose your own practice session.' USING ERRCODE='42501'; END IF;
    INSERT INTO public.solo_games(id,owner_id,session_id,played_at,completed_at,timezone,game_type,board_type,preset,status,score,score_unit,raw_total,darts,include_in_stats,night_id,share_with_night,notes,location)
      VALUES(target,actor,session,played,finished,zone,game,board,rule,result_status,score_value,unit,raw_value,dart_value,included,night,share,note,place)
    ON CONFLICT(id) DO UPDATE SET played_at=excluded.played_at,completed_at=excluded.completed_at,timezone=excluded.timezone,
      game_type=excluded.game_type,board_type=excluded.board_type,preset=excluded.preset,status=excluded.status,score=excluded.score,
      score_unit=excluded.score_unit,raw_total=excluded.raw_total,darts=excluded.darts,include_in_stats=excluded.include_in_stats,
      night_id=excluded.night_id,share_with_night=excluded.share_with_night,notes=excluded.notes,location=excluded.location,
      revision=public.solo_games.revision+1,updated_at=now() RETURNING * INTO result;
  END IF;
  saved_revision:=result.revision;
  INSERT INTO rdd_private.solo_operations(owner_id,operation_id,payload,game_id,revision) VALUES(actor,p_operation_id,p_payload,result.id,saved_revision);
  RETURN jsonb_build_object('id',result.id,'revision',saved_revision,'replayed',false,'deleted',result.deleted_at IS NOT NULL);
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
