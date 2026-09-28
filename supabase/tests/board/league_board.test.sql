-- Synthetic identities, fully rolled back. Use the guarded local test command.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id) values
 ('bb000000-0000-4000-8000-000000000001'),('bb000000-0000-4000-8000-000000000002'),
 ('bb000000-0000-4000-8000-000000000003'),('bb000000-0000-4000-8000-000000000004');
insert into public.profiles(id,display_name) values
 ('bb000000-0000-4000-8000-000000000001','Board organizer'),('bb000000-0000-4000-8000-000000000002','Board player'),
 ('bb000000-0000-4000-8000-000000000003','Board outsider'),('bb000000-0000-4000-8000-000000000004','Board other member');
insert into public.board_members(user_id,status,role) values
 ('bb000000-0000-4000-8000-000000000001','approved','organizer'),
 ('bb000000-0000-4000-8000-000000000002','approved','member'),
 ('bb000000-0000-4000-8000-000000000004','approved','member');
insert into public.board_posts(id,author_id,body) values
 ('bc000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000002','Members-only conversation');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($$select * from public.board_posts$$,'42501',null,'Anonymous direct reads denied');
select throws_ok($$select public.board_feed()$$,'42501',null,'Anonymous feed denied');
select throws_ok($$select public.board_write('request_access')$$,'42501',null,'Anonymous writes denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000003","user_metadata":{"role":"organizer"}}',true);
select is((select count(*)::int from public.board_posts),0,'Signed-in outsider cannot read posts');
select throws_ok($$select public.board_feed()$$,'42501',null,'Outsider feed denied');
select throws_ok($$select public.board_thread('bc000000-0000-4000-8000-000000000001')$$,'42501',null,'Outsider replies denied');
select throws_ok($$select public.board_admin()$$,'42501',null,'User metadata cannot grant organizer rights');
select lives_ok($$select public.board_write('request_access')$$,'Account can request access');
select lives_ok($$select public.board_write('request_access')$$,'Access request is idempotent');
select is((select status from public.board_members where user_id=auth.uid()),'pending','Access starts pending');
select throws_ok($$update public.board_members set status='approved' where user_id=auth.uid()$$,'42501',null,'Cannot self-approve');
select throws_ok($$select public.board_write('create_post',p_body=>'Forbidden')$$,'42501',null,'Pending account cannot post');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000001"}',true);
select lives_ok($$select public.board_write('approve_member','bb000000-0000-4000-8000-000000000003')$$,'Organizer can approve request');
select is(jsonb_array_length(public.board_admin()->'members')>=4,true,'Organizer sees membership queue');
select lives_ok($$select public.board_write('pin','bc000000-0000-4000-8000-000000000001')$$,'Organizer can pin');
select is((public.board_feed(p_id=>'bc000000-0000-4000-8000-000000000001')->0->>'pinned')::boolean,true,'Pinned post is returned');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000002"}',true);
select throws_ok($$insert into public.board_posts(author_id,body) values(auth.uid(),'Bypass')$$,'42501',null,'Direct insert cannot bypass rate limits');
select throws_ok($$select public.board_write('approve_member','bb000000-0000-4000-8000-000000000003')$$,'42501',null,'Ordinary member cannot approve');
select throws_ok($$select public.board_write('create_post',p_body=>' ',p_id=>'bc000000-0000-4000-8000-000000000002')$$,'22023',null,'Whitespace posts rejected');
select throws_ok($$select public.board_write('create_post',p_body=>repeat('x',2001))$$,'22023',null,'Oversized posts rejected');
select throws_ok($$select public.board_write('create_post',p_body=>'Announcement',p_topic=>'announcement')$$,'42501',null,'Announcement label is organizer-only');
select lives_ok($$select public.board_write('create_post',p_body=>'Practice anyone?',p_topic=>'practice',p_id=>'bc000000-0000-4000-8000-000000000002')$$,'Member can create post');
select lives_ok($$select public.board_write('create_post',p_body=>'Practice anyone?',p_topic=>'practice',p_id=>'bc000000-0000-4000-8000-000000000002')$$,'Matching post retry succeeds');
select throws_ok($$select public.board_write('create_post',p_body=>'Revised draft',p_topic=>'practice',p_id=>'bc000000-0000-4000-8000-000000000002')$$,'PT409',null,'Changed post retry is a conflict, not a save');
select throws_ok($$select public.board_write('create_post',p_body=>'Practice anyone?',p_topic=>'sub',p_id=>'bc000000-0000-4000-8000-000000000002')$$,'PT409',null,'Changed topic retry is a conflict');
select is((select body from public.board_posts where id='bc000000-0000-4000-8000-000000000002'),'Practice anyone?','Conflicting retry preserves original post');
select lives_ok($$select public.board_write('create_reply','bc000000-0000-4000-8000-000000000001','Count me in',p_id=>'bd000000-0000-4000-8000-000000000001')$$,'Member can reply');
select lives_ok($$select public.board_write('create_reply','bc000000-0000-4000-8000-000000000001','Count me in',p_id=>'bd000000-0000-4000-8000-000000000001')$$,'Reply retries are idempotent');
select throws_ok($$select public.board_write('create_reply','bc000000-0000-4000-8000-000000000001','Revised reply',p_id=>'bd000000-0000-4000-8000-000000000001')$$,'PT409',null,'Changed reply retry is a conflict');
select is((select body from public.board_replies where id='bd000000-0000-4000-8000-000000000001'),'Count me in','Conflicting retry preserves original reply');
select is((public.board_feed(p_id=>'bc000000-0000-4000-8000-000000000001')->0->>'reply_count')::int,1,'One reply after retry');
select lives_ok($$select public.board_write('react','bc000000-0000-4000-8000-000000000001')$$,'Member can react');
select lives_ok($$select public.board_write('react','bc000000-0000-4000-8000-000000000001')$$,'Reaction retry is idempotent');
select is((public.board_feed(p_id=>'bc000000-0000-4000-8000-000000000001')->0->>'reaction_count')::int,1,'Only one reaction per member');
select lives_ok($$select public.board_write('edit_post','bc000000-0000-4000-8000-000000000002','Edited practice')$$,'Author can edit');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000004"}',true);
select throws_ok($$select public.board_write('edit_post','bc000000-0000-4000-8000-000000000002','Stolen')$$,'42501',null,'Other member cannot edit post');
select throws_ok($$select public.board_write('delete_reply','bd000000-0000-4000-8000-000000000001')$$,'42501',null,'Other member cannot delete reply');
select lives_ok($$select public.board_write('report_reply','bd000000-0000-4000-8000-000000000001','Please review')$$,'Member can report reply');
select is((select count(*)::int from public.board_reports),0,'Reports are private to organizers');
select throws_ok($$select public.board_write('hide_post','bc000000-0000-4000-8000-000000000001')$$,'42501',null,'Member cannot moderate');

select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000001"}',true);
select lives_ok($$select public.board_write('hide_reply','bd000000-0000-4000-8000-000000000001')$$,'Organizer can hide reply');
select is(jsonb_array_length(public.board_thread('bc000000-0000-4000-8000-000000000001')),0,'Hidden reply absent from thread');
select lives_ok($$select public.board_write('lock','bc000000-0000-4000-8000-000000000001')$$,'Organizer can close conversation');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.board_write('create_reply','bc000000-0000-4000-8000-000000000001','Closed reply')$$,'42501',null,'Closed conversation rejects replies');
select is((select count(*)::int from public.board_replies where id='bd000000-0000-4000-8000-000000000001'),0,'Direct read also excludes hidden replies');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000001"}',true);
select lives_ok($$select public.board_write('hide_post','bc000000-0000-4000-8000-000000000001')$$,'Organizer can hide post');
select is(jsonb_array_length(public.board_feed(p_id=>'bc000000-0000-4000-8000-000000000001')),0,'Hidden post absent from feed and direct link');
select lives_ok($$select public.board_write('revoke_member','bb000000-0000-4000-8000-000000000003')$$,'Organizer can revoke access');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000003"}',true);
select throws_ok($$select public.board_feed()$$,'42501',null,'Revocation immediately denies reads');
select lives_ok($$select public.board_write('request_access')$$,'Repeated request stays safe');
select is((select status from public.board_members where user_id=auth.uid()),'revoked','Request cannot undo revocation');

reset role;
insert into public.board_write_log(user_id,action) select 'bb000000-0000-4000-8000-000000000004','create_post' from generate_series(1,5);
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000004"}',true);
select throws_ok($$select public.board_write('create_post',p_body=>'Too fast')$$,'P0001','Please slow down and try again shortly','Server enforces post rate limit');
select lives_ok($$select public.board_write('report_post','bc000000-0000-4000-8000-000000000002','Another concern')$$,'Post limit does not prevent reporting');
select throws_ok($$delete from public.board_write_log$$,'42501',null,'Member cannot erase rate history');
reset role;
-- Equal timestamps exercise the UUID tie-breaker instead of relying on offsets.
insert into public.board_posts(id,author_id,body,created_at,last_activity)
select ('be000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'bb000000-0000-4000-8000-000000000004','Pagination fixture '||n,
  '2099-01-01'::timestamptz,'2099-01-01'::timestamptz from generate_series(1,25) n;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"bb000000-0000-4000-8000-000000000004"}',true);
select is(jsonb_array_length(public.board_feed(p_limit=>20)),20,'Feed bounds its first page');
select is(public.board_feed(p_limit=>20)->19->>'id','be000000-0000-4000-8000-000000000006','Equal-time page uses UUID descending');
select is(public.board_feed(p_before=>'2099-01-01',p_before_id=>'be000000-0000-4000-8000-000000000006')->0->>'id',
 'be000000-0000-4000-8000-000000000005','Next page starts after the full cursor');
select lives_ok($$select public.board_write('delete_post','be000000-0000-4000-8000-000000000025')$$,'Author can delete their post');
select is(jsonb_array_length(public.board_feed(p_id=>'be000000-0000-4000-8000-000000000025')),0,'Deleted post cannot be retrieved by ID');
select is((select count(*)::int from public.board_posts where id='be000000-0000-4000-8000-000000000025'),0,'Deleted post hidden from direct table reads');
reset role;
select * from finish();
rollback;
