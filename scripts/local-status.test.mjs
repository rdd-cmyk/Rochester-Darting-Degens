// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { afterEach, expect, it, vi } from 'vitest';
import { cliPath, dockerHost, localStatus, projectId, root } from './local-environment.mjs';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it('pins the status probe to this repository despite an inherited Supabase workdir', () => {
  vi.stubEnv('SUPABASE_WORKDIR', '/unrelated-project');
  const status = { API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'synthetic-only' };
  execFileSync.mockImplementation((file, args) => {
    if (file === cliPath()) return JSON.stringify(status);
    if (file === 'docker' && args[2] === 'ps') return 'fixture-container';
    if (file === 'docker' && args[2] === 'inspect') return JSON.stringify(
      ['db', 'kong', 'auth', 'rest'].map(service => ({
        Name: `/supabase_${service}_${projectId}`,
        State: { Running: true, Health: { Status: 'healthy' } },
        NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1' }] } },
      }))
    );
    throw new Error('Unexpected command');
  });

  expect(localStatus()).toEqual(status);
  // Never include a complete inherited environment in an assertion failure.
  const cliCalls = execFileSync.mock.calls.filter(([file]) => file === cliPath());
  expect(cliCalls).toHaveLength(1);
  const [, args, options] = cliCalls[0];
  expect(args).toEqual(['status', '--workdir', root, '-o', 'json']);
  expect(options.cwd).toBe(root);
  expect(options.env.DOCKER_HOST).toBe(dockerHost);
  for (const [, , options] of execFileSync.mock.calls) {
    expect(options.env.SUPABASE_WORKDIR).toBeUndefined();
  }
  expect(process.env.SUPABASE_WORKDIR).toBe('/unrelated-project');
});
