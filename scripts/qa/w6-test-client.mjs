// Isolated W6 target only. Keys stay in process memory; never log SDK sessions.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { root, cliPath, localDockerEnv } from '../local-environment.mjs';
export const ref = 'uepayhdrgzrxhkqbwebo';
export const dir = path.join(root, '.local', 'release-w6-testing');
assert.equal(JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')).projectRef, ref);
export function cli(args) {
  try { return execFileSync(cliPath(), args, { cwd: root, env: localDockerEnv(), encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw Error('Isolated W6 CLI operation failed; details withheld to protect credentials'); }
}
const keys = JSON.parse(cli(['projects', 'api-keys', '--project-ref', ref, '--reveal', '-o', 'json']));
function key(type, name) {
  const matches = keys.filter(item => item.type === type && item.name === name);
  assert.equal(matches.length, 1);
  return matches[0].api_key;
}
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
export const admin = createClient(`https://${ref}.supabase.co`, key('secret', 'default'), options);
export const client = () => createClient(`https://${ref}.supabase.co`, key('legacy', 'anon'), options);
export const fixture = JSON.parse(readFileSync(path.join(dir, 'fictional-hosted.json'), 'utf8'));
export const sql = statement => JSON.parse(cli(['db', 'query', '--linked', '--project-ref', ref, '-o', 'json', statement])).rows;
