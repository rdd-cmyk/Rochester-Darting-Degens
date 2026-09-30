// Explicit isolated targets only. Never accepts a production ref or arbitrary DB.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { root, dockerHost, localDockerEnv, assertLocalBindings } from '../local-environment.mjs';
const target = process.argv[2];
assert(['synthetic', 'protected', 'hosted-testing'].includes(target), 'Choose synthetic, protected or hosted-testing');
const name = process.argv[3] ?? 'w6_poll_privacy_solo_701';
assert(['w6_poll_privacy_solo_701','w6_solo_summary_default'].includes(name));
const patchPath = `supabase/tests/fixtures/${name}.sql`;
const testPath = `supabase/tests/fixtures/${name}.test.sql`;
const patch = readFileSync(path.join(root, patchPath), 'utf8');
const tests = readFileSync(path.join(root, testPath), 'utf8');
const sha256 = createHash('sha256').update(patch.replace(/\r\n/g, '\n')).digest('hex');
let run;
if (target === 'hosted-testing') {
  const { sql, cli, ref } = await import('./w6-test-client.mjs');
  assert.equal(ref, 'uepayhdrgzrxhkqbwebo');
  run = (statement) => statement === patch || statement === tests
    ? JSON.stringify(JSON.parse(cli(['db','query','--linked','--project-ref',ref,'--file',statement === patch ? patchPath : testPath,'-o','json'])).rows)
    : JSON.stringify(sql(statement));
} else {
  const container = target === 'synthetic' ? 'supabase_db_rdd-release-w3' : 'supabase_db_rdd-release-w4-protected';
  const options = { cwd: root, env: localDockerEnv(), encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 20*1024*1024, stdio: ['pipe','pipe','pipe'] };
  const inspected = JSON.parse(execFileSync('docker', ['--host',dockerHost,'inspect',container], options));
  assert.equal(inspected[0].Name, `/${container}`); assert(inspected[0].State.Running);
  assertLocalBindings(inspected);
  run = (statement) => execFileSync('docker', ['--host',dockerHost,'exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq','-f','-'], { ...options, input: statement }).trim();
}
// Hash complete rows internally; emit only acceptance status, never row values.
const fingerprint = `CREATE TEMP TABLE amendment_rows(name text, digest text); DO $$ DECLARE t record; h text; BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','rdd_private','invite_private','rivalry_private','supabase_migrations') ORDER BY 1,2 LOOP
 EXECUTE format($q$SELECT md5(coalesce(jsonb_agg(to_jsonb(row) ORDER BY to_jsonb(row)::text),'[]'::jsonb)::text) FROM %I.%I row$q$,t.schemaname,t.tablename) INTO h;
 INSERT INTO amendment_rows VALUES(t.schemaname||'.'||t.tablename,h);
 END LOOP; END $$; SELECT jsonb_agg(to_jsonb(a) ORDER BY name)::text AS fingerprint FROM amendment_rows a; DROP TABLE amendment_rows;`;
const before = run(fingerprint);
assert(before.includes('rdd_private.planning_options'), 'Nonempty row fingerprint required');
const acl = `SELECT jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'acl',p.proacl::text) ORDER BY p.oid::regprocedure::text)::text AS acl FROM pg_proc p WHERE p.oid IN ('public.rdd_solo_profile(uuid)'::regprocedure,'public.rdd_solo_write(uuid,jsonb)'::regprocedure,'invite_private.rdd_planning_read(integer,integer)'::regprocedure,'public.rdd_planning_read(integer,integer)'::regprocedure);`;
const beforeAcl = run(acl);
assert(beforeAcl.includes('rdd_solo_write'), 'Nonempty grant snapshot required');
run(patch);
assert.match(run(tests), /W6 .* acceptance passed/);
assert.equal(run(fingerprint), before, 'Existing application/history rows preserved');
assert.equal(run(acl), beforeAcl, 'Function grants preserved');
const evidence = { observedAtUtc: new Date().toISOString(), target, patchPath, sha256, tests: 'passed', existingRows: 'unchanged', functionGrants: 'unchanged', productionChanged: false };
writeFileSync(path.join(root,'.local','release-w6-testing',`amendment-${name}-${target}.json`), JSON.stringify(evidence,null,2)+'\n');
console.log(`W6 ${name} passed on ${target}: acceptance, unchanged existing rows and grants.`);
