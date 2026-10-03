-- Local-only additive fixture. Hosted rollout requires the repository release gate.
-- No membership is inferred from public signup or editable user metadata.
begin;
create table public.board_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  role text not null default 'member' check (role in ('member','organizer')),
  created_at timestamptz not null default now()
);
create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  topic text not null default 'conversation' check (topic in ('conversation','sub','practice','highlight','announcement')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity timestamptz not null default now(),
  pinned boolean not null default false,
  locked boolean not null default false,
  hidden boolean not null default false,
  deleted boolean not null default false
);
create unique index board_one_pin on public.board_posts(pinned) where pinned;
create index board_feed_order on public.board_posts(last_activity desc, id desc) where not hidden and not deleted;
create table public.board_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hidden boolean not null default false,
  deleted boolean not null default false
);
create index board_reply_order on public.board_replies(post_id, created_at, id);
create table public.board_reactions (
  post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id,user_id)
);
create table public.board_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  post_id uuid not null references public.board_posts(id) on delete cascade,
  reply_id uuid references public.board_replies(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);
create unique index board_report_once on public.board_reports(reporter_id, post_id, coalesce(reply_id,'00000000-0000-0000-0000-000000000000'::uuid)) where not resolved;
create table public.board_write_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index board_rate_lookup on public.board_write_log(user_id,created_at);

create function public.board_is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.board_members where user_id=auth.uid() and status='approved');
$$;
create function public.board_is_organizer() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.board_members where user_id=auth.uid() and status='approved' and role='organizer');
$$;

alter table public.board_members enable row level security;
alter table public.board_posts enable row level security;
alter table public.board_replies enable row level security;
alter table public.board_reactions enable row level security;
alter table public.board_reports enable row level security;
alter table public.board_write_log enable row level security;
create policy board_members_read on public.board_members for select to authenticated using (user_id=auth.uid() or public.board_is_organizer());
create policy board_posts_read on public.board_posts for select to authenticated using (public.board_is_member() and not deleted and (not hidden or public.board_is_organizer()));
create policy board_replies_read on public.board_replies for select to authenticated using (
  public.board_is_member() and not deleted and (not hidden or public.board_is_organizer()) and exists(
    select 1 from public.board_posts p where p.id=post_id and not p.deleted and (not p.hidden or public.board_is_organizer())));
create policy board_reactions_read on public.board_reactions for select to authenticated using (
  public.board_is_member() and exists(select 1 from public.board_posts p where p.id=post_id));
create policy board_reports_read on public.board_reports for select to authenticated using (public.board_is_organizer());
-- The baseline grants broad defaults. Explicitly close every new table/function.
revoke all on public.board_members,public.board_posts,public.board_replies,public.board_reactions,public.board_reports,public.board_write_log from public,anon,authenticated;
grant select on public.board_members,public.board_posts,public.board_replies,public.board_reactions,public.board_reports to authenticated;

create function public.board_feed(p_before timestamptz default null, p_before_id uuid default null,
  p_limit integer default 20, p_id uuid default null, p_pinned boolean default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.board_is_member() then raise exception 'Board membership required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(item order by last_activity desc, id desc),'[]'::jsonb) into result from (
    select p.last_activity,p.id,to_jsonb(p) || jsonb_build_object(
      'profile',case when pr.id is null then null else jsonb_build_object('display_name',pr.display_name,'first_name',pr.first_name,'include_first_name_in_display',pr.include_first_name_in_display) end,
      'reply_count',(select count(*) from public.board_replies r where r.post_id=p.id and not r.hidden and not r.deleted),
      'reaction_count',(select count(*) from public.board_reactions r where r.post_id=p.id),
      'reacted',exists(select 1 from public.board_reactions r where r.post_id=p.id and r.user_id=auth.uid())
    ) as item from public.board_posts p left join public.profiles pr on pr.id=p.author_id
    where not p.hidden and not p.deleted and (p_id is null or p.id=p_id)
      and (p_pinned is null or p.pinned=p_pinned)
      and (p_before is null or (p.last_activity,p.id)<(p_before,p_before_id))
    order by p.last_activity desc,p.id desc limit greatest(1,least(coalesce(p_limit,20),50))
  ) q;
  return result;
end; $$;

create function public.board_thread(p_post uuid, p_after timestamptz default null, p_after_id uuid default null, p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.board_is_member() then raise exception 'Board membership required' using errcode='42501'; end if;
  if not exists(select 1 from public.board_posts where id=p_post and not hidden and not deleted) then
    raise exception 'Conversation unavailable' using errcode='P0002';
  end if;
  select coalesce(jsonb_agg(item order by created_at,id),'[]'::jsonb) into result from (
    select r.created_at,r.id,to_jsonb(r) || jsonb_build_object('profile',case when pr.id is null then null else
      jsonb_build_object('display_name',pr.display_name,'first_name',pr.first_name,'include_first_name_in_display',pr.include_first_name_in_display) end) item
    from public.board_replies r left join public.profiles pr on pr.id=r.author_id
    where r.post_id=p_post and not r.hidden and not r.deleted and (p_after is null or (r.created_at,r.id)>(p_after,p_after_id))
    order by r.created_at,r.id limit greatest(1,least(coalesce(p_limit,30),50))
  ) q;
  return result;
end; $$;

create function public.board_admin(p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.board_is_organizer() then raise exception 'Organizer access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'members',(select coalesce(jsonb_agg(item),'[]'::jsonb) from (
      select to_jsonb(m)||jsonb_build_object('profile',jsonb_build_object('display_name',pr.display_name,'first_name',pr.first_name,'include_first_name_in_display',pr.include_first_name_in_display)) item
      from public.board_members m join public.profiles pr on pr.id=m.user_id order by (m.status='pending') desc,m.created_at,m.user_id limit 50 offset greatest(0,coalesce(p_offset,0))) q),
    'reports',(select coalesce(jsonb_agg(item),'[]'::jsonb) from (
      select to_jsonb(r)||jsonb_build_object('body',coalesce(br.body,p.body)) item from public.board_reports r
      join public.board_posts p on p.id=r.post_id left join public.board_replies br on br.id=r.reply_id
      where not r.resolved order by r.created_at,r.id limit 50 offset greatest(0,coalesce(p_offset,0))) q),
    'hidden',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
      select id,body,'post'::text as kind from public.board_posts where hidden and not deleted
      union all select id,body,'reply'::text from public.board_replies where hidden and not deleted
      order by id limit 50 offset greatest(0,coalesce(p_offset,0))) q));
end; $$;

-- All writes use one authenticated transaction. No service key is needed in the app.
-- UUIDs supplied by the composer make retrying a timed-out create idempotent.
create function public.board_write(p_action text, p_target uuid default null, p_body text default null,
  p_topic text default 'conversation', p_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  organizer boolean;
  post public.board_posts;
  reply public.board_replies;
  target_post uuid;
  result uuid;
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=actor) then raise exception 'Complete your player profile first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 410));
  if p_action='request_access' then
    insert into public.board_members(user_id) values(actor) on conflict(user_id) do nothing;
    return actor;
  end if;
  if not public.board_is_member() then raise exception 'Board membership required' using errcode='42501'; end if;
  organizer := public.board_is_organizer();
  if p_action in ('create_post','create_reply') and p_id is not null then
    if p_action='create_post' then
      select * into post from public.board_posts where id=p_id and author_id=actor;
      if found then
        if post.body is distinct from btrim(p_body) or post.topic is distinct from p_topic then
          raise exception 'This attempt already saved different content' using errcode='PT409';
        end if;
        return p_id;
      end if;
    else
      select * into reply from public.board_replies where id=p_id and author_id=actor and post_id=p_target;
      if found then
        if reply.body is distinct from btrim(p_body) then
          raise exception 'This attempt already saved different content' using errcode='PT409';
        end if;
        return p_id;
      end if;
    end if;
  end if;
  if (select count(*) from public.board_write_log where user_id=actor and created_at>now()-interval '1 minute')>=30
    or (p_action='create_post' and (select count(*) from public.board_write_log where user_id=actor and action=p_action and created_at>now()-interval '10 minutes')>=5)
    or (p_action='create_reply' and (select count(*) from public.board_write_log where user_id=actor and action=p_action and created_at>now()-interval '10 minutes')>=20) then
    raise exception 'Please slow down and try again shortly' using errcode='P0001';
  end if;
  delete from public.board_write_log where user_id=actor and created_at<now()-interval '10 minutes';
  insert into public.board_write_log(user_id,action) values(actor,p_action);
  if p_action in ('approve_member','revoke_member') then
    if not organizer then raise exception 'Organizer access required' using errcode='42501'; end if;
    update public.board_members set status=case when p_action='approve_member' then 'approved' else 'revoked' end
      where user_id=p_target and role='member';
    if not found then raise exception 'Member unavailable' using errcode='P0002'; end if;
    return p_target;
  end if;
  if p_action='resolve_report' then
    if not organizer then raise exception 'Organizer access required' using errcode='42501'; end if;
    update public.board_reports set resolved=true where id=p_target;
    if not found then raise exception 'Report unavailable' using errcode='P0002'; end if;
    return p_target;
  end if;
  if p_action in ('create_post','create_reply','edit_post','edit_reply') and (p_body is null or length(btrim(p_body)) not between 1 and 2000) then
    raise exception 'Write between 1 and 2,000 characters' using errcode='22023';
  end if;
  if p_action='create_post' then
    if p_topic='announcement' and not organizer then raise exception 'Organizer access required' using errcode='42501'; end if;
    insert into public.board_posts(id,author_id,body,topic) values(coalesce(p_id,gen_random_uuid()),actor,btrim(p_body),p_topic) returning id into result;
    return result;
  end if;
  if p_action in ('edit_reply','delete_reply','hide_reply','restore_reply','report_reply') then
    -- Lock the parent before its replies: every mutation uses this lock order.
    select post_id into target_post from public.board_replies where id=p_target;
  else target_post := p_target;
  end if;
  select * into post from public.board_posts where id=target_post for update;
  if post.id is null or post.deleted or (post.hidden and not organizer) then raise exception 'Conversation unavailable' using errcode='P0002'; end if;
  if p_action in ('edit_reply','delete_reply','hide_reply','restore_reply','report_reply') then
    select * into reply from public.board_replies where id=p_target for update;
    if reply.id is null or reply.deleted or (reply.hidden and not organizer) then raise exception 'Reply unavailable' using errcode='P0002'; end if;
  end if;
  if p_action in ('pin','unpin','lock','unlock','hide_post','restore_post','hide_reply','restore_reply') then
    if not organizer then raise exception 'Organizer access required' using errcode='42501'; end if;
    if p_action='pin' then
      -- A concurrent pin can fail the unique constraint; it can never create two pins.
      update public.board_posts set pinned=false where pinned;
      update public.board_posts set pinned=true where id=post.id and not hidden;
    elsif p_action='unpin' then update public.board_posts set pinned=false where id=post.id;
    elsif p_action in ('lock','unlock') then update public.board_posts set locked=(p_action='lock') where id=post.id;
    elsif p_action in ('hide_post','restore_post') then update public.board_posts set hidden=(p_action='hide_post'),pinned=false where id=post.id;
    else update public.board_replies set hidden=(p_action='hide_reply') where id=reply.id;
    end if;
  elsif p_action='delete_post' then
    if post.author_id is distinct from actor then raise exception 'Only the author can delete this post' using errcode='42501'; end if;
    update public.board_posts set deleted=true,body='[Post deleted]',pinned=false where id=post.id;
    update public.board_replies set deleted=true,body='[Reply deleted]' where post_id=post.id;
  elsif p_action='delete_reply' then
    if reply.author_id is distinct from actor then raise exception 'Only the author can delete this reply' using errcode='42501'; end if;
    update public.board_replies set deleted=true,body='[Reply deleted]' where id=reply.id;
  elsif p_action in ('report_post','report_reply') then
    if p_body is null or length(btrim(p_body)) not between 1 and 500 then raise exception 'Add a reason, up to 500 characters' using errcode='22023'; end if;
    insert into public.board_reports(reporter_id,post_id,reply_id,reason) values(actor,post.id,reply.id,btrim(p_body)) on conflict do nothing;
  elsif p_action in ('create_reply','edit_post','edit_reply','react','unreact') then
    if post.locked or post.hidden then raise exception 'This conversation is closed' using errcode='42501'; end if;
    if p_action='create_reply' then
      insert into public.board_replies(id,post_id,author_id,body) values(coalesce(p_id,gen_random_uuid()),post.id,actor,btrim(p_body)) returning id into result;
      update public.board_posts set last_activity=now() where id=post.id;
      return result;
    elsif p_action='edit_post' then
      if post.author_id is distinct from actor then raise exception 'Only the author can edit this post' using errcode='42501'; end if;
      update public.board_posts set body=btrim(p_body),updated_at=now() where id=post.id;
    elsif p_action='edit_reply' then
      if reply.author_id is distinct from actor then raise exception 'Only the author can edit this reply' using errcode='42501'; end if;
      update public.board_replies set body=btrim(p_body),updated_at=now() where id=reply.id;
    elsif p_action='react' then insert into public.board_reactions(post_id,user_id) values(post.id,actor) on conflict do nothing;
    else delete from public.board_reactions where post_id=post.id and user_id=actor;
    end if;
  else raise exception 'Unknown board action' using errcode='22023';
  end if;
  if p_action in ('delete_reply','hide_reply','restore_reply') then
    update public.board_posts set last_activity=greatest(created_at,coalesce((select max(created_at) from public.board_replies where post_id=post.id and not hidden and not deleted),created_at)) where id=post.id;
  end if;
  return p_target;
end; $$;

revoke all on function public.board_is_member(),public.board_is_organizer(),
  public.board_feed(timestamptz,uuid,integer,uuid,boolean),public.board_thread(uuid,timestamptz,uuid,integer),
  public.board_admin(integer),public.board_write(text,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.board_is_member(),public.board_is_organizer(),
  public.board_feed(timestamptz,uuid,integer,uuid,boolean),public.board_thread(uuid,timestamptz,uuid,integer),
  public.board_admin(integer),public.board_write(text,uuid,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
