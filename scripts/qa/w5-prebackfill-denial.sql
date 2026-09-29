-- W5 only: choose one restored identity internally, print no UUID or row data.
-- The local copy deliberately has no owner-approved membership backfill yet.
begin;
do $$
declare selected_id uuid;
begin
 select id into selected_id from auth.users order by id limit 1;
 if selected_id is null then raise exception 'No restored Auth identity'; end if;
 perform set_config('request.jwt.claims',
  jsonb_build_object('sub',selected_id,'role','authenticated')::text,true);
end $$;
set local role authenticated;
select jsonb_build_object(
 'member',public.league_is_member(),
 'visible_profiles',(select count(*) from public.profiles),
 'visible_matches',(select count(*) from public.matches))::text;
rollback;
