// Explicit W6 test-only scheduling; never a production migration.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { sql, dir, client, fixture } from './w6-test-client.mjs';
const job = 'rdd-test-invite-cleanup';
const before = sql('select count(*)::int as count from invite_private.invites')[0].count;
sql('create extension if not exists pg_cron with schema pg_catalog; revoke all on schema cron from public, anon, authenticated;');
// Exercise the real scheduler briefly, then restore a daily UTC schedule.
sql(`select cron.schedule('${job}', '10 seconds', 'select public.invite_cleanup()');`);
let runs;
try {
  for (let attempt = 0; attempt < 10; attempt++) {
    runs = sql(`select status, end_time from cron.job_run_details where jobid=(select jobid from cron.job where jobname='${job}') and start_time > now()-interval '2 minutes' order by runid desc limit 1`);
    if (runs[0]?.status === 'succeeded') break;
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  assert.equal(runs[0]?.status, 'succeeded', 'Real scheduler run must succeed');
} finally {
  sql(`select cron.schedule('${job}', '15 7 * * *', 'select public.invite_cleanup()');`);
}
assert.equal(sql('select count(*)::int as count from invite_private.invites')[0].count, before);
const db = client();
const a = fixture.people.find(person => person.label === 'A');
assert.equal((await db.auth.signInWithPassword({ email: a.email, password: fixture.password })).error, null);
assert((await db.rpc('invite_cleanup')).error, 'Ordinary members cannot invoke cleanup');
const settings = sql(`select jobname,schedule,command,active,username from cron.job where jobname='${job}'`)[0];
assert.equal(settings.schedule, '15 7 * * *');
assert.equal(settings.active, true);
writeFileSync(path.join(dir, 'cleanup-schedule.json'), JSON.stringify({ testedAtUtc: new Date().toISOString(), settings, schedulerRun: runs[0], invitationHistoryPreserved: true, memberExecutionDenied: true, failureAlert: 'pending monitor configuration' }, null, 2));
console.log('PASS: real cleanup scheduler run; daily 07:15 UTC schedule active; history preserved; member execution denied. Failure-alert setup remains open.');
