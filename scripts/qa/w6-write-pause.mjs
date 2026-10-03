// Three explicit phases; all state/credentials remain in the ignored test dir.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { client, fixture, sql, dir, ref } from './w6-test-client.mjs';
const phase = process.argv[2];
assert(['prepare', 'paused', 'restored'].includes(phase));
const stateFile = path.join(dir, 'write-pause-private.json');
const origin = 'https://rochester-darting-degens-git-rele-684da0-tims-projects-b7b7f743.vercel.app';
const inventory = () => sql(`select (select count(*)::int from public.matches) as matches,
 (select md5(coalesce(string_agg(row_to_json(m)::text,'' order by m.id),'')) from public.matches m) as matches_hash,
 (select md5(coalesce(string_agg(row_to_json(p)::text,'' order by row_to_json(p)::text),'')) from public.match_players p) as players_hash,
 (select count(*)::int from auth.users) as auth_users`)[0];
if (phase === 'prepare') {
  assert(!existsSync(stateFile), 'Preserve the existing rehearsal state; use a separately reviewed new run directory');
  const db = client();
  const [a,b] = fixture.people;
  const login = await db.auth.signInWithPassword({ email: a.email, password: fixture.password });
  assert.equal(login.error, null);
  assert.equal((await db.rpc('league_is_member')).data, true);
  const payload = { submitted_by:a.id, played_at:new Date().toISOString(), game_type:'501', board_type:'Soft Tip', allow_duplicate:true,
    notes:'Fictional W6 write-pause restoration check',
    game_config:{version:1,preset:'501-double-v1',format:'individual',context:'competitive',status:'completed',handicap:false,sides:{},teamScores:{},otherName:'',finish:'ordinary'},
    players:[{player_id:a.id,is_winner:true,score:null},{player_id:b.id,is_winner:false,score:null}] };
  writeFileSync(stateFile, JSON.stringify({ jwt:login.data.session.access_token, key:db.supabaseKey, operation:randomUUID(), payload, before:inventory() },null,2));
  console.log('Prepared an existing signed-in session and original-record fingerprints before the write pause.');
} else {
  const state = JSON.parse(readFileSync(stateFile,'utf8'));
  if (phase === 'restored') assert(state.pausePassed, 'Pause evidence required before restoring a save');
  // Reuse the pre-pause JWT directly, like an already-open browser tab.
  const db = createClient(`https://${ref}.supabase.co`,state.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${state.jwt}`}}});
  const result = await db.rpc('rdd_save_match',{p_operation_id:state.operation,p_payload:state.payload});
  if (phase === 'paused') {
    assert(result.error, 'Existing-session RPC must be blocked');
    assert((await db.from('matches').insert({game_type:'501',board_type:'Soft Tip',created_by:state.payload.submitted_by})).error);
    const invite = await fetch(`${origin}/api/invites`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${state.jwt}`},body:JSON.stringify({action:'create',email:'blocked-fictional@example.test',id:randomUUID()})});
    // Vercel protection can reject terminal traffic before the app. A 401 is
    // only edge-protection evidence; separately verify the authenticated UI.
    assert([401,503].includes(invite.status),'Preview API traffic must be blocked');
    state.previewTerminalStatus = invite.status;
    assert.deepEqual(inventory(),state.before,'No data/Auth change during pause; operator SQL remains available');
    const blocked = await client().auth.signUp({email:`blocked-${randomUUID()}@example.test`,password:'Fictional-Pause-2026!'});
    assert.equal(blocked.error?.code,'signup_disabled');
    state.pausePassed = true;
    writeFileSync(stateFile,JSON.stringify(state,null,2));
    console.log(`PASS paused: existing JWT RPC/direct writes and signup blocked; preview terminal status ${invite.status} (authenticated UI check required); operator SQL works; original records unchanged.`);
  } else {
    assert(state.pausePassed);
    assert.equal(result.error,null);
    assert.equal((await db.rpc('rdd_save_match',{p_operation_id:state.operation,p_payload:state.payload})).data.replayed,true);
    const matchId = result.data.match_id;
    assert(Number.isSafeInteger(matchId) && matchId > 0);
    const preserved = sql(`select
      (select md5(coalesce(string_agg(row_to_json(m)::text,'' order by m.id),'')) from public.matches m where id<>'${matchId}') as matches_hash,
      (select md5(coalesce(string_agg(row_to_json(p)::text,'' order by row_to_json(p)::text),'')) from public.match_players p where match_id<>'${matchId}') as players_hash`)[0];
    assert.equal(preserved.matches_hash,state.before.matches_hash);
    assert.equal(preserved.players_hash,state.before.players_hash);
    assert.equal(inventory().matches,state.before.matches+1);
    const login = await client().auth.signInWithPassword({email:fixture.people[0].email,password:fixture.password});
    assert.equal(login.error,null);
    writeFileSync(path.join(dir,'write-pause-result.json'),JSON.stringify({testedAtUtc:new Date().toISOString(),existingSessionWritesBlocked:true,directWritesBlocked:true,publicSignupBlocked:true,previewTerminalStatus:state.previewTerminalStatus,previewInvitesRequireSeparateUIEvidence:true,operatorSQLAvailable:true,originalMatchesAndParticipantsPreserved:true,restoredLogin:true,restoredAtomicSaveAndReplay:true,newFictionalMatchId:matchId},null,2));
    console.log('PASS restored: login and atomic save/replay work; original match/participant rows preserved.');
  }
}
