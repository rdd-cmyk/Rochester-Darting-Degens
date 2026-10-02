// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalDeferredSqlSource } from './deferred-sql-source.mjs';
import { beforeEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { ensureLocalSchema } from './local-schema.mjs';
import { docker } from './local-environment.mjs';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('./local-environment.mjs', () => ({
  docker: vi.fn(), dockerHost: 'npipe:////./pipe/dockerDesktopLinuxEngine',
  localDockerEnv: () => ({ DOCKER_HOST: 'local-only' }),
  projectId: 'test-project', root: process.cwd(),
}));

beforeEach(() => vi.clearAllMocks());

it('does not replay fixtures when the local schema is already complete', () => {
  docker.mockReturnValue('t|t');
  ensureLocalSchema();
  expect(execFileSync).not.toHaveBeenCalled();
});

it('loads only the two local SQL fixtures into an empty local database', () => {
  docker.mockReturnValue('f|f');
  ensureLocalSchema();
  expect(execFileSync).toHaveBeenCalledTimes(2);
  for (const [file, args, options] of execFileSync.mock.calls) {
    expect(file).toBe('docker');
    expect(args).toContain('supabase_db_test-project');
    expect(args).toContain('-i');
    expect(args).toContain('ON_ERROR_STOP=1');
    expect(options.input.length).toBeGreaterThan(100);
  }
});

it('refuses to replay over a partially initialized database', () => {
  docker.mockReturnValue('t|f');
  expect(() => ensureLocalSchema()).toThrow('Local schema is partial');
  expect(execFileSync).not.toHaveBeenCalled();
});

it('rejects an unexpected schema probe result', () => {
  docker.mockReturnValue('unexpected');
  expect(() => ensureLocalSchema()).toThrow('Local schema is partial');
});

it('keeps the automatic production migration directory empty', () => {
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const migrations = existsSync(directory) ? readdirSync(directory, { withFileTypes: true }) : [];
  expect(migrations.filter(entry => entry.isFile() && entry.name.endsWith('.sql'))).toEqual([]);
});

it('keeps League Night SQL in the governed fixtures with the reviewed content', () => {
  const reviewed = {
    'league_night.sql': 'e94ba4bd37b11f76fc1486c4b4c498bee2feab84e303cbdbe2bd134e7790fc82',
    'league_night_enforce.sql': 'b162ee8ecfafce0ff83d9fc242791b14c1ed7d45331bade935e2918e6c01ed81',
  };
  for (const [name, expected] of Object.entries(reviewed)) {
    const legacy = `supabase/pending/${name}`;
    const source = canonicalDeferredSqlSource(legacy);
    expect(source).toBe(`supabase/tests/fixtures/${name}`);
    expect(existsSync(new URL(`../${legacy}`, import.meta.url))).toBe(false);
    const sql = readFileSync(new URL(`../${source}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(sql).digest('hex')).toBe(expected);
  }
});
