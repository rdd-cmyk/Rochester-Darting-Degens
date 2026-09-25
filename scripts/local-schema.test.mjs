// @vitest-environment node
import { existsSync, readdirSync } from 'node:fs';
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
