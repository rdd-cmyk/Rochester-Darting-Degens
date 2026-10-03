-- Full-chain synthetic security catalog and admission tests, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(relrowsecurity,'RLS enabled: '||relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' order by relname;
select ok(not has_schema_privilege('authenticated',nspname,'USAGE'),'Private schema denied: '||nspname)
 from pg_namespace where nspname in ('rdd_private','invite_private','rivalry_private');
select ok(not has_function_privilege('authenticated',p.oid,'EXECUTE'),'Private function denied: '||p.oid::regprocedure::text)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('rdd_private','invite_private','rivalry_private') order by p.oid::regprocedure::text;
select ok(not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'),'Private table denied: '||n.nspname||'.'||c.relname)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('rdd_private','invite_private','rivalry_private') and c.relkind='r' order by c.relname;
select ok(not has_table_privilege('anon','public.seasons','SELECT'),'Anonymous season grants closed');
select ok(not has_table_privilege('anon','public.stats_match_facts','SELECT'),'Anonymous future-view grants closed');
select ok(not has_table_privilege('authenticated','public.matches','INSERT,UPDATE,DELETE,TRUNCATE'),'Canonical matches RPC-only');
select ok(not has_table_privilege('authenticated','public.match_players','INSERT,UPDATE,DELETE,TRUNCATE'),'Canonical participants RPC-only');
select ok(pg_get_functiondef('public.rdd_save_match(uuid,jsonb)'::regprocedure) like '%rivalry_private.base_save_match%', 'Final outer Rivalry save wrapper installed');
select ok(pg_get_functiondef('rivalry_private.base_save_match(uuid,jsonb)'::regprocedure) like '%require_admission%', 'Inner admission wrapper preserved');
select ok(pg_get_functiondef('invite_private.rdd_save_match(uuid,jsonb)'::regprocedure) like '%game_config%', 'Underlying game-aware implementation preserved');
select results_eq('select id,played_at,game_type,created_by,notes,board_type,venue from public.matches order by id',
 'select * from rdd_rehearsal.original_matches order by id','All original match columns survive entire chain');
insert into auth.users(id) values('00000000-0000-4000-8000-000000000301');
insert into public.profiles(id,display_name) values('00000000-0000-4000-8000-000000000301','Fictional provisional');
create temp table rpc_matrix as
 select p.proname,p.oid::regprocedure::text as identity,
  format('SELECT public.%I(%s)',p.proname,coalesce((select string_agg('NULL::'||t::regtype::text,',' order by i)
    from unnest(p.proargtypes::oid[]) with ordinality as arg(t,i)),'')) as statement
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'rdd_%' or p.proname like 'board_%' or p.proname like 'invite_%')
 and p.prorettype<>'trigger'::regtype and p.proname not in ('board_is_member','board_is_organizer');
grant select on rpc_matrix to anon,authenticated;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok(statement,'42501',null,'Anonymous RPC denied: '||identity) from rpc_matrix order by identity;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000301"}',true);
select is(public.league_is_member(),false,'Provisional league check is false');
select is(public.board_is_member(),false,'Provisional Board check is false');
select throws_ok(statement,'42501',null,'Provisional RPC denied: '||identity) from rpc_matrix order by identity;
select is((select count(*)::integer from public.profiles),0,'Provisional cannot read populated profiles');
select is((select count(*)::integer from public.matches),0,'Provisional cannot read populated matches');
select is((select count(*)::integer from public.match_players),0,'Provisional cannot read populated participants');
select is((select count(*)::integer from public.stats_match_facts),0,'Provisional cannot read populated facts');
reset role;
insert into public.league_members(user_id,status) values('00000000-0000-4000-8000-000000000301','revoked');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000301"}',true);
select throws_ok(statement,'42501',null,'Revoked RPC denied: '||identity) from rpc_matrix order by identity;
select is((select count(*)::integer from public.league_members),1,'Revoked user can inspect own admission status only');
select is((select count(*)::integer from public.matches),0,'Revoked cannot read populated matches');
reset role;
select * from finish();
rollback;
