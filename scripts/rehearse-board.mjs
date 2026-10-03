import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

delete process.env.RDD_LOCAL_STACK;
const { docker, dockerHost, localDockerEnv, localStatus, projectId, root } = await import('./local-environment.mjs');
const status = localStatus();
const container = `supabase_db_${projectId}`;
const database = `rdd_board_rehearsal_${Date.now()}`;
function sql(input) {
  return execFileSync('docker', ['--host', dockerHost, 'exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database,
    '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input, cwd: root, env: localDockerEnv(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000, windowsHide: true,
  });
}

try {
  // A new database rehearses the combined additive schema without changing the
  // interactive board, League Night, or planning databases. Copy Auth DDL only.
  docker(['exec', container, 'createdb', '-U', 'postgres', '--template=template0', database]);
  sql('CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon,authenticated; CREATE SCHEMA vault; CREATE PUBLICATION supabase_realtime;');
  sql(docker(['exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only', '--schema=auth', '--no-owner', '--no-acl']));
  sql('GRANT USAGE ON SCHEMA auth TO anon,authenticated;');
  for (const file of [
    'supabase/tests/fixtures/existing_schema_baseline.sql',
    'supabase/tests/fixtures/league_night.sql',
    'supabase/tests/fixtures/league_night_enforce.sql',
    'supabase/tests/fixtures/league_planning.sql',
    'supabase/tests/fixtures/league_board.sql',
  ]) sql(readFileSync(path.join(root, file)));
  for (const suite of ['board', 'league-night', 'planning']) {
    const directory = path.join(root, 'supabase/tests', suite);
    const tests = readdirSync(directory).filter(name => name.endsWith('.sql')).sort();
    if (!tests.length) throw new Error(`No ${suite} database tests found.`);
    const result = execFileSync('docker', ['--host', dockerHost, 'run', '--rm', '--network', `container:${container}`, '--env', 'PGPASSWORD',
      '--mount', `type=bind,source=${directory},target=/tests,readonly`,
      '--mount', `type=bind,source=${path.join(root, 'supabase/tests/fixtures')},target=/fixtures,readonly`,
      'public.ecr.aws/supabase/pg_prove:3.36', 'pg_prove', '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres', '-d', database,
      ...tests.map(name => `/tests/${name}`)], {
      cwd: root, env: { ...localDockerEnv(), PGPASSWORD: decodeURIComponent(new URL(status.DB_URL).password) },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, windowsHide: true,
    });
    console.log(result.trim());
  }
  console.log(`Combined Board, League Night and planning rehearsal passed. Retained local database: ${database}`);
} catch (error) {
  console.error(`Local board rehearsal failed; inspect ${database} before rerunning.`);
  if (error.stdout) console.error(error.stdout.toString().slice(-8000));
  if (error.stderr) console.error(error.stderr.toString().slice(-4000));
  if (!error.stdout && !error.stderr) console.error(error.message);
  process.exitCode = 1;
}
