// W2 SQL-only rehearsal. Fixed synthetic local target, no --linked/URL flags.
// Uses managed Auth schema definitions from a dedicated local Supabase stack;
// HTTP/Auth/browser acceptance and production-shaped timing belong to W3/W5.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  root, docker, dockerHost, localDockerEnv, cliPath,
  assertWindowsPortDefault, assertLocalBindings,
} from './local-environment.mjs';

const project = 'rdd-w2-statistics';
const workdir = path.join(root, '.local', 'w2-statistics');
const container = `supabase_db_${project}`;
const network = 'rdd-w2-loopback';
const files = [
  'supabase/tests/fixtures/advanced_statistics_foundation.sql',
  'supabase/tests/fixtures/league_night.sql',
  'supabase/tests/fixtures/league_planning.sql',
  'supabase/tests/fixtures/league_board.sql',
  'supabase/tests/fixtures/invite_only_registration.sql',
  'supabase/tests/fixtures/invite_parent_admission.sql',
  'supabase/tests/fixtures/game_modes.sql',
  'supabase/tests/fixtures/advanced_statistics_final.sql',
  'supabase/tests/fixtures/solo_play.sql',
  'supabase/tests/fixtures/rivalry_room.sql',
  'supabase/tests/fixtures/league_night_enforce.sql',
];
const read = file => readFileSync(path.join(root, file), 'utf8');
const output = [];
const evidence = { date: new Date().toISOString(), project, api: 'http://127.0.0.1:56821',
  scope: 'local synthetic SQL only', sql: [...files,
    'supabase/tests/fixtures/advanced_statistics_profile.sql',
    'supabase/tests/fixtures/advanced_statistics_validate.sql'].map(file => ({ file,
    sha256: createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex'),
    repository_lf_sha256: createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex') })),
  sourceFiles: ['scripts/rehearse-statistics.mjs','scripts/rehearse-solo.mjs','scripts/qa/invites-integration.mjs',
    'lib/stats/engine.test.ts','supabase/tests/database/statistics_foundation.test.sql',
    'supabase/tests/statistics/final.test.sql','supabase/tests/rehearsal/legacy-preservation.test.sql']
    .map(file=>({file,repository_lf_sha256:createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex')})),
  hashContract: 'sha256 identifies executed checkout bytes; repository_lf_sha256 identifies Git-normalized source independent of checkout CRLF',
  runs: [] };
function sql(input, database) {
  return execFileSync('docker', ['--host', dockerHost, 'exec', '-i', container,
    'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At', '-f', '-'], {
    input, env: localDockerEnv(), cwd: root, encoding: 'utf8', timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
}
function suite(file, database) {
  const result = sql(read(file), database);
  if (/^not ok|Looks like you failed|planned .* ran/mi.test(result)) throw Error(result);
  const assertions = (result.match(/^ok \d+/gm) ?? []).length;
  if (!assertions || !/^1\.\.\d+/m.test(result)) throw Error('Missing TAP plan/assertions');
  output.push(`${database} ${file}\n${result}`);
  console.log(`${file}: ${assertions} assertions passed.`);
  return assertions;
}
try {
  if (process.argv.length !== 2) throw Error('No arguments or target overrides accepted.');
  assertWindowsPortDefault();
  const networks = docker(['network', 'ls', '--format', '{{.Name}}']).split(/\r?\n/);
  if (!networks.includes(network)) docker(['network', 'create', '--driver', 'bridge', '--opt',
    'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', network]);
  if (JSON.parse(docker(['network', 'inspect', network]))[0]?.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1')
    throw Error('W2 network must bind loopback.');
  mkdirSync(path.join(workdir, 'supabase'), { recursive: true });
  writeFileSync(path.join(workdir, 'supabase', 'config.toml'), read('supabase/config.toml')
    .replace(/project_id = "[^"]+"/, `project_id = "${project}"`)
    .replaceAll('5432', '5682').replaceAll('5433', '5683')
    .replaceAll(':3000', ':3082'));
  // Capture startup output (contains local keys) instead of printing it.
  execFileSync(cliPath(), ['start', '--workdir', workdir, '--network-id', network, '--exclude', 'vector'], {
    env: localDockerEnv(), cwd: root, timeout: 240000, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ids = docker(['ps', '-aq', '--filter', `label=com.supabase.cli.project=${project}`]).split(/\s+/).filter(Boolean);
  const containers = JSON.parse(docker(['inspect', ...ids]));
  assertLocalBindings(containers);
  if (!containers.some(c => c.Name === `/${container}` && c.State.Running && c.State.Health?.Status === 'healthy'))
    throw Error('W2 database is not healthy.');
  const authSchema = docker(['exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres',
    '--schema-only', '--schema=auth', '--no-owner', '--no-acl']);
  evidence.postgres = sql('select version();', 'postgres').trim();
  for (const mode of ['fresh', 'legacy', 'conflict', 'old-foundation']) {
    const database = `rdd_w2_${mode}_${Date.now()}`;
    docker(['exec', container, 'createdb', '-U', 'postgres', '--template=template0', database]);
    sql('CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon,authenticated; CREATE SCHEMA vault; CREATE PUBLICATION supabase_realtime;', database);
    sql(authSchema, database);
    sql(read('supabase/tests/fixtures/existing_schema_baseline.sql'), database);
    // Test broad managed default grants too; the feature must close its own
    // newly created tables/views/functions without altering unrelated defaults.
    sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;', database);
    if (mode !== 'fresh') sql(read('supabase/tests/rehearsal/legacy-fixture.sql'), database);
    if (mode === 'old-foundation') {
      const original = execFileSync('git', ['show', '9c582fa35cb03f644c0a8eb22e2a5cc59922b00f:supabase/tests/fixtures/advanced_statistics_foundation.sql'],
        { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore','pipe','pipe'] });
      sql(original, database);
      const snapshot = `SELECT jsonb_build_object('rows',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.matches m),
        'acls',(SELECT jsonb_agg(jsonb_build_object('name',relname,'acl',relacl) ORDER BY relname) FROM pg_class WHERE oid IN ('public.seasons'::regclass,'public.stats_match_facts'::regclass)),
        'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid IN ('public.matches'::regclass,'public.match_players'::regclass)),
        'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='public'));`;
      const before = sql(snapshot, database);
      let refused = false;
      try { sql(read(files[0]), database); } catch (error) {
        refused = String(error.stderr).includes('Old statistics foundation detected');
      }
      if (!refused || before !== sql(snapshot, database))
        throw Error('Old-foundation upgrade was not refused with rows preserved');
      evidence.runs.push({ mode, database, outcome: 'explicitly refused; old rows preserved' });
      console.log('Old experimental foundation correctly refused; provenance/timestamps retained for separate reconciliation.');
      continue;
    }
    if (mode === 'conflict') sql('ALTER TABLE public.match_players ADD COLUMN darts_thrown integer; UPDATE public.match_players SET darts_thrown=-1 WHERE id=-990001;', database);
    sql(read(files[0]), database);
    const stage = suite('supabase/tests/database/statistics_foundation.test.sql', database);
    // The finalizer must fail before either dependency, leaving grants closed.
    let rejected = false;
    try { sql(read('supabase/tests/fixtures/advanced_statistics_final.sql'), database); } catch (error) {
      rejected = String(error.stderr).includes('Statistics finalization requires');
    }
    if (!rejected) throw Error('Out-of-order finalization unexpectedly succeeded');
    if (mode === 'conflict') {
      const before = sql("SELECT darts_thrown FROM public.match_players WHERE id=-990001;", database);
      if (sql('SELECT count(*) FROM public.match_players WHERE darts_thrown <= 0;',database).trim() !== '1')
        throw Error('Historical invalid denominator was not found');
      sql(read('supabase/tests/fixtures/advanced_statistics_profile.sql'),database);
      let invalid = false;
      try { sql(read('supabase/tests/fixtures/advanced_statistics_validate.sql'), database); } catch (error) {
        invalid = String(error.stderr).includes('violated by some row');
      }
      if (!invalid || before !== sql("SELECT darts_thrown FROM public.match_players WHERE id=-990001;", database))
        throw Error('Historical violation was silently validated/changed');
      if(sql("SELECT count(*) FROM pg_constraint WHERE conname IN ('matches_detail_level_valid','matches_entry_source_valid','matches_format_best_of_positive','match_players_advanced_counts_nonnegative') AND convalidated;",database).trim() !== '0')
        throw Error('Failed validation partially committed constraint acceptance');
      console.log('Conflicting synthetic denominator detected; failed validation preserved data.');
      // Explicit fictional correction only. Real conflicts require evidence and
      // owner handling; the fixture never performs this repair automatically.
      sql('UPDATE public.match_players SET darts_thrown=NULL WHERE id=-990001;', database);
    }
    for (const file of files.slice(1)) {
      sql(read(file), database);
      if (file.endsWith('invite_parent_admission.sql')) {
        let refused = false;
        try { sql(read('supabase/tests/fixtures/advanced_statistics_final.sql'), database); } catch (error) {
          refused = String(error.stderr).includes('Statistics finalization requires');
        }
        if (!refused || sql("SELECT has_table_privilege('authenticated','public.stats_match_facts','SELECT');",database).trim() !== 'f')
          throw Error('Final view did not fail closed before game modes');
      }
    }
    const final = suite('supabase/tests/statistics/final.test.sql', database);
    const preservation = mode === 'fresh' ? 0 : suite('supabase/tests/rehearsal/legacy-preservation.test.sql', database);
    let lockTimeoutVerified = false;
    if (mode === 'legacy') {
      const before = sql("SELECT conname,convalidated FROM pg_constraint WHERE conname LIKE 'matches_%valid' ORDER BY conname;",database);
      const holder = spawn('docker', ['--host',dockerHost,'exec',container,'psql','-X','-U','postgres','-d',database,'-At',
        '-c','BEGIN','-c','LOCK TABLE public.matches IN ACCESS EXCLUSIVE MODE',
        '-c',"SELECT 'w2_lock_held'",'-c','SELECT pg_sleep(6)','-c','COMMIT'],
        { env:localDockerEnv(),cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'] });
      const exited = new Promise((resolve,reject) => { holder.once('error',reject); holder.once('exit',code => code===0 ? resolve() : reject(Error('Lock holder failed'))); });
      await new Promise((resolve,reject) => {
        const timer=setTimeout(()=>reject(Error('Lock holder did not become ready')),5000);
        holder.once('error',error=>{clearTimeout(timer);reject(error);});
        let captured='';
        holder.stdout.on('data',chunk=>{captured+=chunk; if(captured.includes('w2_lock_held')){clearTimeout(timer);resolve();}});
      });
      try { sql(read('supabase/tests/fixtures/advanced_statistics_validate.sql'),database); } catch(error) {
        lockTimeoutVerified=String(error.stderr).includes('lock timeout');
      }
      await exited;
      if(!lockTimeoutVerified || before!==sql("SELECT conname,convalidated FROM pg_constraint WHERE conname LIKE 'matches_%valid' ORDER BY conname;",database))
        throw Error('Validation lock timeout did not preserve constraint state');
      console.log('Validation lock timeout verified without partial constraint acceptance.');
    }
    const started = Date.now();
    sql(read('supabase/tests/fixtures/advanced_statistics_profile.sql'),database);
    sql(read('supabase/tests/fixtures/advanced_statistics_validate.sql'), database);
    const validationMs = Date.now() - started;
    const validated = sql("SELECT count(*) FROM pg_constraint WHERE conname IN ('matches_detail_level_valid','matches_entry_source_valid','matches_format_best_of_positive','match_players_advanced_counts_nonnegative') AND convalidated;", database).trim();
    if (validated !== '4') throw Error('Constraints not validated');
    evidence.runs.push({ mode, database, stage, final, preservation, validationMs, validated: 4, lockTimeoutVerified });
    console.log(`${mode} SQL-only rehearsal passed; retained ${database}.`);
  }
  evidence.passed = true;
  writeFileSync(path.join(workdir, 'result.json'), JSON.stringify(evidence, null, 2) + '\n');
  writeFileSync(path.join(workdir, 'tap.txt'), output.join('\n'));
} catch (error) {
  // Inputs/targets are synthetic, but Supabase startup output contains local
  // keys. Print SQL diagnostics only, never the startup command/output.
  console.error('W2 local SQL rehearsal failed. No hosted fallback attempted.');
  if (String(error.cmd ?? '').includes('psql')) {
    console.error(String(error.stdout ?? '').slice(-4000));
    console.error(String(error.stderr ?? '').slice(-2500));
  } else console.error(error.cmd ? 'Local process failed; inspect fixed-target readiness.' : error.message);
  process.exitCode = 1;
}
