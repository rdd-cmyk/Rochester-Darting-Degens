// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertLoopbackUrl, assertLocalBindings, localDockerEnv, localCliArgs, dockerHost } from './local-environment.mjs';

afterEach(() => vi.unstubAllEnvs());

describe('local-only application guardrails', () => {
  it('removes every remote/TLS override without changing the parent environment', () => {
    vi.stubEnv('DOCKER_HOST', 'tcp://remote.invalid:2376');
    for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_API_VERSION']) vi.stubEnv(key, 'synthetic');
    const env = localDockerEnv();
    expect(env.DOCKER_HOST).toBe(dockerHost);
    for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_API_VERSION']) {
      expect(env[key]).toBeUndefined();
      expect(process.env[key]).toBe('synthetic');
    }
    expect(process.env.DOCKER_HOST).toBe('tcp://remote.invalid:2376');
  });
  it.each(['start', 'stop', 'status', 'test'])('constructs only local %s commands', command => {
    expect(localCliArgs(command, 'win32')).not.toContain('--linked');
    expect(localDockerEnv().DOCKER_HOST).toBe(dockerHost);
    expect(localCliArgs(command, 'win32')[0]).toBe(command);
  });
  it('excludes Vector only on Windows and rejects arbitrary commands', () => {
    expect(localCliArgs('start', 'win32')).toEqual(['start', '--network-id', 'rdd-local-loopback', '--exclude', 'vector']);
    expect(localCliArgs('start', 'linux')).toEqual(['start', '--network-id', 'rdd-local-loopback']);
    expect(localCliArgs('test')).toContain('--local');
    expect(() => localCliArgs('db push')).toThrow();
  });
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321'])('accepts %s', value => {
    expect(assertLoopbackUrl(value)).toBe(new URL(value).origin);
  });
  it.each(['https://project.supabase.co', 'http://localhost.evil.test:54321', 'http://127.0.0.1:54322',
    'http://user:password@127.0.0.1:54321', 'http://127.0.0.1:54321/path', 'http://127.0.0.1:54321?target=remote'])('rejects %s', value => {
    expect(() => assertLoopbackUrl(value)).toThrow();
  });
  it('rejects wildcard IPv4/IPv6 and unknown bindings', () => {
    for (const HostIp of ['0.0.0.0', '::', '', '192.168.1.5']) {
      expect(() => assertLocalBindings([{ Name: '/local', State: { Running: true }, NetworkSettings: { Ports: { '5432/tcp': [{ HostIp }] } } }])).toThrow();
    }
  });
  it('accepts loopback and internal-only ports', () => {
    expect(() => assertLocalBindings([{ State: { Running: true }, NetworkSettings: { Ports: {
      '5432/tcp': [{ HostIp: '127.0.0.1' }, { HostIp: '::1' }], '8080/tcp': null,
    } } }])).not.toThrow();
  });
});
