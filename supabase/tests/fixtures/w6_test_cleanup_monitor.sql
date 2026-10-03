-- W6 isolated test project ONLY; excluded from the production release manifest.
begin;
create or replace function public.rdd_test_cleanup_health()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('healthy', coalesce((
    select j.active and j.schedule='15 7 * * *'
      and j.command='select public.invite_cleanup()'
      and r.status='succeeded' and r.end_time > now()-interval '26 hours'
    from cron.job j
    left join lateral (select status,end_time from cron.job_run_details
      where jobid=j.jobid order by runid desc limit 1) r on true
    where j.jobname='rdd-test-invite-cleanup'
  ),false));
$$;
-- The service-only monitor returns one health boolean, never recipient data.
revoke all on function public.rdd_test_cleanup_health() from public,anon,authenticated;
grant execute on function public.rdd_test_cleanup_health() to service_role;
notify pgrst,'reload schema';
commit;
