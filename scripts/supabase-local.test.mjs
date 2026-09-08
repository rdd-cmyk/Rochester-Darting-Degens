// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cliPath, dockerHost, root } from './local-environment.mjs';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn(() => ({ status: 0 })), execFileSync: vi.fn() }));
vi.mock('./local-environment.mjs', async importOriginal => ({
  ...await importOriginal(),
  assertWindowsPortDefault: vi.fn(),
  docker: vi.fn(() => JSON.stringify([{ Options: { 'com.docker.network.bridge.host_binding_ipv4': '127.0.0.1' } }])),
  localStatus: vi.fn(),
}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('DOCKER_HOST', 'tcp://synthetic-remote.invalid:2376');
  vi.stubEnv('SUPABASE_WORKDIR', '/unrelated-project');
  for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_API_VERSION']) vi.stubEnv(key, 'synthetic');
});
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it.each(['start', 'stop', 'status', 'test'])('spawns %s against only the pinned local engine', async command => {
  process.argv = ['node', 'supabase-local.mjs', command];
  await import('./supabase-local.mjs');
  const expected = command === 'start'
    ? ['start', '--network-id', 'rdd-local-loopback', ...(process.platform === 'win32' ? ['--exclude', 'vector'] : [])]
    : command === 'test' ? ['test', 'db', '--local', 'supabase/tests/database', '--network-id', 'rdd-local-loopback'] : [command];
  expect(spawnSync).toHaveBeenCalledTimes(1);
  expected.push('--workdir', root);
  // Assert arguments separately so failures never dump the inherited environment.
  const [file, args, options] = spawnSync.mock.calls[0];
  expect(file).toBe(cliPath());
  expect(args).toEqual(expected);
  const { env, ...safeOptions } = options;
  expect(safeOptions).toEqual({ cwd: root, stdio: 'inherit', windowsHide: true });
  expect(env.DOCKER_HOST).toBe(dockerHost);
  expect(env.SUPABASE_WORKDIR).toBeUndefined();
  expect(process.env.SUPABASE_WORKDIR).toBe('/unrelated-project');
  for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_API_VERSION']) expect(env[key]).toBeUndefined();
  expect(process.env.DOCKER_HOST).toBe('tcp://synthetic-remote.invalid:2376');
});

it.each([['stop', '--linked'], ['start', '--network-id', 'other'], ['db', 'push']])('rejects arbitrary flags before spawning: %j', async (...args) => {
  process.argv = ['node', 'supabase-local.mjs', ...args];
  await import('./supabase-local.mjs');
  expect(spawnSync).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
});
