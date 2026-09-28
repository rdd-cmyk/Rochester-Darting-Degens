import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { inviteStatus, inviteSql } from '../invites-local.mjs';

const status = inviteStatus();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID().slice(0, 8);
const password = 'Synthetic parent integration passphrase!';
const unwrap = ({ data, error }) => { assert.equal(error, null, error?.message); return data; };
async function account(label, admitted) {
  const email = `parent-${label}-${run}@example.test`;
  const { user } = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  // A historical profile or organizer grant must not bypass league admission.
  inviteSql(`insert into public.profiles(id,display_name) values('${user.id}','Synthetic parent integration');`);
  if (admitted) inviteSql(`insert into public.league_members(user_id) values('${user.id}');`);
  const db = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  unwrap(await db.auth.signInWithPassword({ email, password }));
  return { id: user.id, db };
}
const organizer = await account('organizer', true), member = await account('member', true), provisional = await account('provisional', false);
inviteSql(`insert into rdd_private.planning_organizers(user_id) values('${organizer.id}'),('${provisional.id}');
  insert into public.board_members(user_id,status,role) values('${organizer.id}','approved','organizer'),('${provisional.id}','approved','organizer');`);

const night = randomUUID(), operation = randomUUID();
const createNight = { p_id: night, p_title: 'Synthetic integration night', p_venue: 'Synthetic hall', p_date: '2026-09-28' };
assert.equal(unwrap(await organizer.db.rpc('rdd_create_night', createNight)).id, night);
assert.equal(unwrap(await organizer.db.rpc('rdd_set_attendance', { p_night_id: night, p_player_id: member.id, p_present: true, p_revision: 0 })).present, true);
const payload = { night_id: night, game_type: '501', played_at: new Date().toISOString(), players: [
  { player_id: organizer.id, score: 50, is_winner: true }, { player_id: member.id, score: 40, is_winner: false },
] };
const match = unwrap(await organizer.db.rpc('rdd_save_match', { p_operation_id: operation, p_payload: payload }));
assert.equal(match.status, 'saved');
assert.equal(unwrap(await organizer.db.rpc('rdd_save_match', { p_operation_id: operation, p_payload: payload })).replayed, true);
assert.equal((await member.db.rpc('rdd_save_match', { p_operation_id: randomUUID(), p_payload: { ...payload, match_id: match.match_id, expected_revision: match.revision } })).error?.code, '42501');
console.log('PASS admitted users retain League Night saving, attendance, ownership and idempotent retry behavior.');

const poll = randomUUID();
unwrap(await organizer.db.rpc('rdd_planning_write', { p_operation_id: randomUUID(), p_action: 'save_poll', p_payload: {
  actor_id: organizer.id, poll_id: poll, revision: 0, title: 'Synthetic integration poll', scope: 'both',
  closes_local: '2090-10-01T20:00', publish: true,
  options: [{ kind: 'date', starts_local: '2090-10-09T19:00' }, { kind: 'venue', venue: 'Synthetic hall' }],
} }));
assert.equal(unwrap(await member.db.rpc('rdd_planning_read')).organizer, false);
assert.equal(unwrap(await organizer.db.rpc('rdd_planning_read')).organizer, true);
unwrap(await member.db.rpc('rdd_planning_night_status', { p_night_ids: [night] }));
assert.equal((await member.db.rpc('rdd_planning_write', { p_operation_id: randomUUID(), p_action: 'save_poll', p_payload: { actor_id: member.id } })).error?.code, '42501');
console.log('PASS planning works for admitted users and keeps organizer rights separate.');

assert.equal((await member.db.rpc('board_feed')).error?.code, '42501');
unwrap(await member.db.rpc('board_write', { p_action: 'request_access' }));
assert.equal(unwrap(await member.db.from('board_members').select('status'))[0].status, 'pending');
const post = randomUUID();
unwrap(await organizer.db.rpc('board_write', { p_action: 'approve_member', p_target: member.id }));
unwrap(await member.db.rpc('board_write', { p_action: 'create_post', p_body: 'Synthetic integration conversation', p_id: post }));
assert.ok(unwrap(await member.db.rpc('board_feed', { p_id: post })).some(row => row.id === post));
unwrap(await member.db.rpc('board_thread', { p_post: post }));
assert.equal((await member.db.rpc('board_admin')).error?.code, '42501');
console.log('PASS invitation admission requires a separate Board request/approval and grants no organizer access.');

async function denied(account) {
  for (const [rpc, args] of [
    ['rdd_create_night', { ...createNight, p_id: randomUUID() }],
    ['rdd_set_attendance', { p_night_id: night, p_player_id: member.id, p_present: false, p_revision: 1 }],
    ['rdd_save_match', { p_operation_id: randomUUID(), p_payload: payload }],
    ['rdd_planning_read', {}], ['rdd_planning_night_status', { p_night_ids: [night] }],
    ['rdd_planning_write', { p_operation_id: randomUUID(), p_action: 'save_poll', p_payload: {} }],
    ['board_feed', {}], ['board_thread', { p_post: post }], ['board_admin', {}],
    ['board_write', { p_action: 'request_access' }],
  ]) assert.equal((await account.db.rpc(rpc, args)).error?.code, '42501', `${rpc} should require admission`);
  for (const table of ['profiles', 'matches', 'match_players', 'league_nights', 'league_night_attendees', 'board_posts', 'board_replies', 'board_members']) {
    assert.equal(unwrap(await account.db.from(table).select('*')).length, 0, `${table} should require admission`);
  }
}
await denied(provisional);
inviteSql(`update public.league_members set status='revoked' where user_id='${organizer.id}';`);
await denied(organizer);
assert.equal(inviteSql("select has_schema_privilege('authenticated','invite_private','usage') or has_function_privilege('authenticated','invite_private.rdd_save_match(uuid,jsonb)','execute');"), 'f');
console.log('PASS provisional and revoked users cannot reach parent data/RPCs, even with historical profiles and organizer grants.');
