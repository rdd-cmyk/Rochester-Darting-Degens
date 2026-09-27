import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
process.env.RDD_LOCAL_STACK = 'game-modes';
const { localStatus } = await import('../local-environment.mjs');
const status = localStatus();
const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {auth:{persistSession:false, autoRefreshToken:false}});
const all = await client.from('matches').select('id,game_config');
const completed = await client.from('matches').select('id,game_config')
  .or('game_config.is.null,game_config->>status.eq.completed');
if (all.error || completed.error) throw new Error(`Outcome filter failed: ${all.error?.message ?? completed.error?.message}`);
assert((all.data ?? []).some(row => ['tied','abandoned'].includes(row.game_config?.status)), 'The synthetic fixture needs an unresolved result.');
assert.deepEqual(
  (completed.data ?? []).map(row => row.id).sort((a,b)=>a-b),
  (all.data ?? []).filter(row => (row.game_config?.status ?? 'completed') === 'completed').map(row => row.id).sort((a,b)=>a-b),
);
console.log('Profile completed-result filter includes legacy rows and excludes unresolved outcomes.');
