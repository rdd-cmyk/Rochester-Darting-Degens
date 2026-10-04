// Own temporary database only; no writes to the local interactive stack.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { docker, dockerHost, localDockerEnv, root, assertLocalBindings } from './local-environment.mjs';

const container = 'supabase_db_rdd-release-w3';
const inspected = JSON.parse(docker(['inspect',container]));
assertLocalBindings(inspected);
if (!inspected[0]?.State.Running || inspected[0]?.Config.Labels?.['com.supabase.cli.project'] !== 'rdd-release-w3') throw Error('Expected running local W3 database');
const database = `rdd_organizer_tools_${Date.now()}`;
const sql = input => execFileSync('docker',['--host',dockerHost,'exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At','-f','-'],{
  input,cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:60000,windowsHide:true,stdio:['pipe','pipe','pipe'],
});
try {
  docker(['exec',container,'createdb','-U','postgres','--template=template0',database]);
  sql('CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon,authenticated,service_role; CREATE SCHEMA vault; CREATE PUBLICATION supabase_realtime;');
  sql(docker(['exec',container,'pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=auth','--no-owner','--no-acl']));
  sql('GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;');
  for (const name of ['existing_schema_baseline','advanced_statistics_foundation','league_night','league_night_enforce','league_planning','league_board','invite_only_registration','invite_parent_admission','organizer_access_tools']) {
    sql(readFileSync(path.join(root,'supabase/tests/fixtures',`${name}.sql`),'utf8'));
  }
  // Reapplying this additive update must preserve existing definitions/data.
  sql(readFileSync(path.join(root,'supabase/tests/fixtures/organizer_access_tools.sql'),'utf8'));
  const result = sql(readFileSync(path.join(root,'supabase/tests/organizer-tools/organizer-access.test.sql'),'utf8'));
  console.log(result);
  if (/^not ok|Looks like you failed/m.test(result)) throw Error('Organizer permission tests failed');
  console.log(`PASS isolated organizer database rehearsal; retained ${database}`);
} catch (error) {
  console.error(`Inspect isolated rehearsal ${database}; interactive database was not changed.`);
  if(error.stdout)console.error(error.stdout.toString().slice(-5000));
  if(error.stderr)console.error(error.stderr.toString().slice(-3000));
  if(!error.stdout&&!error.stderr)console.error(error.message);
  process.exitCode=1;
}
