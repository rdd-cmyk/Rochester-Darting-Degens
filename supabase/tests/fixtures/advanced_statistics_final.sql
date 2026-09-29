-- LOCAL / DEFERRED ONLY. Not automatic deployment SQL.
-- After foundation, invitation admission AND game_modes.sql. No seasons seeded.
begin;
-- Resolve dependencies before any grants/policies change; a wrong order fails
-- atomically. Do not install a view that assumes unavailable game semantics.
do $$ begin
  if to_regprocedure('public.league_is_member()') is null
    or not exists (select 1 from pg_attribute where attrelid='public.matches'::regclass
      and attname='game_config' and not attisdropped) then
    raise exception 'Statistics finalization requires invitation admission and game modes';
  end if;
end $$;

drop policy if exists seasons_member_read on public.seasons;
create policy seasons_member_read on public.seasons for select to authenticated
  using (public.league_is_member());
revoke all on public.seasons from public, anon, authenticated;
grant select on public.seasons to authenticated;
grant all on public.seasons to service_role;

create or replace view public.stats_match_facts with (security_invoker = true) as
select
  mp.id as match_player_id, mp.match_id, mp.player_id, mp.is_winner,
  mp.score, mp.points_scored as legacy_cricket_points,
  mp.darts_thrown, mp.x01_points_scored, mp.cricket_marks,
  m.played_at, m.game_type, m.board_type, m.venue,
  m.season_id, m.detail_level, m.entry_source,
  p.display_name, p.first_name, p.include_first_name_in_display,
  -- Append to the stage-one shape. Keep complete, versioned context intact;
  -- NULL configuration remains unknown instead of inventing a legacy preset.
  m.game_config, m.format_best_of, m.updated_at,
  mp.throw_order, mp.legs_won, mp.legs_lost, mp.first_nine_average,
  mp.checkout_attempts, mp.checkouts_made, mp.highest_checkout,
  mp.scores_100_plus, mp.scores_140_plus, mp.scores_180,
  mp.cricket_misses, mp.cricket_triple_bull_hits,
  mp.marks_5_plus, mp.marks_7_plus, mp.marks_9
from public.match_players mp
join public.matches m on m.id=mp.match_id
left join public.profiles p on p.id=mp.player_id;
revoke all on public.stats_match_facts from public, anon, authenticated;
grant select on public.stats_match_facts to authenticated, service_role;
comment on view public.stats_match_facts is
  'One canonical participant row under caller RLS. Raw fields are participant measurements, never copied from shared team totals. game_config contains team/preset/context/handicap/status; NULL is unknown. No calculations or current UI consumer.';
notify pgrst, 'reload schema';
commit;
