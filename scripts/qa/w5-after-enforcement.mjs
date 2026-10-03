// Protected W5 HTTP/RPC acceptance using only fictional admitted accounts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {root,cliPath,localDockerEnv,dockerHost} from '../local-environment.mjs';

const workdir=path.join(root,'.local','release-w5-protected');
const fixture=JSON.parse(readFileSync(path.join(workdir,'fictional-accounts.json'),'utf8'));
assert.equal(fixture.scope,'fictional local W5 only');
const status=JSON.parse(execFileSync(cliPath(),['status','-o','json','--workdir',
 path.join(root,'.local','release-w4-protected')],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
}));
assert.equal(new URL(status.API_URL).origin,'http://127.0.0.1:58921');
const client=()=>createClient(status.API_URL,status.ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false}});
const unwrap=result=>{if(result.error)throw Error(`${result.error.code}: ${result.error.message}`);return result.data;};
const a=client(),b=client();
const aSession=unwrap(await a.auth.signInWithPassword({email:fixture.people[0].email,
 password:fixture.password})).session;
unwrap(await b.auth.signInWithPassword({email:fixture.people[1].email,
 password:fixture.password}));
assert.equal(unwrap(await a.rpc('league_is_member')),true);
assert.equal(unwrap(await b.rpc('league_is_member')),true);
assert.equal(unwrap(await a.from('matches').select('id').eq('id',fixture.legacyMatchId)).length,1);
const oldWrite=await a.from('matches').insert({played_at:new Date().toISOString(),game_type:'501',
 board_type:'Soft Tip',created_by:fixture.people[0].id,notes:'W5 rejected old writer'});
assert(oldWrite.error,'Old direct split writer remained enabled after enforcement');
const payload={submitted_by:fixture.people[0].id,played_at:new Date().toISOString(),
 game_type:'701',board_type:'Soft Tip',allow_duplicate:true,
 game_config:{version:1,preset:'701-double-v1',format:'individual',context:'competitive',
  status:'completed',handicap:false,sides:{},teamScores:{},otherName:'',finish:'ordinary'},
 players:[
  {player_id:fixture.people[0].id,is_winner:true,score:60},
  {player_id:fixture.people[1].id,is_winner:false,score:50}
 ]};
const disabled=await a.rpc('rdd_save_match',{p_operation_id:randomUUID(),p_payload:payload});
assert.equal(disabled.error?.code,'22023');
const sql=statement=>execFileSync('docker',['--host',dockerHost,'exec','-i',
 'supabase_db_rdd-release-w4-protected','psql','-X','-U','postgres','-d','postgres',
 '-v','ON_ERROR_STOP=1','-At','-c',statement],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']}).trim();
let saved;
try{
 sql('update rdd_private.game_modes_control set enabled=true;');
 const operation=randomUUID();
 saved=unwrap(await a.rpc('rdd_save_match',{p_operation_id:operation,p_payload:payload}));
 const replay=unwrap(await a.rpc('rdd_save_match',{p_operation_id:operation,p_payload:payload}));
 assert.equal(replay.match_id,saved.match_id);
 assert.equal(replay.replayed,true);
 const rejected=await a.rpc('rdd_save_match',{p_operation_id:randomUUID(),
  p_payload:{...payload,challenge_id:randomUUID(),challenge_revision:1}});
 assert.equal(rejected.error?.code,'P0002');
}finally{sql('update rdd_private.game_modes_control set enabled=false;');}
const soloPayload={action:'save',submitted_by:fixture.people[0].id,id:randomUUID(),
 session_id:randomUUID(),expected_revision:null,played_at:new Date().toISOString(),
 completed_at:new Date().toISOString(),timezone:'America/New_York',
 game_type:'501',board_type:'Steel Tip',preset:'501-double-v1',status:'completed',
 score:20,score_unit:'PPD',raw_total:null,darts:null,include_in_stats:true,
 night_id:null,share_with_night:false,notes:'W5 fictional private note',location:null};
const soloOperation=randomUUID();
const solo=unwrap(await a.rpc('rdd_solo_write',{p_operation_id:soloOperation,p_payload:soloPayload}));
assert.equal(solo.revision,1);
assert.equal(unwrap(await a.rpc('rdd_solo_write',{p_operation_id:soloOperation,p_payload:soloPayload})).replayed,true);
assert.equal(unwrap(await b.from('solo_games').select('id').eq('id',soloPayload.id)).length,0);
const avatar=unwrap(await a.rpc('rdd_avatar_self'));
const avatarPayload={action:'avatar',submitted_by:fixture.people[0].id,
 avatar_id:'tiger',expected_revision:avatar.revision};
const avatarOperation=randomUUID();
unwrap(await a.rpc('rdd_rivalry_write',{p_operation_id:avatarOperation,p_payload:avatarPayload}));
assert.equal(unwrap(await a.rpc('rdd_rivalry_write',{
 p_operation_id:avatarOperation,p_payload:avatarPayload})).replayed,true);
const origin='http://127.0.0.1:3293';
for(const route of ['/','/auth','/matches','/stats','/rivalries','/league-night','/solo']){
 const response=await fetch(origin+route);
 assert.equal(response.status,200,route);
}
assert.equal((await fetch(origin+'/api/change-log')).status,401);
assert.equal((await fetch(origin+'/api/change-log',{
 headers:{Authorization:`Bearer ${aSession.access_token}`}})).status,500);
assert.equal((await fetch(origin+'/api/release-readiness')).status,404);
const staticRoot=path.join(workdir,'app-current','.next','static');
const files=[];
function walk(folder){for(const entry of readdirSync(folder)){
 const file=path.join(folder,entry);
 if(statSync(file).isDirectory())walk(file);else files.push(file);
}}
walk(staticRoot);
for(const file of files)assert(!readFileSync(file).includes(Buffer.from(status.SERVICE_ROLE_KEY)),
 'Service credential in static asset');
writeFileSync(path.join(workdir,'after-enforcement.json'),JSON.stringify({
 observedAtUtc:new Date().toISOString(),scope:'protected local copy; fictional accounts only',
 oldSplitWriteDenied:true,gameModesDisabledByDefault:true,fictionalRpcMatchSaved:true,
 exactMatchRetry:true,invalidChallengeAtomic:true,privateSoloAndRetry:true,
 rivalryAvatarAndRetry:true,routes200:7,changeLogAdmission:true,
 staticAssetsChecked:files.length,originalRowsRecheckedSeparately:true
},null,2)+'\n',{flag:'wx'});
console.log('W5 current app and RPC checks passed on fictional accounts: direct writes denied, guarded match/solo/avatar saves and retries succeeded, seven routes healthy.');
