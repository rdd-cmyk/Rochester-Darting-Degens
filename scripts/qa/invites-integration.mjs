import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { inviteStatus, inviteSql } from '../invites-local.mjs';

const status = inviteStatus();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = () => createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID().slice(0, 8);
const password = 'Synthetic league passphrase 2026!';
const origin = 'http://127.0.0.1:3102';
const unwrap = ({ data, error }) => { assert.equal(error, null, error?.message); return data; };
let checks = 0;
function checked(label) { checks++; console.log(`PASS ${label}`); }
async function api(body, token, cookie) {
  const result = await fetch(`${origin}/api/invites`, { method: 'POST', headers: {
    origin, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}),
  }, body: JSON.stringify(body) });
  return { status: result.status, body: await result.json(), cookie: result.headers.get('set-cookie')?.split(';')[0] };
}
async function account(label, admitted = true) {
  const email = `${label}-${run}@example.test`;
  const { user } = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  if (admitted) {
    inviteSql(`insert into public.league_members(user_id) values('${user.id}'); insert into public.profiles(id,display_name) values('${user.id}','Synthetic inviter');`);
  }
  const db = client();
  const session = unwrap(await db.auth.signInWithPassword({ email, password })).session;
  return { email, id: user.id, db, token: session.access_token };
}
async function mailFor(email, code = false) {
  const messages = await (await fetch('http://127.0.0.1:56530/messages')).json();
  const message = messages.filter(m => m.to.includes(email) && (code ? m.subject.includes('verification') : m.subject.includes('invited'))).at(-1);
  assert.ok(message, 'expected captured local message');
  return code ? message.text.match(/code is (\d{8})/)[1] : message.text.match(/#invite=([A-Za-z0-9_-]+)/)[1];
}
async function invitation(sender, label) {
  const email = `${label}-${run}@example.test`, requestId = randomUUID();
  const result = await api({ action: 'create', email, requestId }, sender.token);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const token = await mailFor(email);
  const list = await api({ action: 'list' }, sender.token);
  const row = list.body.items.find(i => i.email === email);
  assert.ok(row);
  return { email, requestId, token, id: row.id };
}
async function challenge(invite) {
  const result = await api({ action: 'challenge', token: invite.token });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return { cookie: result.cookie, code: await mailFor(invite.email, true) };
}
const complete = code => ({ action: 'complete', code, password, firstName: 'Synthetic', lastName: 'Player', displayName: 'Synthetic Player' });

const sender = await account('inviter');
const other = await account('other');
const provisional = await account('provisional', false);
assert.ok((await client().auth.signUp({ email: `bypass-${run}@example.test`, password })).error);
checked('direct public Auth signup is rejected');
assert.equal((await api({ action: 'create', email: 'x@example.test', requestId: randomUUID() })).status, 403);
assert.equal((await api({ action: 'list' }, provisional.token)).status, 403);
assert.ok((await client().rpc('invite_service', { p_action: 'list', p_actor: sender.id })).error);
assert.ok((await sender.db.rpc('invite_service', { p_action: 'list', p_actor: sender.id })).error);
checked('anonymous and provisional callers cannot send; privileged RPC is inaccessible');
assert.equal(unwrap(await provisional.db.from('profiles').select('id')).length, 0);
assert.ok((await provisional.db.from('profiles').insert({ id: provisional.id, display_name: 'Forged' })).error);
assert.ok((await provisional.db.from('league_members').insert({ user_id: provisional.id })).error);
unwrap(await admin.auth.admin.updateUserById(provisional.id, { user_metadata: { role: 'organizer', status: 'active' } }));
assert.equal((await api({ action: 'list' }, provisional.token)).status, 403);
checked('unfinished account and forged metadata cannot bypass RLS');

const match = unwrap(await sender.db.from('matches').insert({ created_by: sender.id, game_type: '501' }).select('id')).at(0);
unwrap(await sender.db.from('match_players').insert({ match_id: match.id, player_id: sender.id, score: 50 }));
assert.equal(unwrap(await provisional.db.from('matches').select('id')).length, 0);
assert.equal(unwrap(await provisional.db.from('match_players').select('id')).length, 0);
assert.equal(unwrap(await provisional.db.from('stats_match_facts').select('match_id')).length, 0);
assert.equal(unwrap(await other.db.from('matches').update({ notes: 'forged' }).eq('id',match.id).select()).length, 0);
assert.ok((await other.db.from('matches').insert({ created_by: sender.id })).error);
assert.ok(unwrap(await sender.db.from('stats_match_facts').select('match_id')).some(row=>row.match_id===match.id));
checked('league admission gates matches, participants and statistics while retaining owner writes');

const invite = await invitation(sender, 'join');
assert.equal((await api({ action: 'preview', token: invite.token })).body.email_hint, 'j***@example.test');
const replay = await api({ action: 'create', email: invite.email, requestId: invite.requestId }, sender.token);
assert.equal(replay.status, 200);
assert.equal((await api({ action: 'create', email: 'changed@example.test', requestId: invite.requestId }, sender.token)).body.error, 'retry_conflict');
assert.equal((await api({ action: 'list' }, other.token)).body.items.length, 0);
checked('email invitation, sender-private tracking, and payload-aware idempotency');
const proof = await challenge(invite);
assert.equal((await api(complete(proof.code))).status, 400);
assert.equal((await api(complete(proof.code), null, proof.cookie.replace(/\.[^.]+$/, '.wrong'))).status, 400);
const wrongCode = proof.code === '00000000' ? '11111111' : '00000000';
assert.equal((await api(complete(wrongCode), null, proof.cookie)).body.error, 'invalid_code');
const joined = await api({ ...complete(proof.code), email: 'forged@example.test' }, null, proof.cookie);
assert.equal(joined.body.accepted, true, JSON.stringify(joined.body));
assert.equal((await api(complete(proof.code), null, proof.cookie)).body.accepted, true);
const recipient = client();
const recipientUser = unwrap(await recipient.auth.signInWithPassword({ email: invite.email, password })).user;
assert.equal(unwrap(await recipient.from('league_members').select('*'))[0].source_invite_id, invite.id);
assert.equal(inviteSql(`select count(*) from auth.users where lower(email)='${invite.email}';`), '1');
assert.equal((await api({ action: 'list' }, sender.token)).body.accepted, 1);
checked('link alone and forged email cannot join; code plus browser proof joins exactly once');

const revoked = await invitation(sender, 'revoked');
const revokedProof = await challenge(revoked);
assert.equal((await api({ action: 'revoke', id: revoked.id, requestId: randomUUID() }, sender.token)).status, 200);
assert.equal((await api(complete(revokedProof.code), null, revokedProof.cookie)).body.error, 'unavailable');
assert.equal((await api({ action: 'preview', token: revoked.token })).body.error, 'unavailable');
checked('revocation invalidates both link and outstanding code');

const rotate = await invitation(sender, 'rotate');
const oldProof = await challenge(rotate);
inviteSql(`update invite_private.deliveries set created_at=now()-interval '2 minutes' where invite_id='${rotate.id}';`);
assert.equal((await api({ action: 'resend', id: rotate.id, requestId: randomUUID() }, sender.token)).status, 200);
assert.equal((await api({ action: 'preview', token: rotate.token })).body.error, 'unavailable');
assert.equal((await api(complete(oldProof.code), null, oldProof.cookie)).body.error, 'unavailable');
rotate.token = await mailFor(rotate.email);
assert.equal((await api({ action: 'preview', token: rotate.token })).status, 200);
inviteSql(`update invite_private.invites set expires_at=now()-interval '1 second' where id='${rotate.id}';`);
assert.equal((await api({ action: 'preview', token: rotate.token })).body.error, 'unavailable');
checked('resend rotates secrets and expiry is enforced');

// Force a finalization failure after Auth creation. The account must remain
// unadmitted; removing the synthetic fault lets the identical attempt recover.
const recoverInvite = await invitation(other, 'recover');
const recoverProof = await challenge(recoverInvite);
inviteSql(`create function invite_private.qa_fail_${run}() returns trigger language plpgsql as $$ begin if new.source_invite_id='${recoverInvite.id}' then raise exception 'synthetic finalization fault'; end if; return new; end $$; create trigger qa_fail_${run} before insert on public.league_members for each row execute function invite_private.qa_fail_${run}();`);
try {
  assert.equal((await api(complete(recoverProof.code), null, recoverProof.cookie)).status, 503);
  const partial = client();
  unwrap(await partial.auth.signInWithPassword({ email: recoverInvite.email, password }));
  assert.equal(unwrap(await partial.from('profiles').select('id')).length, 0);
  assert.equal(unwrap(await partial.from('league_members').select('*')).length, 0);
} finally {
  inviteSql(`drop trigger qa_fail_${run} on public.league_members; drop function invite_private.qa_fail_${run}();`);
}
assert.equal((await api(complete(recoverProof.code), null, recoverProof.cookie)).body.accepted, true);
assert.equal(inviteSql(`select count(*) from auth.users where lower(email)='${recoverInvite.email}';`), '1');
checked('post-Auth failure stays denied and retries reconcile without duplicate accounts');

const existingInvite = await invitation(other, 'provisional');
const existingProof = await challenge(existingInvite);
assert.equal((await api(complete(existingProof.code), sender.token, existingProof.cookie)).body.error, 'sign_in_required');
assert.equal((await api(complete(existingProof.code), provisional.token, existingProof.cookie)).body.accepted, true);
assert.equal(inviteSql(`select count(*) from auth.users where lower(email)='${provisional.email}';`), '1');
checked('existing account requires matching sign-in and is never overwritten');

const locked = await invitation(other, 'locked');
const lockProof = await challenge(locked);
const bad = lockProof.code === '00000000' ? '11111111' : '00000000';
for (let attempt=0; attempt<5; attempt++) assert.equal((await api(complete(bad), null, lockProof.cookie)).body.error, 'invalid_code');
assert.equal((await api(complete(lockProof.code), null, lockProof.cookie)).body.error, 'code_locked');
assert.equal((await api({ action: 'challenge', token: locked.token })).body.error, 'rate_limited');
checked('code guessing limit and resend cooldown hold');

const expiredProofInvite = await invitation(other, 'code-expiry');
const expiredProof = await challenge(expiredProofInvite);
inviteSql(`update invite_private.challenges set expires_at=now()-interval '1 second' where invite_id='${expiredProofInvite.id}';`);
assert.equal((await api(complete(expiredProof.code), null, expiredProof.cookie)).body.error, 'unavailable');
checked('expired inbox challenges cannot finish onboarding');

for (const [prefix, delivery] of [['reject-mail', 'failed'], ['unknown-mail', 'unknown']]) {
  const email = `${prefix}-${run}@example.test`, requestId = randomUUID();
  const sent = await api({ action: 'create', email, requestId }, sender.token);
  assert.equal(sent.status, 200);
  const history = await api({ action: 'list' }, sender.token);
  assert.equal(history.body.items.find(row=>row.email===email).delivery, delivery);
  assert.equal((await api({ action: 'create', email, requestId }, sender.token)).status, 200);
}
assert.equal((await api({ action: 'create', email: `over-limit-${run}@example.test`, requestId: randomUUID() }, sender.token)).body.error, 'rate_limited');
checked('mail failures and uncertain delivery stay visible; retries and daily invite limits hold');

const concurrentSender = await account('concurrent');
const concurrentInvite = await invitation(concurrentSender, 'concurrent-join');
const concurrentProof = await challenge(concurrentInvite);
const results = await Promise.all([api(complete(concurrentProof.code), null, concurrentProof.cookie), api(complete(concurrentProof.code), null, concurrentProof.cookie)]);
assert.ok(results.some(result=>result.body.accepted));
assert.equal((await api(complete(concurrentProof.code), null, concurrentProof.cookie)).body.accepted, true);
assert.equal(inviteSql(`select count(*) from auth.users where lower(email)='${concurrentInvite.email}';`), '1');
checked('simultaneous accept requests converge on one account and admission');

inviteSql(`update public.league_members set status='revoked' where user_id='${recipientUser.id}';`);
assert.equal(unwrap(await recipient.from('profiles').select('id')).length, 0);
checked('revoked league membership immediately loses data access');
console.log(`${checks} invitation integration groups passed against isolated local Supabase.`);
