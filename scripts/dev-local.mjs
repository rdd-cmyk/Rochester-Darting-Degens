import { spawn } from 'node:child_process';
import path from 'node:path';
import { localStatus, root } from './local-environment.mjs';

try {
  const status = localStatus();
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--build')) throw new Error('Only --build is supported.');
  if (args.length > 1) throw new Error('Choose one mode.');
  // Never serve an existing production bundle here: it may embed a hosted URL.
  const command = args[0] === '--build' ? ['build'] : ['dev', '--hostname', '127.0.0.1', '--port', '3000'];
  console.log(`Local-only app ${command[0]}: http://127.0.0.1:3000 (Supabase ${status.API_URL}). Existing .env files are unchanged.`);
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), ...command], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
      RDD_LOCAL_PREVIEW: '1',
      // Local QA must not accidentally read the real change-log integration.
      GITHUB_TOKEN: '', GITHUB_REPO_OWNER: '', GITHUB_REPO_NAME: '' },
  });
  child.on('error', () => { console.error('Could not launch local Next.js.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} catch (error) {
  console.error(error instanceof Error ? error.message.split('\n')[0] : 'Local app preflight failed.');
  process.exitCode = 1;
}
