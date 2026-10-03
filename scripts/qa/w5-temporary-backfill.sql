-- W5 only: exercise explicit admission of one restored identity, then roll
-- everything back. This is not an owner-approved production membership list.
begin;
do $$
declare selected_id uuid;
begin
 select u.id into selected_id from auth.users u
 join public.profiles p on p.id=u.id order by u.id limit 1;
 if selected_id is null then raise exception 'No restorable profile/Auth pair'; end if;
 insert into public.league_members(user_id,source_invite_id)
 values(selected_id,null);
 perform set_config('request.jwt.claims',
  jsonb_build_object('sub',selected_id,'role','authenticated')::text,true);
end $$;
set local role authenticated;
select jsonb_build_object(
 'member',public.league_is_member(),
 'own_profile_visible',(select count(*) from public.profiles where id=auth.uid()))::text;
rollback;
