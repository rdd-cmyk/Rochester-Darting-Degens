// Synthetic temporary database only. Never updates the interactive stack.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {docker,dockerHost,localDockerEnv,root,assertLocalBindings} from './local-environment.mjs';
const container='supabase_db_rdd-release-w3';
const inspected=JSON.parse(docker(['inspect',container]));
assertLocalBindings(inspected);
if(!inspected[0]?.State.Running||inspected[0]?.Config.Labels?.['com.supabase.cli.project']!=='rdd-release-w3')throw Error('Expected local W3 database');
const database=`rdd_planning_availability_${Date.now()}`;
const sql=input=>execFileSync('docker',['--host',dockerHost,'exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At','-f','-'],{input,cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:60000,windowsHide:true,stdio:['pipe','pipe','pipe']});
const read=p=>readFileSync(path.join(root,p),'utf8');
try{
  docker(['exec',container,'createdb','-U','postgres','--template=template0',database]);
  sql('CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon,authenticated,service_role; CREATE SCHEMA vault; CREATE PUBLICATION supabase_realtime;');
  sql(docker(['exec',container,'pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=auth','--no-owner','--no-acl']));
  sql('GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;');
  for(const name of ['existing_schema_baseline','advanced_statistics_foundation','league_night','league_night_enforce','league_planning','league_board','invite_only_registration','invite_parent_admission'])sql(read(`supabase/tests/fixtures/${name}.sql`));
  sql(read('supabase/tests/planning-availability/legacy.sql'));
  const upgrade=read('supabase/tests/fixtures/planning_availability.sql');
  const before=sql("SELECT md5(string_agg(to_jsonb(v)::text,',' ORDER BY poll_id,option_id,user_id)) FROM rdd_private.planning_votes v;");
  // A failed transaction must not leave the new column/functions behind.
  let failed=false;try{sql(upgrade.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;'))}catch{failed=true}
  if(!failed||sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='rdd_private' AND table_name='planning_ballots' AND column_name='date_responses';").trim()!=='0')throw Error('Interrupted upgrade was not atomic');
  sql(upgrade);sql(upgrade);
  if(sql("SELECT md5(string_agg(to_jsonb(v)::text,',' ORDER BY poll_id,option_id,user_id)) FROM rdd_private.planning_votes v;")!==before)throw Error('Existing votes changed');
  const result=sql(read('supabase/tests/planning-availability/availability.test.sql'));
  console.log(result);
  const plan=[...result.matchAll(/^1\.\.(\d+)$/gm)],passed=(result.match(/^ok \d+/gm)||[]).length;
  if(/^not ok|Bail out|Looks like you failed/m.test(result)||plan.length!==1||Number(plan[0][1])!==passed)throw Error('Failed or incomplete availability tests');
  console.log(`PASS ${passed} checks; atomic failure, reapplication and legacy vote preservation. Retained ${database}`);
}catch(error){console.error(`Inspect ${database}; no interactive database was changed.`);if(error.stdout)console.error(error.stdout.toString().slice(-5000));if(error.stderr)console.error(error.stderr.toString().slice(-3000));if(!error.stdout&&!error.stderr)console.error(error.message);process.exitCode=1}
