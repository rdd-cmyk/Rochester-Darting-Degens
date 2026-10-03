import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { admin, client, fixture, sql, dir } from './w6-test-client.mjs';
const before = sql('select count(*)::int as count from auth.users')[0].count;
const db = client();
const denied = await db.auth.signUp({ email: `w6-denied-${randomUUID()}@example.test`, password: `W6!${randomBytes(24).toString('base64url')}` });
assert.equal(denied.error?.code, 'signup_disabled');
assert.equal(sql('select count(*)::int as count from auth.users')[0].count, before);
const a = fixture.people.find(person => person.label === 'A');
const login = await db.auth.signInWithPassword({ email: a.email, password: fixture.password });
assert.equal(login.error, null);
assert.equal((await db.rpc('league_is_member')).data, true);
// The application invite flow uses this privileged Auth method after inbox
// verification; public-signup restrictions must not disable provisioning.
const email = `w6-admin-gate-${randomUUID()}@example.test`;
const created = await admin.auth.admin.createUser({ email, password: `W6!${randomBytes(24).toString('base64url')}`, email_confirm: true });
assert.equal(created.error, null);
assert(created.data.user?.id);
// Keep the fictional account as evidence; no destructive Auth cleanup here.
writeFileSync(path.join(dir, 'signup-gate.json'), JSON.stringify({ testedAtUtc: new Date().toISOString(), publicSignupDenied: true, denialCode: denied.error.code, noUserCreatedByPublicSignup: true, existingMemberLogin: true, adminProvisioning: true, fictionalProvisionedId: created.data.user.id }, null, 2));
console.log('PASS: signup_disabled; no public account created; existing member login and privileged invite provisioning work.');
