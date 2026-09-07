import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { docker, dockerHost, localDockerEnv, localStatus, projectId, root } from './local-environment.mjs';

// A fresh, separately named database is retained for inspection. Never reset,
// dump data from, or apply migrations to the app database or a linked project.
try {
  localStatus();
  const container = `supabase_db_${projectId}`;
  const database = `rdd_rehearsal_${Date.now()}`;
  const exec = args => docker(['exec', container, ...args]);
  exec(['createdb', '-U', 'postgres', '--template=template0', database]);
  const sql = statement => exec(['psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', statement]);
  sql('CREATE SCHEMA extensions; CREATE SCHEMA vault; CREATE PUBLICATION supabase_realtime;');
  // Reuse the real local managed Auth definitions, but no accounts/data.
  const authSchema = exec(['pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only', '--schema=auth', '--no-owner', '--no-acl']);
  execFileSync('docker', ['--host', dockerHost, 'exec', '-i', container,
    'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], {
    input: authSchema, env: localDockerEnv(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, windowsHide: true,
  });
  for (const file of ['migrations/20260829210000_existing_schema_baseline.sql',
    'tests/rehearsal/legacy-fixture.sql', 'migrations/20260829214500_advanced_statistics_foundation.sql']) {
    const target = `/tmp/${database}-${path.basename(file)}`;
    docker(['cp', path.join(root, 'supabase', file), `${container}:${target}`]);
    exec(['psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-f', target]);
  }
  console.log(`Synthetic staged rehearsal: ${database} (retained locally for inspection).`);
  const result = execFileSync('docker', ['--host', dockerHost, 'run', '--rm',
    '--network', `container:${container}`, '-e', 'PGPASSWORD=postgres',
    '--mount', `type=bind,source=${path.join(root, 'supabase', 'tests', 'rehearsal')},target=/tests,readonly`,
    'public.ecr.aws/supabase/pg_prove:3.36', 'pg_prove', '-h', '127.0.0.1', '-U', 'postgres', '-d', database,
    '/tests/legacy-preservation.test.sql'], {
    env: localDockerEnv(), encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  console.log(result.trim());
} catch (error) {
  console.error(error instanceof Error ? error.message.split('\n')[0] : 'Local rehearsal failed.');
  // This runner uses only a fixed local target and synthetic fixtures.
  if (error.stderr) console.error(error.stderr.toString().slice(-2000));
  if (error.stdout) console.error(error.stdout.toString().slice(-2000));
  process.exitCode = 1;
}
