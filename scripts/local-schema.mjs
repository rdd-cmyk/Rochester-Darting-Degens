import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { docker, dockerHost, localDockerEnv, projectId, root } from './local-environment.mjs';

const fixtures = [
  'existing_schema_baseline.sql',
  'advanced_statistics_foundation.sql',
];

// This is deliberately not a migration: GitHub integration must have nothing
// to apply to the existing hosted database when the application PR is merged.
export function ensureLocalSchema() {
  const container = `supabase_db_${projectId}`;
  const state = docker(['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atqc',
    "select to_regclass('public.matches') is not null, to_regclass('public.seasons') is not null"]);
  if (state === 't|t') return;
  if (state !== 'f|f') throw new Error('Local schema is partial; inspect it before replaying fixtures.');

  for (const fixture of fixtures) {
    const sql = readFileSync(path.join(root, 'supabase', 'tests', 'fixtures', fixture));
    execFileSync('docker', ['--host', dockerHost, 'exec', '-i', container,
      'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
      input: sql, env: localDockerEnv(), cwd: root, stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000, windowsHide: true,
    });
  }
}
