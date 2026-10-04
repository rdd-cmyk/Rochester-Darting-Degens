begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,email,raw_user_meta_data)
select ('ca000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'organizer-test-'||n||'@example.test',
  '{"role":"organizer","organizer":true}'::jsonb from generate_series(1,8) n;
insert into public.profiles(id,display_name,first_name,include_first_name_in_display)
select ('ca000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Player '||n,'Private',false from generate_series(1,8) n
on conflict(id) do update set display_name=excluded.display_name,first_name=excluded.first_name,include_first_name_in_display=false;
insert into public.league_members(user_id,status)
select ('ca000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=6 then 'revoked' else 'active' end from generate_series(1,8) n;
update auth.users set banned_until=now()+interval '1 day' where id='ca000000-0000-4000-8000-000000000007';
insert into public.board_members(user_id,status,role) values
  ('ca000000-0000-4000-8000-000000000001','approved','organizer'),
  ('ca000000-0000-4000-8000-000000000002','approved','member'),
  ('ca000000-0000-4000-8000-000000000004','pending','member'),
  ('ca000000-0000-4000-8000-000000000005','revoked','member');
insert into invite_private.invites(inviter_id,email,token_hash,last_request,delivery,created_at,expires_at)
select case when n=1 then 'ca000000-0000-4000-8000-000000000001'::uuid else 'ca000000-0000-4000-8000-000000000002'::uuid end,
  'invite-'||n||'@example.test','private-token-'||n,gen_random_uuid(),'sent',now()-make_interval(mins=>n),
  case when n=2 then now()-interval '1 day' else now()+interval '7 days' end from generate_series(1,25) n;

set local role anon;
select throws_ok($$select public.board_access_candidates()$$,'42501',null,'Anonymous cannot read grant candidates');
select throws_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000003')$$,'42501',null,'Anonymous cannot grant access');
select throws_ok($$select public.invite_list('ca000000-0000-4000-8000-000000000001')$$,'42501',null,'Anonymous cannot impersonate an organizer for invite history');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"ca000000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.board_access_candidates()$$,'42501',null,'Ordinary member cannot read grant candidates');
select throws_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000003')$$,'42501',null,'Ordinary member cannot grant access');
select throws_ok($$select public.invite_list('ca000000-0000-4000-8000-000000000001')$$,'42501',null,'Authenticated browser cannot forge the invite actor');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"ca000000-0000-4000-8000-000000000008"}',true);
select throws_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000003')$$,'42501',null,'Editable user metadata never grants organizer authority');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"ca000000-0000-4000-8000-000000000001"}',true);
select is((public.board_access_candidates()->>'total')::int,4,'Candidates include unrequested, pending and paused members only');
select is((select item->>'status' from jsonb_array_elements(public.board_access_candidates()->'items') item where item->>'user_id'='ca000000-0000-4000-8000-000000000003'),'none','Unrequested member is visible');
select is((public.board_access_candidates(50)->>'total')::int,4,'Candidate count remains stable across pages');
select is(jsonb_array_length(public.board_access_candidates(50)->'items'),0,'Out-of-range candidate page is empty');
select throws_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000006')$$,'P0002',null,'Revoked league member cannot be admitted to Board');
select throws_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000007')$$,'P0002',null,'Banned account cannot be admitted to Board');
select throws_ok($$select public.board_grant_access(null)$$,'P0002',null,'Missing target fails closed');
select throws_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000001')$$,'P0002',null,'Grant cannot overwrite organizer role');
select lives_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000003')$$,'Organizer can grant without any prior request');
select lives_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000003')$$,'Confirmed grant retry is safe');
select is((select status from public.board_members where user_id='ca000000-0000-4000-8000-000000000003'),'approved','Unrequested member is now approved');
select is((select role from public.board_members where user_id='ca000000-0000-4000-8000-000000000003'),'member','Grant creates no organizer rights');
select is((select count(*)::int from public.board_members where user_id='ca000000-0000-4000-8000-000000000003'),1,'Retries do not duplicate membership');
select is((public.board_access_candidates()->>'total')::int,3,'Granted member leaves candidate list');
select lives_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000004')$$,'Existing pending request can be granted');
select lives_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000005')$$,'Paused Board membership can be restored');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"ca000000-0000-4000-8000-000000000003"}',true);
select lives_ok($$select public.board_feed()$$,'Granted member can immediately read the Board');
select throws_ok($$select public.board_grant_access('ca000000-0000-4000-8000-000000000008')$$,'42501',null,'Newly granted member cannot grant others access');
select throws_ok($$insert into public.board_members(user_id,status,role) values('ca000000-0000-4000-8000-000000000008','approved','organizer')$$,'42501',null,'Direct membership writes remain denied');

reset role;
set local role service_role;
select is(public.invite_list('ca000000-0000-4000-8000-000000000001')->>'scope','league','Organizer receives league-wide scope');
select is((public.invite_list('ca000000-0000-4000-8000-000000000001')->>'total')::int,25,'Organizer sees everyone including their own invitations');
select is(jsonb_array_length(public.invite_list('ca000000-0000-4000-8000-000000000001')->'items'),20,'Organizer history is paginated');
select is(jsonb_array_length(public.invite_list('ca000000-0000-4000-8000-000000000001',1)->'items'),5,'Second organizer history page includes remaining rows');
select is((public.invite_list('ca000000-0000-4000-8000-000000000001',0,'expired')->>'total')::int,1,'Expired filter applies to full organizer scope');
select is((public.invite_list('ca000000-0000-4000-8000-000000000001')->>'pending')::int,24,'Summary uses derived expiry and full scope');
select is(public.invite_list('ca000000-0000-4000-8000-000000000002')->>'scope','own','Ordinary member retains own scope');
select is((public.invite_list('ca000000-0000-4000-8000-000000000002')->>'total')::int,24,'Ordinary member cannot see organizer-owned invite');
select is((select count(*)::int from jsonb_array_elements(public.invite_list('ca000000-0000-4000-8000-000000000002')->'items') item where item->>'email'='invite-1@example.test'),0,'Other senders emails are not disclosed to ordinary members');
select is(public.invite_list('ca000000-0000-4000-8000-000000000008')->>'scope','own','Forged metadata does not widen invitation scope');
select is(public.invite_list('ca000000-0000-4000-8000-000000000006')->>'error','membership_required','Revoked league membership denies invitation history');
select is(public.invite_list('ca000000-0000-4000-8000-000000000007')->>'error','membership_required','Banned account cannot view invitation history');
select is(public.invite_list('ca000000-0000-4000-8000-000000000001',0,'invalid')->>'error','invalid_request','Invalid filters are rejected');
select is((select count(*)::int from jsonb_array_elements(public.invite_list('ca000000-0000-4000-8000-000000000001')->'items') item where (item->>'can_manage')::boolean),1,'Organizer retains management rights only on their own invitation');
select ok(public.invite_list('ca000000-0000-4000-8000-000000000001')->'items'->0->'inviter' ? 'include_first_name_in_display','Sender identity carries its disclosure preference');
select ok(public.invite_list('ca000000-0000-4000-8000-000000000001')::text not like '%token_hash%','No invitation hash is exposed');
select ok(public.invite_list('ca000000-0000-4000-8000-000000000001')::text not like '%last_request%','No request credentials are exposed');

reset role;
update public.board_members set status='revoked' where user_id='ca000000-0000-4000-8000-000000000001';
set local role service_role;
select is(public.invite_list('ca000000-0000-4000-8000-000000000001')->>'scope','own','Revoked Board organizer loses league-wide invitation visibility immediately');
reset role;
select * from finish();
rollback;
