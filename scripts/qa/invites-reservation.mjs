import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { inviteStatus, inviteSql } from '../invites-local.mjs';

const status = inviteStatus(), run = randomUUID().slice(0, 8);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const password = 'Synthetic corrected registration passphrase!';
const origin = 'http://127.0.0.1:3102';
const unwrap = ({ data, error }) => { assert.equal(error, null, error?.message); return data; };
const profile = { firstName: 'Reservation', lastName: 'Player', displayName: 'Reservation Player', credentialHash: 'synthetic-rejected-credential' };
async function api(body, token, cookie) {
  const result = await fetch(`${origin}/api/invites`, { method: 'POST', headers: { origin, 'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  return { status: result.status, body: await result.json(), cookie: result.headers.get('set-cookie')?.split(';')[0] };
}
const email = `reservation-inviter-${run}@example.test`;
const { user } = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
inviteSql(`insert into public.league_members(user_id) values('${user.id}'); insert into public.profiles(id,display_name) values('${user.id}','Synthetic inviter');`);
const db = createClient(status.API_URL, status.ANON_KEY, options);
const token = unwrap(await db.auth.signInWithPassword({ email, password })).session.access_token;
async function mail(email, code) {
  const messages = await (await fetch('http://127.0.0.1:56530/messages')).json();
  const message = messages.filter(m => m.to.includes(email) && m.subject.includes(code ? 'verification' : 'invited')).at(-1);
  assert.ok(message);
  return message.text.match(code ? /code is (\d{8})/ : /#invite=([A-Za-z0-9_-]+)/)[1];
}
async function invitation(label) {
  const email = `reservation-${label}-${run}@example.test`;
  assert.equal((await api({ action: 'create', email, requestId: randomUUID() }, token)).status, 200);
  return { email, token: await mail(email, false) };
}
async function challenge(invite) {
  const result = await api({ action: 'challenge', token: invite.token });
  assert.equal(result.status, 200);
  const [challenge_id, browser] = result.cookie.split('=')[1].split('.');
  return { cookie: result.cookie, code: await mail(invite.email, true), challenge_id,
    browser_hash: createHash('sha256').update(browser).digest('hex') };
}
const rpc = async (action, data) => unwrap(await admin.rpc('invite_service', { p_action: action, p_data: data }));
async function reserve(proof) {
  // Stop at the actual database reservation, simulating an Auth rejection
  // before any account exists. No production failure hook is introduced.
  const code_hash = inviteSql(`select code_hash from invite_private.challenges where id='${proof.challenge_id}';`);
  return rpc('reserve', { challenge_id: proof.challenge_id, browser_hash: proof.browser_hash, code_hash, profile });
}
const complete = proof => api({ action: 'complete', code: proof.code, password,
  firstName: profile.firstName, lastName: profile.lastName, displayName: profile.displayName }, null, proof.cookie);

const freshInvite = await invitation('fresh'), original = await challenge(freshInvite);
await reserve(original);
assert.equal(inviteSql(`select count(*) from auth.users where email='${freshInvite.email}';`), '0');
inviteSql(`update invite_private.challenges set created_at=now()-interval '2 minutes' where id='${original.challenge_id}';`);
const fresh = await challenge(freshInvite), result = await complete(fresh);
assert.equal(result.body.accepted, true, JSON.stringify(result.body));
assert.equal(inviteSql(`select count(*) from auth.users where email='${freshInvite.email}';`), '1');
console.log('PASS a fresh challenge safely replaces a reservation when no account exists.');

const sameInvite = await invitation('same'), same = await challenge(sameInvite), reserved = await reserve(same);
const releaseData = { challenge_id: same.challenge_id, browser_hash: same.browser_hash, operation_id: reserved.operation_id, profile };
assert.equal((await rpc('release', { ...releaseData, profile: { ...profile, credentialHash: 'different' } })).released, false);
assert.equal((await rpc('release', { ...releaseData, operation_id: randomUUID() })).released, false);
assert.equal((await rpc('release', releaseData)).released, true);
assert.equal(inviteSql(`select verified or profile is not null from invite_private.challenges where id='${same.challenge_id}';`), 'f');
assert.equal((await complete(same)).body.accepted, true);
console.log('PASS guarded release preserves the inbox code and permits corrected registration details.');

const unknownInvite = await invitation('unknown'), unknown = await challenge(unknownInvite), unknownReservation = await reserve(unknown);
const { user: provisioned } = unwrap(await admin.auth.admin.createUser({ email: unknownInvite.email, password, email_confirm: true,
  app_metadata: { invite_operation: unknownReservation.operation_id } }));
assert.equal((await rpc('release', { challenge_id: unknown.challenge_id, browser_hash: unknown.browser_hash,
  operation_id: unknownReservation.operation_id, profile })).released, false);
assert.equal(inviteSql(`select verified from invite_private.challenges where id='${unknown.challenge_id}';`), 't');
assert.equal(inviteSql(`select count(*) from public.league_members where user_id='${provisioned.id}';`), '0');
console.log('PASS an observed provisional account prevents release of an uncertain reservation.');

const lateInvite = await invitation('late'), oldProof = await challenge(lateInvite), oldReservation = await reserve(oldProof);
inviteSql(`update invite_private.challenges set created_at=now()-interval '2 minutes' where id='${oldProof.challenge_id}';`);
const nextProof = await challenge(lateInvite), nextReservation = await reserve(nextProof);
assert.notEqual(nextReservation.operation_id, oldReservation.operation_id);
const { user: lateUser } = unwrap(await admin.auth.admin.createUser({ email: lateInvite.email, password, email_confirm: true,
  app_metadata: { invite_operation: oldReservation.operation_id } }));
assert.equal((await reserve(nextProof)).error, 'sign_in_required');
assert.equal((await rpc('finalize', { challenge_id: nextProof.challenge_id, browser_hash: nextProof.browser_hash, user_id: lateUser.id })).error, 'unavailable');
assert.equal(inviteSql(`select count(*) from public.league_members where user_id='${lateUser.id}';`), '0');
console.log('PASS a late account from an older operation cannot finalize under a replacement challenge.');

const lengthInvite = await invitation('length'), lengthProof = await challenge(lengthInvite);
const lengthBody = { action: 'complete', code: lengthProof.code, firstName: profile.firstName, lastName: profile.lastName, displayName: profile.displayName };
for (const unsupported of ['a'.repeat(73), 'é'.repeat(37), '😀'.repeat(19)]) {
  const rejection = await api({ ...lengthBody, password: unsupported }, null, lengthProof.cookie);
  assert.equal(rejection.status, 400);
  assert.equal(rejection.body.error, 'invalid_password');
  assert.equal(inviteSql(`select verified or profile is not null or attempts<>0 from invite_private.challenges where id='${lengthProof.challenge_id}';`), 'f');
  assert.equal(inviteSql(`select count(*) from auth.users where email='${lengthInvite.email}';`), '0');
}
const boundaryPassword = 'é'.repeat(36); // 72 UTF-8 bytes.
assert.equal((await api({ ...lengthBody, password: boundaryPassword }, null, lengthProof.cookie)).body.accepted, true);
unwrap(await createClient(status.API_URL, status.ANON_KEY, options).auth.signInWithPassword({ email: lengthInvite.email, password: boundaryPassword }));
console.log('PASS unsupported password bytes do not reserve or consume a code; a corrected 72-byte password joins and signs in.');
