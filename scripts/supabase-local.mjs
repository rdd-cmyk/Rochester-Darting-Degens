import { spawnSync } from 'node:child_process';
import { assertWindowsPortDefault, cliPath, docker, localCliArgs, localDockerEnv, localStatus, root } from './local-environment.mjs';

try {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Extra CLI flags are not supported by the local wrapper.');
  const args = localCliArgs(command);
  const network = 'rdd-local-loopback';
  if (command === 'start') {
    assertWindowsPortDefault();
    const networks = JSON.parse(docker(['network', 'inspect', network]));
    if (networks[0]?.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') {
      throw new Error('Create the documented rdd-local-loopback Docker network first.');
    }
  } else if (command === 'test') localStatus();
  // The pinned Windows Vector service requires unsecured Docker TCP 2375.
  // Omit only that optional log collector; never enable an unauthenticated API.
  const result = spawnSync(cliPath(), args, { cwd: root, env: localDockerEnv(), stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Local Supabase command failed.');
  if (command === 'start' || command === 'test') localStatus();
} catch (error) {
  console.error(error instanceof Error ? error.message.split('\n')[0] : 'Local Supabase preflight failed.');
  process.exitCode = 1;
}
