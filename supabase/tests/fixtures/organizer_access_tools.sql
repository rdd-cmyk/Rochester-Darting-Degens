-- Additive release fixture only: apply after the existing Board/invitation
-- admission fixtures. Hosted application requires the reviewed release gate.
begin;

create or replace function public.board_access_candidates(p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.board_is_organizer() or not exists(select 1 from auth.users where id=auth.uid() and (banned_until is null or banned_until<now())) then
    raise exception 'Organizer access required' using errcode='42501';
  end if;
  with candidates as (
    select pr.id as user_id, coalesce(b.status,'none') as status,
      jsonb_build_object('display_name',pr.display_name,'first_name',pr.first_name,
        'include_first_name_in_display',pr.include_first_name_in_display) as profile
    from public.profiles pr
    join public.league_members lm on lm.user_id=pr.id and lm.status='active'
    join auth.users u on u.id=pr.id and (u.banned_until is null or u.banned_until<now())
    left join public.board_members b on b.user_id=pr.id
    where b.user_id is null or (b.role='member' and b.status<>'approved')
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(q) from (
    select * from candidates order by (status='pending') desc,lower(profile->>'display_name'),user_id
      limit 50 offset greatest(0,coalesce(p_offset,0))
  ) q),'[]'::jsonb),'total',(select count(*) from candidates)) into result;
  return result;
end; $$;

create or replace function public.board_grant_access(p_target uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); granted uuid;
begin
  if actor is null or not public.board_is_organizer() then
    raise exception 'Organizer access required' using errcode='42501';
  end if;
  -- Keep organizer membership valid throughout this transaction; concurrent
  -- revocation must wait rather than race this permission check.
  perform 1 from public.board_members where user_id=actor and status='approved' and role='organizer' for share;
  if not found then raise exception 'Organizer access required' using errcode='42501'; end if;
  perform 1 from public.league_members where user_id=actor and status='active' for share;
  if not found then raise exception 'Organizer access required' using errcode='42501'; end if;
  perform 1 from auth.users where id=actor and (banned_until is null or banned_until<now()) for share;
  if not found then raise exception 'Organizer access required' using errcode='42501'; end if;
  perform 1 from public.league_members where user_id=p_target and status='active' for share;
  if not found then raise exception 'Active league member required' using errcode='P0002'; end if;
  perform 1 from auth.users where id=p_target and (banned_until is null or banned_until<now()) for share;
  if not found or not exists(select 1 from public.profiles where id=p_target) then
    raise exception 'Active league member required' using errcode='P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,410));
  if (select count(*) from public.board_write_log where user_id=actor and created_at>now()-interval '1 minute')>=30 then
    raise exception 'Please slow down and try again shortly' using errcode='P0001';
  end if;
  insert into public.board_members(user_id,status,role) values(p_target,'approved','member')
    on conflict(user_id) do update set status='approved' where board_members.role='member'
    returning user_id into granted;
  if granted is null then raise exception 'Member unavailable' using errcode='P0002'; end if;
  delete from public.board_write_log where user_id=actor and created_at<now()-interval '10 minutes';
  insert into public.board_write_log(user_id,action) values(actor,'grant_access');
  return granted;
end; $$;

-- Called only by the invitation server with an Auth.getUser-verified actor.
-- Never return the underlying invite row: it contains admission credentials.
create or replace function public.invite_list(p_actor uuid,p_page integer default 0,p_filter text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare organizer boolean; result jsonb;
begin
  if not exists(select 1 from public.league_members where user_id=p_actor and status='active')
    or not exists(select 1 from auth.users where id=p_actor and (banned_until is null or banned_until<now())) then
    return jsonb_build_object('error','membership_required');
  end if;
  if p_filter is null or p_filter not in ('all','pending','accepted','expired','revoked') then
    return jsonb_build_object('error','invalid_request');
  end if;
  organizer:=exists(select 1 from public.board_members where user_id=p_actor and status='approved' and role='organizer');
  with history as (
    select i.id,i.email,i.created_at,i.sent_at,i.accepted_at,i.expires_at,
      case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end as status,
      case when i.delivery='sending' and coalesce((select d.created_at from invite_private.deliveries d where d.id=i.last_request),i.created_at)<now()-interval '2 minutes' then 'unknown' else i.delivery end as delivery,
      i.inviter_id=p_actor as can_manage,
      case when pr.id is null then null else jsonb_build_object('display_name',pr.display_name,
        'first_name',pr.first_name,'include_first_name_in_display',pr.include_first_name_in_display) end as inviter
    from invite_private.invites i left join public.profiles pr on pr.id=i.inviter_id
    where organizer or i.inviter_id=p_actor
  ) select jsonb_build_object(
    'scope',case when organizer then 'league' else 'own' end,
    'items',coalesce((select jsonb_agg(q) from (select * from history where p_filter='all' or status=p_filter
      order by created_at desc,id limit 20 offset greatest(0,least(10000,coalesce(p_page,0)))*20) q),'[]'::jsonb),
    'total',(select count(*) from history where p_filter='all' or status=p_filter),
    'pending',(select count(*) from history where status='pending'),
    'accepted',(select count(*) from history where status='accepted')
  ) into result;
  return result;
end; $$;

revoke all on function public.board_access_candidates(integer),public.board_grant_access(uuid),public.invite_list(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.board_access_candidates(integer),public.board_grant_access(uuid) to authenticated;
grant execute on function public.invite_list(uuid,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
