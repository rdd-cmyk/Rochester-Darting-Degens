import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const projectId = 'Rochester-Darting-Degens-advanced-statis';
export const dockerHost = process.platform === 'win32'
  ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';

export function localDockerEnv() {
  const env = { ...process.env, DOCKER_HOST: dockerHost };
  for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_API_VERSION', 'SUPABASE_WORKDIR']) delete env[key];
  if (process.platform === 'win32') {
    env.PATH = path.join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin') + path.delimiter + env.PATH;
  }
  return env;
}

export function docker(args) {
  return execFileSync('docker', ['--host', dockerHost, ...args], {
    env: localDockerEnv(), cwd: root, encoding: 'utf8', timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  }).trim();
}

export function assertLoopbackUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
    || url.port !== '54321' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Refusing non-local Supabase target; expected loopback HTTP port 54321.');
  }
  return url.origin;
}

export function assertLocalBindings(containers) {
  for (const container of containers) {
    if (!container.State.Running) continue;
    for (const bindings of Object.values(container.NetworkSettings.Ports ?? {})) {
      for (const binding of bindings ?? []) {
        if (!['127.0.0.1', '::1'].includes(binding.HostIp)) {
          throw new Error(`Non-loopback port on ${container.Name}; stop local Supabase and correct Docker port defaults.`);
        }
      }
    }
  }
}

export function inspectLocalStack() {
  const ids = docker(['ps', '-aq', '--filter', `label=com.supabase.cli.project=${projectId}`]).split(/\s+/).filter(Boolean);
  if (!ids.length) throw new Error('Local Supabase containers not found.');
  const containers = JSON.parse(docker(['inspect', ...ids]));
  assertLocalBindings(containers);
  return containers;
}

export function assertWindowsPortDefault() {
  if (process.platform !== 'win32') return;
  const settings = JSON.parse(readFileSync(path.join(process.env.APPDATA, 'Docker', 'settings-store.json'), 'utf8'));
  if (!['default-local-port-binding', 'local-only-port-binding'].includes(settings.PortBindingBehavior)) {
    throw new Error('Set Docker Desktop port binding to localhost in Settings before starting local Supabase. This script does not change machine settings.');
  }
}

export function cliPath() {
  // Use the lockfile-installed binary, never npx/latest or a global CLI.
  if (process.platform === 'win32') return path.join(root, 'node_modules', '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe');
  return path.join(root, 'node_modules', '.bin', 'supabase');
}

export function localCliArgs(command, platform = process.platform) {
  const network = 'rdd-local-loopback';
  // cwd alone is insufficient: the CLI also honors SUPABASE_WORKDIR.
  const workdir = ['--workdir', root];
  if (command === 'start') return ['start', '--network-id', network, ...(platform === 'win32' ? ['--exclude', 'vector'] : []), ...workdir];
  if (command === 'test') return ['test', 'db', '--local', 'supabase/tests/database', '--network-id', network, ...workdir];
  if (command === 'stop' || command === 'status') return [command, ...workdir];
  throw new Error('Use start, stop, status or test without extra flags.');
}

export function localStatus() {
  const containers = inspectLocalStack();
  const required = ['db', 'kong', 'auth', 'rest'];
  for (const service of required) {
    if (!containers.some(c => c.Name === `/supabase_${service}_${projectId}` && c.State.Running
      && (!c.State.Health || c.State.Health.Status === 'healthy'))) throw new Error(`Local ${service} service is not ready.`);
  }
  const raw = execFileSync(cliPath(), [...localCliArgs('status'), '-o', 'json'], {
    cwd: root, env: localDockerEnv(), encoding: 'utf8', timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const status = JSON.parse(raw);
  assertLoopbackUrl(status.API_URL);
  if (!status.ANON_KEY) throw new Error('Local anon key is unavailable.');
  return status; // Never print this object: it also contains local privileged keys.
}
