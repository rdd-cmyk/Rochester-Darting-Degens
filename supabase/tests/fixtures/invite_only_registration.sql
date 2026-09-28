-- Deferred fixture ONLY. Hosted rollout requires the repository release gate.
-- Apply once after the baseline/statistics fixtures. No automatic grandfathering:
-- admission of existing accounts is a separate, reviewed cutoff operation.
begin;
create schema invite_private;
revoke all on schema invite_private from public, anon, authenticated;

create table invite_private.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id),
  email text not null check (email = lower(btrim(email)) and length(email) <= 254),
  token_hash text not null unique,
  version integer not null default 1,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id),
  revoked_at timestamptz,
  delivery text not null default 'sending' check (delivery in ('sending','sent','failed','unknown')),
  last_request uuid not null,
  operation_id uuid,
  provisioned_user_id uuid references auth.users(id)
);
create unique index invite_one_pending_email on invite_private.invites(email) where status='pending';
create index invite_sender_history on invite_private.invites(inviter_id,created_at desc,id);

create table public.league_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check(status in ('active','revoked')),
  source_invite_id uuid references invite_private.invites(id),
  admitted_at timestamptz not null default now()
);
alter table public.league_members enable row level security;
revoke all on public.league_members from public,anon,authenticated;
grant select on public.league_members to authenticated;
create policy league_members_self on public.league_members for select to authenticated using(user_id=auth.uid());

create function public.league_is_member() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.league_members where user_id=auth.uid() and status='active');
$$;
revoke all on function public.league_is_member() from public,anon,authenticated;
grant execute on function public.league_is_member() to authenticated;

-- Restrictive policies are ANDed with every existing permissive policy. This
-- preserves ownership checks and closes all existing authenticated access paths.
create policy league_admission on public.profiles as restrictive for all to authenticated
  using(public.league_is_member()) with check(public.league_is_member());
create policy league_admission on public.matches as restrictive for all to authenticated
  using(public.league_is_member()) with check(public.league_is_member());
create policy league_admission on public.match_players as restrictive for all to authenticated
  using(public.league_is_member()) with check(public.league_is_member());
create policy league_admission on public.seasons as restrictive for all to authenticated
  using(public.league_is_member()) with check(public.league_is_member());
-- Anonymous season metadata was previously public. This version closes it too.
create policy league_no_anonymous on public.seasons as restrictive for all to anon using(false) with check(false);

create table invite_private.challenges (
  id uuid primary key,
  invite_id uuid not null references invite_private.invites(id),
  version integer not null,
  browser_hash text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '10 minutes',
  attempts integer not null default 0,
  verified boolean not null default false,
  profile jsonb,
  completed_at timestamptz
);
create index invite_challenges on invite_private.challenges(invite_id,created_at desc);
create table invite_private.requests (
  id uuid primary key,
  actor uuid not null,
  action text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create table invite_private.deliveries (
  id uuid primary key,
  invite_id uuid not null references invite_private.invites(id),
  kind text not null check(kind in ('invite','code')),
  state text not null default 'sending',
  provider_id text,
  created_at timestamptz not null default now()
);
create table invite_private.rate_buckets (
  key text primary key,
  started_at timestamptz not null default now(),
  uses integer not null default 1
);
revoke all on all tables in schema invite_private from public,anon,authenticated;

create function invite_private.consume(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql set search_path='' as $$
declare n integer;
begin
  insert into invite_private.rate_buckets(key) values(p_key)
  on conflict(key) do update set
    uses=case when invite_private.rate_buckets.started_at < now()-make_interval(secs=>p_seconds) then 1 else invite_private.rate_buckets.uses+1 end,
    started_at=case when invite_private.rate_buckets.started_at < now()-make_interval(secs=>p_seconds) then now() else invite_private.rate_buckets.started_at end
  returning uses into n;
  return n <= p_limit;
end;
$$;

-- All callers are trusted server code using service_role. p_actor is derived
-- from Auth.getUser, never accepted from the browser. No credential in result
-- may be forwarded directly to the client: routes return explicit safe shapes.
create or replace function invite_private.same_digest(p_left text,p_right text) returns boolean
language plpgsql immutable set search_path='' as $$
declare difference integer:=0; position integer;
begin
  if p_left is null or p_right is null or length(p_left)<>length(p_right) then return false; end if;
  for position in 1..length(p_left) loop
    difference:=difference | (ascii(substr(p_left,position,1)) # ascii(substr(p_right,position,1)));
  end loop;
  return difference=0;
end;
$$;
revoke all on function invite_private.same_digest(text,text) from public,anon,authenticated;

create or replace function public.invite_service(p_action text,p_actor uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  i invite_private.invites;
  c invite_private.challenges;
  r invite_private.requests;
  u auth.users;
  rid uuid;
  answer jsonb;
  payload jsonb;
  actor_name text;
  page_no integer;
  filter_status text;
begin
  if p_action in ('list','create','resend','revoke') then
    if not exists(select 1 from public.league_members where user_id=p_actor and status='active')
      or not exists(select 1 from auth.users where id=p_actor and (banned_until is null or banned_until < now())) then
      return jsonb_build_object('error','membership_required');
    end if;
  end if;

  if p_action='list' then
    page_no:=greatest(0,least(10000,coalesce((p_data->>'page')::integer,0)));
    filter_status:=coalesce(p_data->>'filter','all');
    with history as (
      select id,email,created_at,sent_at,accepted_at,expires_at,
        case when status='pending' and expires_at<=now() then 'expired' else status end as status,
        case when delivery='sending' and coalesce((select d.created_at from invite_private.deliveries d where d.id=last_request),created_at)<now()-interval '2 minutes' then 'unknown' else delivery end as delivery
      from invite_private.invites where inviter_id=p_actor
    ) select jsonb_build_object(
      'items',coalesce((select jsonb_agg(q) from (select * from history where filter_status='all' or status=filter_status order by created_at desc,id limit 20 offset page_no*20) q),'[]'::jsonb),
      'total',(select count(*) from history where filter_status='all' or status=filter_status),
      'pending',(select count(*) from history where status='pending'),
      'accepted',(select count(*) from history where status='accepted')
    ) into answer;
    return answer;
  end if;

  if p_action in ('create','resend','revoke') then
    rid:=(p_data->>'request_id')::uuid;
    -- Serializes retries even across separate app processes.
    perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
    payload:=p_data - 'token_hash' - 'ip_hash';
    select * into r from invite_private.requests where id=rid;
    if found then
      if r.actor<>p_actor or r.action<>p_action or r.payload<>payload then return jsonb_build_object('error','retry_conflict'); end if;
      -- Never send again on an uncertain response. The history page offers a
      -- deliberate resend with a new ID/version and a new link.
      return r.result || jsonb_build_object('replayed',true);
    end if;
    if not invite_private.consume('member:'||p_actor,30,3600) then return jsonb_build_object('error','rate_limited'); end if;

    if p_action='create' then
      perform pg_advisory_xact_lock(hashtextextended(p_data->>'email',1));
      if exists(select 1 from auth.users a join public.league_members m on m.user_id=a.id where lower(a.email)=p_data->>'email')
        or exists(select 1 from invite_private.invites where email=p_data->>'email' and status='pending' and expires_at>now()) then
        answer:=jsonb_build_object('neutral',true);
      else
        if not invite_private.consume('new:'||p_actor,5,86400)
          or not invite_private.consume('email:'||(p_data->>'email'),5,86400)
          or not invite_private.consume('send-ip:'||(p_data->>'ip_hash'),30,3600)
          or not invite_private.consume('send-global',200,3600) then return jsonb_build_object('error','rate_limited'); end if;
        update invite_private.invites set status='expired' where email=p_data->>'email' and status='pending' and expires_at<=now();
        insert into invite_private.invites(inviter_id,email,token_hash,last_request)
          values(p_actor,p_data->>'email',p_data->>'token_hash',rid) returning * into i;
        answer:=jsonb_build_object('id',i.id,'email',i.email);
      end if;
    else
      if p_action='resend' then
        perform pg_advisory_xact_lock(hashtextextended((select email from invite_private.invites where id=(p_data->>'id')::uuid and inviter_id=p_actor),1));
      end if;
      select * into i from invite_private.invites where id=(p_data->>'id')::uuid and inviter_id=p_actor for update;
      if not found or i.status in ('accepted','revoked') then return jsonb_build_object('error','unavailable'); end if;
      if p_action='revoke' then
        update invite_private.invites set status='revoked',revoked_at=now() where id=i.id;
        delete from invite_private.challenges where invite_id=i.id;
        answer:=jsonb_build_object('id',i.id,'revoked',true);
      else
        if exists(select 1 from auth.users a join public.league_members m on m.user_id=a.id where lower(a.email)=i.email) then
          answer:=jsonb_build_object('neutral',true);
        else
          if exists(select 1 from invite_private.invites where email=i.email and id<>i.id and status='pending' and expires_at>now()) then return jsonb_build_object('error','unavailable'); end if;
          update invite_private.invites set status='expired' where email=i.email and id<>i.id and status='pending' and expires_at<=now();
          if exists(select 1 from invite_private.deliveries where invite_id=i.id and kind='invite' and created_at>now()-interval '60 seconds')
            or not invite_private.consume('email:'||i.email,5,86400)
            or not invite_private.consume('send-ip:'||(p_data->>'ip_hash'),30,3600)
            or not invite_private.consume('send-global',200,3600) then return jsonb_build_object('error','rate_limited'); end if;
          update invite_private.invites set token_hash=p_data->>'token_hash',version=version+1,status='pending',
            expires_at=now()+interval '7 days',delivery='sending',last_request=rid where id=i.id;
          delete from invite_private.challenges where invite_id=i.id;
          answer:=jsonb_build_object('id',i.id,'email',i.email);
        end if;
      end if;
    end if;
    if p_action<>'revoke' and not coalesce((answer->>'neutral')::boolean,false) then
      select coalesce(nullif(display_name,''),'A league member') into actor_name from public.profiles where id=p_actor;
      answer:=answer||jsonb_build_object('inviter',coalesce(actor_name,'A league member'));
      insert into invite_private.deliveries(id,invite_id,kind) values(rid,(answer->>'id')::uuid,'invite');
    end if;
    insert into invite_private.requests(id,actor,action,payload,result) values(rid,p_actor,p_action,payload,answer);
    return answer;
  end if;

  if p_action='delivery' then
    update invite_private.deliveries set state=p_data->>'state',provider_id=p_data->>'provider_id' where id=(p_data->>'request_id')::uuid;
    update invite_private.invites set delivery=p_data->>'state',sent_at=case when p_data->>'state'='sent' then now() else sent_at end
      where last_request=(p_data->>'request_id')::uuid;
    return '{}'::jsonb;
  end if;

  if p_action in ('preview','challenge') then
    if not invite_private.consume('join-ip:'||(p_data->>'ip_hash'),100,3600)
      or not invite_private.consume('join-global',3000,3600) then return jsonb_build_object('error','rate_limited'); end if;
    select * into i from invite_private.invites where token_hash=p_data->>'token_hash' for update;
    if not found or i.status<>'pending' or i.expires_at<=now() then return jsonb_build_object('error','unavailable'); end if;
    select coalesce(nullif(display_name,''),'A league member') into actor_name from public.profiles where id=i.inviter_id;
    if p_action='preview' then
      return jsonb_build_object('inviter',coalesce(actor_name,'A league member'),
        'email_hint',left(i.email,1)||'***@'||split_part(i.email,'@',2),'expires_at',i.expires_at);
    end if;
    if exists(select 1 from invite_private.challenges where invite_id=i.id and created_at>now()-interval '60 seconds')
      or not invite_private.consume('code:'||i.id,10,3600)
      or not invite_private.consume('code-global',500,3600) then return jsonb_build_object('error','rate_limited'); end if;
    delete from invite_private.challenges where invite_id=i.id and completed_at is null;
    insert into invite_private.challenges(id,invite_id,version,browser_hash,code_hash)
      values((p_data->>'challenge_id')::uuid,i.id,i.version,p_data->>'browser_hash',p_data->>'code_hash');
    insert into invite_private.deliveries(id,invite_id,kind) values((p_data->>'challenge_id')::uuid,i.id,'code');
    return jsonb_build_object('email',i.email);
  end if;

  if p_action in ('reserve','finalize') then
    -- Lock invite before challenge, matching revoke/resend order.
    select * into i from invite_private.invites where id=(select invite_id from invite_private.challenges where id=(p_data->>'challenge_id')::uuid) for update;
    select * into c from invite_private.challenges where id=(p_data->>'challenge_id')::uuid for update;
    if c.id is null or not invite_private.same_digest(c.browser_hash,p_data->>'browser_hash') or c.expires_at<=now()
      or i.status in ('revoked','expired') or i.expires_at<=now() or i.version<>c.version then return jsonb_build_object('error','unavailable'); end if;
    if i.status='accepted' and c.completed_at is not null then return jsonb_build_object('accepted',true); end if;
    if i.status<>'pending' then return jsonb_build_object('error','unavailable'); end if;
    if p_action='reserve' then
      if not c.verified then
        if c.attempts>=5 then return jsonb_build_object('error','code_locked'); end if;
        update invite_private.challenges set attempts=attempts+1 where id=c.id;
        if not invite_private.same_digest(c.code_hash,p_data->>'code_hash') then return jsonb_build_object('error','invalid_code'); end if;
        update invite_private.challenges set verified=true,profile=p_data->'profile' where id=c.id;
      elsif c.profile<>p_data->'profile' then
        return jsonb_build_object('error','retry_conflict');
      end if;
      update invite_private.invites set operation_id=coalesce(operation_id,c.id) where id=i.id returning * into i;
      select * into u from auth.users where lower(email)=i.email;
      if u.id is not null then
        if exists(select 1 from public.league_members where user_id=u.id and status='revoked') then return jsonb_build_object('error','unavailable'); end if;
        if exists(select 1 from public.league_members where user_id=u.id and source_invite_id is distinct from i.id) then return jsonb_build_object('error','unavailable'); end if;
        -- app_metadata is set only by our privileged createUser call. Editable
        -- user_metadata is deliberately never considered proof of ownership.
        -- A new challenge cannot silently reuse the password from an earlier
        -- provisioning attempt; its recipient must sign in first.
        if (c.id is distinct from i.operation_id or u.raw_app_meta_data->>'invite_operation' is distinct from i.operation_id::text)
          and p_actor is distinct from u.id then
          return jsonb_build_object('error','sign_in_required');
        end if;
      end if;
      return jsonb_build_object('email',i.email,'operation_id',i.operation_id,'user_id',u.id,'invite_id',i.id);
    end if;
    if not c.verified then return jsonb_build_object('error','invalid_code'); end if;
    select * into u from auth.users where id=(p_data->>'user_id')::uuid and lower(email)=i.email and email_confirmed_at is not null;
    if u.id is null or ((c.id is distinct from i.operation_id or u.raw_app_meta_data->>'invite_operation' is distinct from i.operation_id::text) and p_actor is distinct from u.id)
      or (u.banned_until is not null and u.banned_until>now()) then return jsonb_build_object('error','unavailable'); end if;
    if exists(select 1 from public.league_members where user_id=u.id and status='revoked') then return jsonb_build_object('error','unavailable'); end if;
    if exists(select 1 from public.league_members where user_id=u.id and source_invite_id is distinct from i.id) then return jsonb_build_object('error','unavailable'); end if;
    insert into public.profiles(id,display_name,first_name,last_name,include_first_name_in_display)
      values(u.id,c.profile->>'displayName',c.profile->>'firstName',c.profile->>'lastName',true) on conflict(id) do nothing;
    insert into public.league_members(user_id,source_invite_id) values(u.id,i.id) on conflict(user_id) do nothing;
    update invite_private.invites set status='accepted',accepted_at=now(),accepted_user_id=u.id,provisioned_user_id=u.id where id=i.id;
    update invite_private.challenges set completed_at=now(),code_hash='' where id=c.id;
    return jsonb_build_object('accepted',true);
  end if;
  return jsonb_build_object('error','invalid_request');
end;
$$;
revoke all on function invite_private.consume(text,integer,integer) from public,anon,authenticated;
revoke all on function public.invite_service(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.invite_service(text,uuid,jsonb) to service_role;

-- Call daily from an approved server-side job (never from a browser). Request
-- IDs stay as payload-aware replay records; history retention is a release policy.
create or replace function public.invite_cleanup() returns void language sql security definer set search_path='' as $$
  delete from invite_private.challenges where expires_at<now();
  delete from invite_private.rate_buckets where started_at<now()-interval '2 days';
  update invite_private.invites set status='expired' where status='pending' and expires_at<now();
$$;
revoke all on function public.invite_cleanup() from public,anon,authenticated;
grant execute on function public.invite_cleanup() to service_role;
commit;
