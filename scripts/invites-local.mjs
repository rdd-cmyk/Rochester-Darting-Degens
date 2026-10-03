import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalBindings, assertWindowsPortDefault, cliPath, docker, dockerHost, localDockerEnv, root } from './local-environment.mjs';

export const inviteProject = 'rdd-invites';
export const inviteWorkdir = path.join(root, '.qa-artifacts', 'invite-stack');
export const inviteContainer = `supabase_db_${inviteProject}`;
const network = 'rdd-invites-loopback';
export function inviteSql(sql) {
  return execFileSync('docker', ['--host', dockerHost, 'exec', '-i', inviteContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-f', '-'], {
    input: sql, env: localDockerEnv(), cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
export function inviteStatus() {
  const ids = docker(['ps', '-aq', '--filter', `label=com.supabase.cli.project=${inviteProject}`]).split(/\s+/).filter(Boolean);
  if (!ids.length) throw new Error('Start the isolated invitation stack first.');
  const containers = JSON.parse(docker(['inspect', ...ids]));
  assertLocalBindings(containers);
  for (const service of ['db', 'auth', 'rest', 'kong']) {
    const c = containers.find(c => c.Name === `/supabase_${service}_${inviteProject}`);
    if (!c?.State.Running || (c.State.Health && c.State.Health.Status !== 'healthy')) throw new Error(`Invitation ${service} is not ready.`);
  }
  const value = JSON.parse(execFileSync(cliPath(), ['status', '--workdir', inviteWorkdir, '-o', 'json'], {
    env: localDockerEnv(), cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  }));
  if (value.API_URL !== 'http://127.0.0.1:56521' || !value.SERVICE_ROLE_KEY || !value.ANON_KEY) throw new Error('Unexpected invitation API target.');
  return value; // Contains local keys; never print.
}
async function main() {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length || !['start', 'setup', 'refresh-functions', 'preview', 'build', 'stop'].includes(command)) throw new Error('Choose start, setup, refresh-functions, preview, build, or stop.');
  if (command === 'start') {
    assertWindowsPortDefault();
    const names = docker(['network', 'ls', '--format', '{{.Name}}']).split(/\r?\n/);
    if (!names.includes(network)) docker(['network', 'create', '--driver', 'bridge', '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', network]);
    const net = JSON.parse(docker(['network', 'inspect', network]))[0];
    if (net.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') throw new Error('Invitation network must bind only loopback.');
    mkdirSync(path.join(inviteWorkdir, 'supabase'), { recursive: true });
    const config = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8')
      .replace(/project_id = "[^"]+"/, `project_id = "${inviteProject}"`)
      .replaceAll('5432', '5652').replaceAll('5433', '5653')
      .replaceAll('127.0.0.1:3000', '127.0.0.1:3102').replaceAll('localhost:3000', 'localhost:3102');
    writeFileSync(path.join(inviteWorkdir, 'supabase/config.toml'), config);
    execFileSync(cliPath(), ['start', '--workdir', inviteWorkdir, '--network-id', network, '--exclude', 'vector'], {
      env: localDockerEnv(), cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000, windowsHide: true,
    });
    inviteStatus(); console.log('Isolated invitation stack ready at 127.0.0.1:56521; public signup disabled.');
  } else if (command === 'stop') {
    inviteStatus();
    execFileSync(cliPath(), ['stop', '--workdir', inviteWorkdir], { env: localDockerEnv(), cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, windowsHide: true });
    console.log('Invitation stack stopped; volumes retained.');
  } else if (command === 'refresh-functions') {
    inviteStatus();
    const sql = readFileSync(path.join(root, 'supabase/tests/fixtures/invite_only_registration.sql'), 'utf8');
    const begin = sql.indexOf('create or replace function invite_private.same_digest(');
    const end = sql.lastIndexOf('commit;');
    if (begin < 0 || end < begin) throw new Error('Could not identify invitation service definition.');
    inviteSql(sql.slice(begin, end));
    console.log('Updated service function in isolated local invitation database.');
  } else if (command === 'setup') {
    inviteStatus();
    const state = inviteSql("select to_regclass('public.profiles') is not null, to_regclass('public.seasons') is not null, to_regclass('public.league_members') is not null;");
    if (state !== 't|t|t') {
      if (state !== 'f|f|f') throw new Error('Partial invitation schema; inspect it before replay.');
      for (const fixture of ['existing_schema_baseline.sql', 'advanced_statistics_foundation.sql', 'invite_only_registration.sql']) {
        inviteSql(readFileSync(path.join(root, 'supabase/tests/fixtures', fixture), 'utf8'));
      }
    }
    // Older invitation-only stacks gain the rebased parent's fixtures once.
    // Existing parent tables and invitation records are never replayed.
    for (const [table, fixture] of [
      ['public.league_nights', 'supabase/tests/fixtures/league_night.sql'],
      ['rdd_private.planning_polls', 'supabase/tests/fixtures/league_planning.sql'],
      ['public.board_members', 'supabase/tests/fixtures/league_board.sql'],
    ]) {
      if (inviteSql(`select to_regclass('${table}') is null;`) === 't') inviteSql(readFileSync(path.join(root, fixture), 'utf8'));
    }
    inviteSql(readFileSync(path.join(root, 'supabase/tests/fixtures/league_night_enforce.sql'), 'utf8'));
    if (inviteSql("select to_regprocedure('invite_private.require_admission()') is null;") === 't') {
      inviteSql(readFileSync(path.join(root, 'supabase/tests/fixtures/invite_parent_admission.sql'), 'utf8'));
    }
    console.log('Combined invitation/League Night/planning/Board fixtures ready in isolated local database. No accounts grandfathered automatically.');
  } else {
    const status = inviteStatus();
    const messages = [];
    const mail = createServer(async (request, reply) => {
      // Local synthetic email sink; no SMTP or external delivery is possible.
      if (request.headers.host !== '127.0.0.1:56530' || request.headers.origin) { reply.writeHead(403).end(); return; }
      if (request.method === 'GET' && request.url === '/messages') { reply.setHeader('Content-Type', 'application/json'); reply.end(JSON.stringify(messages)); return; }
      if (request.method !== 'POST' || request.url !== '/send') { reply.writeHead(404).end(); return; }
      let text = '';
      for await (const chunk of request) { text += chunk; if (text.length > 20000) { reply.writeHead(413).end(); return; } }
      try {
        const value = JSON.parse(text);
        if (!value.to?.every(email => email.endsWith('@example.test'))) { reply.writeHead(400).end(); return; }
        if (value.to.some(email => email.startsWith('reject-mail-'))) { reply.writeHead(422).end(); return; }
        if (value.to.some(email => email.startsWith('unknown-mail-'))) { reply.writeHead(503).end(); return; }
        const existing = messages.find(m => m.requestId === request.headers['idempotency-key']);
        const record = existing || { ...value, id: randomUUID(), requestId: request.headers['idempotency-key'] };
        if (!existing) messages.push(record);
        reply.setHeader('Content-Type', 'application/json'); reply.end(JSON.stringify({ id: record.id }));
      } catch { reply.writeHead(400).end(); }
    });
    if (command === 'preview') await new Promise((resolve, reject) => { mail.once('error', reject); mail.listen(56530, '127.0.0.1', resolve); });
    const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), ...(command === 'build' ? ['build'] : ['dev', '--hostname', '127.0.0.1', '--port', '3102'])], {
      cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, RDD_INVITE_SECRET: randomBytes(48).toString('base64url'),
        RDD_INVITES_ENABLED: '1', RDD_INVITE_ORIGIN: 'http://127.0.0.1:3102', RDD_LOCAL_PREVIEW: '1',
        GITHUB_TOKEN: '', GITHUB_REPO_OWNER: '', GITHUB_REPO_NAME: '', RESEND_API_KEY: '', RDD_INVITE_FROM: '',
      },
    });
    child.on('exit', code => { mail.close(); process.exitCode = code ?? 1; });
    child.on('error', () => { mail.close(); process.exitCode = 1; });
    console.log('Invitation preview uses synthetic email only; capture at loopback port 56530. Restart invalidates outstanding local links/codes.');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Invitation local command failed. Inspect local Docker readiness/configuration; no hosted fallback was attempted.'); process.exitCode = 1; });
}
