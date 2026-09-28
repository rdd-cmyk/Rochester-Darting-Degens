-- Deferred local fixture. Apply once AFTER League Night, planning, Board and
-- invite_only_registration.sql. Hosted deployment requires the release gate.
begin;

create policy league_admission on public.league_nights as restrictive for all to authenticated
  using(public.league_is_member()) with check(public.league_is_member());
create policy league_admission on public.league_night_attendees as restrictive for all to authenticated
  using(public.league_is_member()) with check(public.league_is_member());
create policy league_admission on public.board_members as restrictive for all to authenticated
  using(public.league_is_member()) with check(public.league_is_member());

-- Retain the reviewed parent implementations and their ownership, replay and
-- organizer checks. Move them out of the exposed API and close their grants;
-- public wrappers preserve the exact named arguments/defaults for PostgREST.
alter function public.rdd_create_night(uuid,text,text,date) set schema invite_private;
alter function public.rdd_set_attendance(uuid,uuid,boolean,bigint) set schema invite_private;
alter function public.rdd_save_match(uuid,jsonb) set schema invite_private;
alter function public.rdd_planning_night_status(uuid[]) set schema invite_private;
alter function public.rdd_planning_read(integer,integer) set schema invite_private;
alter function public.rdd_planning_write(uuid,text,jsonb) set schema invite_private;
alter function public.board_write(text,uuid,text,text,uuid) set schema invite_private;
revoke all on function invite_private.rdd_create_night(uuid,text,text,date),
  invite_private.rdd_set_attendance(uuid,uuid,boolean,bigint), invite_private.rdd_save_match(uuid,jsonb),
  invite_private.rdd_planning_night_status(uuid[]), invite_private.rdd_planning_read(integer,integer),
  invite_private.rdd_planning_write(uuid,text,jsonb), invite_private.board_write(text,uuid,text,text,uuid)
  from public,anon,authenticated;

create function invite_private.require_admission() returns void
language plpgsql set search_path='' as $$
begin
  if auth.role() is distinct from 'authenticated' or not public.league_is_member() then
    raise exception 'League membership required' using errcode='42501';
  end if;
end; $$;
revoke all on function invite_private.require_admission() from public,anon,authenticated;

create function public.rdd_create_night(p_id uuid,p_title text,p_venue text,p_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform invite_private.require_admission();
  return invite_private.rdd_create_night(p_id,p_title,p_venue,p_date);
end; $$;
create function public.rdd_set_attendance(p_night_id uuid,p_player_id uuid,p_present boolean,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform invite_private.require_admission();
  return invite_private.rdd_set_attendance(p_night_id,p_player_id,p_present,p_revision);
end; $$;
create function public.rdd_save_match(p_operation_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform invite_private.require_admission();
  return invite_private.rdd_save_match(p_operation_id,p_payload);
end; $$;
create function public.rdd_planning_night_status(p_night_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform invite_private.require_admission();
  return invite_private.rdd_planning_night_status(p_night_ids);
end; $$;
create function public.rdd_planning_read(p_poll_offset integer default 0,p_event_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform invite_private.require_admission();
  return invite_private.rdd_planning_read(p_poll_offset,p_event_offset);
end; $$;
create function public.rdd_planning_write(p_operation_id uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform invite_private.require_admission();
  return invite_private.rdd_planning_write(p_operation_id,p_action,p_payload);
end; $$;
create function public.board_write(p_action text,p_target uuid default null,p_body text default null,
  p_topic text default 'conversation',p_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform invite_private.require_admission();
  return invite_private.board_write(p_action,p_target,p_body,p_topic,p_id);
end; $$;

-- League admission never implies Board approval or organizer rights.
create or replace function public.board_is_member() returns boolean
language sql stable security definer set search_path='' as $$
  select public.league_is_member() and exists(select 1 from public.board_members where user_id=auth.uid() and status='approved');
$$;
create or replace function public.board_is_organizer() returns boolean
language sql stable security definer set search_path='' as $$
  select public.league_is_member() and exists(select 1 from public.board_members where user_id=auth.uid() and status='approved' and role='organizer');
$$;
revoke all on function public.rdd_create_night(uuid,text,text,date),public.rdd_set_attendance(uuid,uuid,boolean,bigint),
  public.rdd_save_match(uuid,jsonb),public.rdd_planning_night_status(uuid[]),public.rdd_planning_read(integer,integer),
  public.rdd_planning_write(uuid,text,jsonb),public.board_write(text,uuid,text,text,uuid),
  public.board_is_member(),public.board_is_organizer() from public,anon,authenticated;
grant execute on function public.rdd_create_night(uuid,text,text,date),public.rdd_set_attendance(uuid,uuid,boolean,bigint),
  public.rdd_save_match(uuid,jsonb),public.rdd_planning_night_status(uuid[]),public.rdd_planning_read(integer,integer),
  public.rdd_planning_write(uuid,text,jsonb),public.board_write(text,uuid,text,text,uuid),
  public.board_is_member(),public.board_is_organizer() to authenticated;
notify pgrst, 'reload schema';
commit;
