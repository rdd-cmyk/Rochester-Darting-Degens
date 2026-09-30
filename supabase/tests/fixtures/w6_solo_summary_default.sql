-- Supplemental W6 default only. Existing explicit preferences are preserved.
BEGIN;
ALTER TABLE public.solo_preferences ALTER COLUMN share_summary SET DEFAULT true;
CREATE OR REPLACE FUNCTION public.rdd_solo_profile(p_owner uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NULL; END IF;
  PERFORM invite_private.require_admission();
  IF p_owner IS DISTINCT FROM auth.uid() AND NOT coalesce((SELECT share_summary FROM public.solo_preferences WHERE owner_id=p_owner),true) THEN RETURN NULL; END IF;
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
NOTIFY pgrst,'reload schema';
COMMIT;
