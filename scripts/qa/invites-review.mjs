import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { inviteStatus, inviteSql } from '../invites-local.mjs';

const status = inviteStatus();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = () => createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID().slice(0, 8);
const password = 'Synthetic review original passphrase!';
const origin = 'http://127.0.0.1:3102';
const unwrap = ({ data, error }) => { assert.equal(error, null, error?.message); return data; };
async function api(body, token, cookie) {
  const result = await fetch(`${origin}/api/invites`, { method: 'POST', headers: {
    origin, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}),
  }, body: JSON.stringify(body) });
  return { status: result.status, body: await result.json(), cookie: result.headers.get('set-cookie')?.split(';')[0] };
}
async function member(label) {
  const email = `review-${label}-${run}@example.test`;
  const { user } = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  inviteSql(`insert into public.league_members(user_id) values('${user.id}'); insert into public.profiles(id,display_name) values('${user.id}','Synthetic reviewer');`);
  const session = unwrap(await client().auth.signInWithPassword({ email, password })).session;
  return { id: user.id, token: session.access_token };
}
async function messages(email) {
  return (await (await fetch('http://127.0.0.1:56530/messages')).json()).filter(m=>m.to.includes(email));
}
async function invite(sender, email) {
  const result = await api({ action: 'create', email, requestId: randomUUID() }, sender.token);
  assert.equal(result.status,200);
  const mail = (await messages(email)).filter(m=>m.subject.includes('invited')).at(-1);
  assert.ok(mail);
  const token = mail.text.match(/#invite=([A-Za-z0-9_-]+)/)[1];
  const history = await api({ action: 'list' }, sender.token);
  return { id: history.body.items.find(i=>i.email===email).id, email, token };
}
async function challenge(invitation) {
  const result = await api({ action: 'challenge', token: invitation.token });
  assert.equal(result.status,200,JSON.stringify(result.body));
  const mail = (await messages(invitation.email)).filter(m=>m.subject.includes('verification')).at(-1);
  return { cookie: result.cookie, code: mail.text.match(/code is (\d{8})/)[1] };
}
const complete = (proof, selectedPassword=password) => ({ action: 'complete', code: proof.code, password: selectedPassword, firstName:'Review', lastName:'Player', displayName:'Review Player' });

const a = await member('a'), b = await member('b');
const recovering = await invite(a,`review-recovery-${run}@example.test`);
const original = await challenge(recovering);
inviteSql(`create function invite_private.review_fail_${run}() returns trigger language plpgsql as $$ begin if new.source_invite_id='${recovering.id}' then raise exception 'synthetic review fault'; end if; return new; end $$; create trigger review_fail_${run} before insert on public.league_members for each row execute function invite_private.review_fail_${run}();`);
try { assert.equal((await api(complete(original),null,original.cookie)).status,503); }
finally { inviteSql(`drop trigger review_fail_${run} on public.league_members; drop function invite_private.review_fail_${run}();`); }
inviteSql(`update invite_private.challenges set created_at=now()-interval '2 minutes' where invite_id='${recovering.id}';`);
const fresh = await challenge(recovering);
const changedPassword='Synthetic review replacement passphrase!';
const retry=await api(complete(fresh,changedPassword),null,fresh.cookie);
const replacementLogin=await client().auth.signInWithPassword({ email:recovering.email,password:changedPassword });
assert.equal(retry.body.error,'sign_in_required');
assert.ok(replacementLogin.error);
const oldSession=unwrap(await client().auth.signInWithPassword({ email:recovering.email,password })).session;
assert.equal((await api(complete(fresh,changedPassword),oldSession.access_token,fresh.cookie)).body.accepted,true);
assert.equal(inviteSql(`select count(*) from auth.users where email='${recovering.email}';`),'1');
console.log('PASS fresh challenge requires existing-account sign-in before resuming a provisioned account.');

const email=`review-attribution-${run}@example.test`;
const expired=await invite(a,email);
inviteSql(`update invite_private.invites set expires_at=now()-interval '1 second' where id='${expired.id}'; update invite_private.deliveries set created_at=now()-interval '2 minutes' where invite_id='${expired.id}';`);
const replacement=await invite(b,email), replacementProof=await challenge(replacement);
assert.equal((await api(complete(replacementProof),null,replacementProof.cookie)).body.accepted,true);
const before=(await messages(email)).length;
const resent=await api({ action:'resend',id:expired.id,requestId:randomUUID() },a.token);
assert.equal(resent.status,200);
const after=(await messages(email)).length;
assert.equal(after,before);
assert.notEqual(inviteSql(`select status from invite_private.invites where id='${expired.id}';`),'accepted');
assert.equal(inviteSql(`select source_invite_id from public.league_members where user_id=(select id from auth.users where email='${email}');`),replacement.id);
console.log('PASS resending an expired invitation cannot email or claim an existing member.');
