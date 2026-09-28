-- Local/review fixture only. Depends on League Night and game-modes fixtures.
-- Keep outside supabase/migrations until the hosted release gate is approved.
BEGIN;
CREATE TABLE public.solo_sessions (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.solo_games (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES public.profiles(id),
  session_id uuid NOT NULL REFERENCES public.solo_sessions(id),
  played_at timestamptz NOT NULL, completed_at timestamptz,
  timezone text NOT NULL, game_type text NOT NULL CHECK(game_type IN ('501','301','Cricket')),
  board_type text NOT NULL CHECK(board_type IN ('Steel Tip','Soft Tip')),
  preset text NOT NULL, status text NOT NULL CHECK(status IN ('completed','stopped')),
  score numeric, score_unit text NOT NULL CHECK(score_unit IN ('3DA','PPD','MPR')),
  raw_total numeric, darts integer,
  include_in_stats boolean NOT NULL DEFAULT true,
  night_id uuid REFERENCES public.league_nights(id) ON DELETE SET NULL,
  share_with_night boolean NOT NULL DEFAULT false,
  location text NOT NULL DEFAULT '' CHECK(length(location)<=60),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500),
  revision bigint NOT NULL DEFAULT 1, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(score IS NULL OR (score>=0 AND score<=CASE score_unit WHEN 'MPR' THEN 9 WHEN 'PPD' THEN 60 ELSE 180 END)),
  CHECK((game_type='Cricket')=(score_unit='MPR')),
  CHECK((raw_total IS NULL AND darts IS NULL) OR (raw_total>=0 AND darts>0 AND raw_total<=darts*CASE WHEN game_type='Cricket' THEN 3 ELSE 60 END)),
  CHECK(completed_at IS NULL OR completed_at>=played_at)
);
CREATE INDEX solo_owner_history ON public.solo_games(owner_id,played_at,id);
CREATE INDEX solo_night_activity ON public.solo_games(night_id,played_at,id) WHERE share_with_night AND deleted_at IS NULL;
CREATE TABLE public.solo_preferences (
  owner_id uuid PRIMARY KEY REFERENCES public.profiles(id), share_summary boolean NOT NULL DEFAULT false
);
CREATE TABLE rdd_private.solo_operations (
  owner_id uuid NOT NULL REFERENCES public.profiles(id), operation_id uuid NOT NULL,
  payload jsonb NOT NULL, game_id uuid NOT NULL REFERENCES public.solo_games(id),
  revision bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,operation_id)
);
ALTER TABLE public.solo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdd_private.solo_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY solo_sessions_own ON public.solo_sessions FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY solo_games_own ON public.solo_games FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY solo_preferences_own ON public.solo_preferences FOR SELECT TO authenticated USING(owner_id=auth.uid());
REVOKE ALL ON public.solo_games, public.solo_sessions, public.solo_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.solo_games, public.solo_sessions, public.solo_preferences TO authenticated;
REVOKE ALL ON rdd_private.solo_operations FROM PUBLIC,anon,authenticated;

-- Definer justification: only these authenticated, owner-checked operations may
-- write solo data/replay records. Projection RPCs below reveal only consented
-- summaries/activity, never private notes or locations. Fixed empty search path.
CREATE FUNCTION public.rdd_solo_write(p_operation_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); prior rdd_private.solo_operations; existing public.solo_games;
  result public.solo_games; target uuid; session uuid; action text; expected bigint;
  played timestamptz; finished timestamptz; zone text; game text; board text; rule text;
  score_value numeric; raw_value numeric; dart_value integer; unit text; result_status text;
  night uuid; share boolean; included boolean; note text; place text; saved_revision bigint;
BEGIN
  IF actor IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Sign in to save solo games.' USING ERRCODE='42501'; END IF;
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
      OR game IS NULL OR game NOT IN ('501','301','Cricket') OR board IS NULL OR board NOT IN ('Steel Tip','Soft Tip')
      OR unit IS NULL OR unit NOT IN ('3DA','PPD','MPR') OR result_status IS NULL OR result_status NOT IN ('completed','stopped')
      OR (game='Cricket')<>(unit='MPR') OR length(note)>500 OR length(place)>60
      OR rule IS NULL OR NOT (rule='unspecified' OR (game='Cricket' AND rule='cricket-v1') OR (game IN ('501','301') AND rule IN (game||'-double-v1',game||'-open-v1',game||'-dido-v1',game||'-master-v1')))
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
CREATE FUNCTION public.rdd_set_solo_visibility(p_shared boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Sign in to change solo visibility.' USING ERRCODE='42501'; END IF;
  IF p_shared IS NULL THEN RAISE EXCEPTION 'Choose a visibility setting.' USING ERRCODE='22023'; END IF;
  INSERT INTO public.solo_preferences(owner_id,share_summary) VALUES(auth.uid(),p_shared) ON CONFLICT(owner_id) DO UPDATE SET share_summary=excluded.share_summary;
END;
$$;
CREATE FUNCTION public.rdd_solo_profile(p_owner uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NULL; END IF;
  IF p_owner IS DISTINCT FROM auth.uid() AND NOT EXISTS(SELECT 1 FROM public.solo_preferences WHERE owner_id=p_owner AND share_summary) THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') INTO result FROM (
    SELECT game_type,board_type,preset,count(*) AS games,count(score) AS scored,
      sum(CASE WHEN score_unit='PPD' THEN score*3 ELSE score END) AS score_sum,
      max(CASE WHEN score_unit='PPD' THEN score*3 ELSE score END) AS best,
      count(raw_total) AS raw_games,sum(raw_total) AS raw_total_sum,sum(darts) AS darts_sum
    FROM public.solo_games WHERE owner_id=p_owner AND deleted_at IS NULL AND status='completed' AND include_in_stats
    GROUP BY game_type,board_type,preset ORDER BY game_type,board_type,preset
  ) s;
  RETURN result;
END;
$$;
CREATE FUNCTION public.rdd_solo_night(p_night uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Sign in to view night practice.' USING ERRCODE='42501'; END IF;
  -- Current nights_read policy permits every authenticated player. If that
  -- audience changes, this projection and its authorization tests must change.
  IF NOT EXISTS(SELECT 1 FROM public.league_nights WHERE id=p_night) THEN RETURN '[]'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.played_at,s.id),'[]') INTO result FROM (
    SELECT g.id,g.owner_id,g.played_at,g.game_type,g.board_type,g.status,g.preset,
      CASE WHEN g.score_unit='PPD' THEN g.score*3 ELSE g.score END AS score,
      CASE WHEN g.game_type='Cricket' THEN 'MPR' ELSE '3DA' END AS score_unit,
      p.display_name,p.first_name,p.include_first_name_in_display
    FROM public.solo_games g JOIN public.profiles p ON p.id=g.owner_id
    WHERE g.night_id=p_night AND g.share_with_night AND g.deleted_at IS NULL
  ) s;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.rdd_solo_write(uuid,jsonb),public.rdd_set_solo_visibility(boolean),public.rdd_solo_profile(uuid),public.rdd_solo_night(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rdd_solo_write(uuid,jsonb),public.rdd_set_solo_visibility(boolean),public.rdd_solo_profile(uuid),public.rdd_solo_night(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
