import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { docker, dockerHost, localDockerEnv, localStatus, projectId, root } from './local-environment.mjs';

// Only the inspected loopback stack is accepted. No hosted connection option.
const mode = process.argv[2];
if (!['setup', 'test'].includes(mode) || process.argv.length !== 3) throw new Error('Use board-local.mjs setup or test.');
const status = localStatus();
const container = `supabase_db_${projectId}`;
const count = docker(['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atqc',
  "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('board_members','board_posts','board_replies','board_reactions','board_reports','board_write_log')"]);
if (count === '0') {
  execFileSync('docker', ['--host', dockerHost, 'exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: readFileSync(path.join(root, 'supabase/tests/fixtures/league_board.sql')), cwd: root, env: localDockerEnv(),
    stdio: ['pipe','pipe','pipe'], timeout: 60000, windowsHide: true,
  });
  console.log('League Board fixture applied to local Supabase. No members were added.');
} else if (count !== '6') throw new Error('Partial board schema: inspect it before continuing. No tables were changed.');
else console.log('Local League Board tables already exist; fixture was not replayed.');
if (mode === 'test') {
  const testDirectory = path.join(root, 'supabase/tests/board');
  const tests = readdirSync(testDirectory).filter(name => name.endsWith('.sql')).sort();
  if (!tests.length) throw new Error('No board database tests found.');
  // The CLI test helper uses a shared "db" alias. Another Supabase project on
  // that network can resolve the alias to its own database. Share this inspected
  // container's network namespace and use loopback instead, without changing
  // either stack's networks or data. Image matches the installed CLI's runner.
  const result = spawnSync('docker', ['--host', dockerHost, 'run', '--rm', '--network', `container:${container}`,
    '--env', 'PGPASSWORD', '--mount', `type=bind,source=${testDirectory},target=/tests,readonly`,
    'public.ecr.aws/supabase/pg_prove:3.36', 'pg_prove', '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres', '-d', 'postgres',
    ...tests.map(name => `/tests/${name}`)], {
    cwd: root, env: { ...localDockerEnv(), PGPASSWORD: decodeURIComponent(new URL(status.DB_URL).password) }, stdio: 'inherit', windowsHide: true,
  });
  if(result.error || result.status !== 0) process.exitCode = 1;
}
localStatus();
