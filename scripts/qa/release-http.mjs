// Actual Auth/PostgREST/Next HTTP acceptance; no hosted URL is accepted.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { localStatus, localWorkdir, sql, origin } from '../release-environment.mjs';
const status=localStatus(), checks=[];
const unwrap=result=>{if(result.error)throw Error(result.error.code+': '+result.error.message);return result.data;};
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=()=>createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const password='W3-Synthetic-Http-2026!';
async function account(admit) {
 const email='w3-http-'+randomUUID()+'@example.test';
 const user=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 if(admit)unwrap(await admin.from('league_members').insert({user_id:user.id}));
 const db=client(),session=unwrap(await db.auth.signInWithPassword({email,password})).session;
 if(admit)unwrap(await db.from('profiles').upsert({id:user.id,display_name:'Synthetic HTTP player',include_first_name_in_display:false}));
 return {db,user,email,session};
}
const active=await account(true),provisional=await account(false),anon=client();
const tables=JSON.parse(sql("select json_agg(tablename) from pg_tables where schemaname='public';").trim());
for(const [name,db] of [['anonymous',anon],['provisional',provisional.db]]) {
 for(const table of tables) {
  const result=await db.from(table).select('*').limit(1);
  assert(result.error||result.data.length===0, name+' cannot read '+table);
 }
 checks.push(name+' denied across '+tables.length+' public tables');
}
for(const schema of ['rdd_private','invite_private','rivalry_private']) {
 const response=await fetch(status.API_URL+'/rest/v1/',{headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+active.session.access_token,'Accept-Profile':schema}});
 assert.equal(response.status,406); checks.push(schema+' unavailable through HTTP');
}
const change=token=>fetch(origin+'/api/change-log',{headers:token?{Authorization:'Bearer '+token}:{}});
assert.equal((await change()).status,401);
assert.equal((await change(provisional.session.access_token)).status,403);
assert.equal((await change(active.session.access_token)).status,500); // no external GitHub provider configured
unwrap(await active.db.auth.refreshSession());
assert.equal(unwrap(await active.db.rpc('league_is_member')),true);
checks.push('real session refresh and caller-scoped Next admission gate');
const mode=JSON.parse(readFileSync(path.join(localWorkdir,'game-modes/demo.json'),'utf8'));
const payload={submitted_by:active.user.id,played_at:new Date(Date.now()-60000).toISOString(),game_type:'701',board_type:'Soft Tip',allow_duplicate:true,game_config:{version:1,preset:'701-double-v1',format:'individual',context:'competitive',status:'completed',handicap:false,sides:{},teamScores:{},otherName:'',finish:'ordinary'},players:[{player_id:active.user.id,is_winner:true,score:60},{player_id:mode.people[0].id,is_winner:false,score:50}]};
sql('UPDATE rdd_private.game_modes_control SET enabled=false;');
try {
 assert.equal((await active.db.rpc('rdd_save_match',{p_operation_id:randomUUID(),p_payload:payload})).error?.code,'22023');
 checks.push('disabled new-game writes refuse a valid versioned payload');
} finally {sql('UPDATE rdd_private.game_modes_control SET enabled=true;');}
const operation=randomUUID();
const saved=unwrap(await active.db.rpc('rdd_save_match',{p_operation_id:operation,p_payload:payload}));
const retry=unwrap(await active.db.rpc('rdd_save_match',{p_operation_id:operation,p_payload:payload}));
assert.equal(saved.match_id,retry.match_id); assert.equal(retry.replayed,true);
const countState=()=>sql("select (select count(*) from public.matches)||'/'||(select count(*) from public.match_players)||'/'||(select count(*) from rivalry_private.operations)||'/'||(select count(*) from rivalry_private.links);").trim();
const before=countState();
assert.equal((await active.db.rpc('rdd_save_match',{p_operation_id:randomUUID(),p_payload:{...payload,challenge_id:randomUUID(),challenge_revision:1}})).error?.code,'P0002');
assert.equal(countState(),before);
checks.push('enabled game writes through final wrapper; exact retry; invalid series remains atomic');
const recovery=unwrap(await admin.auth.admin.generateLink({type:'recovery',email:active.email,options:{redirectTo:origin+'/reset-password'}}));
const recoveryClient=client();
unwrap(await recoveryClient.auth.verifyOtp({token_hash:recovery.properties.hashed_token,type:'recovery'}));
const changed='W3-Recovered-Synthetic-2026!'; unwrap(await recoveryClient.auth.updateUser({password:changed}));
assert((await client().auth.signInWithPassword({email:active.email,password})).error);
unwrap(await client().auth.signInWithPassword({email:active.email,password:changed}));
active.session=unwrap(await active.db.auth.signInWithPassword({email:active.email,password:changed})).session;
checks.push('real Auth password recovery, changed password accepted and old password refused');
unwrap(await admin.from('league_members').update({status:'revoked'}).eq('user_id',active.user.id));
assert.equal(unwrap(await active.db.rpc('league_is_member')),false);
assert.equal((await change(active.session.access_token)).status,403);
assert.equal((await active.db.from('matches').select('*').limit(1)).data.length,0);
assert.equal((await active.db.rpc('rdd_solo_profile',{p_owner:active.user.id})).error?.code,'42501');
checks.push('existing valid token loses access immediately after revocation');
assert.equal((await fetch(origin+'/api/release-readiness')).status,404);
const files=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else files.push(file);}}
walk(path.join(localWorkdir,'next/static'));
for(const file of files){const content=readFileSync(file,'utf8');assert(!content.includes(status.SERVICE_ROLE_KEY),'server key absent from browser bundle');}
checks.push('server credential absent from '+files.length+' static build files; hosted diagnostic closed locally');
writeFileSync(path.join(localWorkdir,'http.json'),JSON.stringify({date:new Date().toISOString(),scope:'real synthetic Auth/PostgREST/Next; recovery generated locally without hosted SMTP',checks},null,2));
console.log(checks.join('\n'));
