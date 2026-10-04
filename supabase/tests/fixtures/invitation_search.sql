-- Additive release fixture, after organizer_access_tools.sql. No hosted
-- application without the separate schema/RLS/backup/rollback release gate.
begin;
create or replace function public.invite_search(p_actor uuid,p_page integer default 0,p_filter text default 'all',p_search text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare organizer boolean; result jsonb; query text:=lower(btrim(coalesce(p_search,'')));
begin
  if not exists(select 1 from public.league_members where user_id=p_actor and status='active')
    or not exists(select 1 from auth.users where id=p_actor and (banned_until is null or banned_until<now())) then
    return jsonb_build_object('error','membership_required');
  end if;
  if p_filter is null or p_filter not in ('all','pending','accepted','expired','revoked') or length(query)>120 then
    return jsonb_build_object('error','invalid_request');
  end if;
  organizer:=exists(select 1 from public.board_members where user_id=p_actor and status='approved' and role='organizer');
  with history as (
    select i.id,i.email,i.created_at,i.sent_at,i.accepted_at,i.expires_at,
      case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end as status,
      case when i.delivery='sending' and coalesce((select d.created_at from invite_private.deliveries d where d.id=i.last_request),i.created_at)<now()-interval '2 minutes' then 'unknown' else i.delivery end as delivery,
      i.inviter_id=p_actor as can_manage,
      case when pr.id is null then null else jsonb_build_object('display_name',pr.display_name,
        'first_name',pr.first_name,'include_first_name_in_display',pr.include_first_name_in_display) end as inviter,
      case when pr.id is null then 'Former player'
        when nullif(btrim(pr.display_name),'') is not null then btrim(pr.display_name)||
          case when coalesce(pr.include_first_name_in_display,true) and nullif(btrim(pr.first_name),'') is not null then ' ('||btrim(pr.first_name)||')' else '' end
        else coalesce(nullif(btrim(pr.first_name),''),'Unknown player') end as sender_name
    from invite_private.invites i left join public.profiles pr on pr.id=i.inviter_id
    where organizer or i.inviter_id=p_actor
  ), searched as (
    -- Literal substring matching: % and _ are characters, not wildcards.
    select * from history where query='' or strpos(lower(email),query)>0 or strpos(lower(sender_name),query)>0
  ) select jsonb_build_object(
    'scope',case when organizer then 'league' else 'own' end,
    'items',coalesce((select jsonb_agg(q) from (
      select id,email,created_at,sent_at,accepted_at,expires_at,status,delivery,can_manage,inviter
      from searched where p_filter='all' or status=p_filter order by created_at desc,id
      limit 20 offset greatest(0,least(10000,coalesce(p_page,0)))*20
    ) q),'[]'::jsonb),
    'total',(select count(*) from searched where p_filter='all' or status=p_filter),
    'pending',(select count(*) from history where status='pending'),
    'accepted',(select count(*) from history where status='accepted')
  ) into result;
  return result;
end; $$;
revoke all on function public.invite_search(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.invite_search(uuid,integer,text,text) to service_role;
notify pgrst,'reload schema';
commit;
