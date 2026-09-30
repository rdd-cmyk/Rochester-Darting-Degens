// W6 isolated owner walkthrough setup; never a production migration.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { admin, client, fixture, sql, dir } from './w6-test-client.mjs';
const ownerEmail = process.argv[2];
assert(ownerEmail && /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+$/.test(ownerEmail));
const owners = sql(`select u.id from auth.users u join public.league_members m on m.user_id=u.id and m.status='active' where u.email='${ownerEmail}'`);
assert.equal(owners.length,1,'Require exactly the approved owner test account');
const owner = owners[0].id;
assert.match(owner,/^[0-9a-f-]{36}$/i);
sql(`begin; insert into rdd_private.planning_organizers(user_id) values('${owner}') on conflict do nothing;
 insert into public.board_members(user_id,status,role) values('${owner}','approved','organizer')
 on conflict(user_id) do update set status='approved',role='organizer'; commit;`);
const people = [...fixture.people];
for (const label of ['C','D','E']) {
  const display = `W6 fictional ${label}`;
  const existing = (await admin.from('profiles').select('id').eq('display_name',display));
  assert.equal(existing.error,null); assert(existing.data.length<=1);
  if (existing.data.length) { people.push({label,id:existing.data[0].id}); continue; }
  const email = `w6-${label.toLowerCase()}-${randomUUID()}@example.test`;
  const result = await admin.auth.admin.createUser({email,password:fixture.password,email_confirm:true});
  assert.equal(result.error,null);
  const id = result.data.user.id;
  assert.equal((await admin.from('league_members').insert({user_id:id})).error,null);
  assert.equal((await admin.from('profiles').upsert({id,display_name:display,first_name:'Fictional',last_name:label,include_first_name_in_display:false})).error,null);
  people.push({label,id,email});
}
assert(sql(`select user_id from rdd_private.planning_organizers where user_id='${owner}'`).length===1);
assert.equal(sql(`select role from public.board_members where user_id='${owner}'`)[0].role,'organizer');
const db=client();
assert.equal((await db.auth.signInWithPassword({email:fixture.people[1].email,password:fixture.password})).error,null);
assert.equal((await db.rpc('rdd_solo_profile',{p_owner:fixture.people[0].id})).data,null);
// Read-only privacy proof is separately covered by the canonical hosted suite.
writeFileSync(path.join(dir,'phone-setup-private.json'),JSON.stringify({owner,people,password:fixture.password},null,2));
writeFileSync(path.join(dir,'phone-setup-result.json'),JSON.stringify({testedAtUtc:new Date().toISOString(),ownerPlanningOrganizer:true,ownerBoardOrganizer:true,playerCountIncludingOwner:people.length+1,otherPlayerSummaryPrivate:true},null,2));
console.log('PASS: owner test organizer/Board access prepared; six admitted players available; another player cannot read the private Solo summary.');

writeFileSync(path.join(dir,'phone-test-logins.txt'), fixture.people.map(person=>`Fictional ${person.label}: ${person.email}\nPassword: ${fixture.password}\n`).join('\n')+'\nUse only on the isolated release preview. A is an organizer; B is an ordinary member. These are generated fictional test credentials, never production accounts.\n');
