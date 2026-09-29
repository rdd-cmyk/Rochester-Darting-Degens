// Exercise an earlier compatible application against the already-upgraded,
// protected local database. All writes use fictional W5 accounts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {root,cliPath,localDockerEnv,dockerHost} from '../local-environment.mjs';

const dir=path.join(root,'.local','release-w5-protected');
const artifact=JSON.parse(readFileSync(path.join(dir,'app-rollback.json'),'utf8'));
assert.equal(artifact.sourceRef,'a72f7bf');
assert.equal(artifact.apiTarget,'http://127.0.0.1:58921');
const fixture=JSON.parse(readFileSync(path.join(dir,'fictional-accounts.json'),'utf8'));
assert.equal(fixture.scope,'fictional local W5 only');
const status=JSON.parse(execFileSync(cliPath(),['status','-o','json','--workdir',
 path.join(root,'.local','release-w4-protected')],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
}));
assert.equal(new URL(status.API_URL).origin,'http://127.0.0.1:58921');
const a=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const b=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const unwrap=result=>{if(result.error)throw Error(`${result.error.code}: ${result.error.message}`);return result.data;};
unwrap(await a.auth.signInWithPassword({email:fixture.people[0].email,password:fixture.password}));
unwrap(await b.auth.signInWithPassword({email:fixture.people[1].email,password:fixture.password}));
assert.equal(unwrap(await a.rpc('league_is_member')),true);
assert.equal(unwrap(await b.rpc('league_is_member')),true);
assert.equal(unwrap(await a.from('matches').select('id').eq('id',fixture.legacyMatchId)).length,1);
const sql=statement=>execFileSync('docker',['--host',dockerHost,'exec','-i',
 'supabase_db_rdd-release-w4-protected','psql','-X','-U','postgres','-d','postgres',
 '-v','ON_ERROR_STOP=1','-At','-c',statement],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']}).trim();
const payload={submitted_by:fixture.people[0].id,played_at:new Date().toISOString(),
 game_type:'701',board_type:'Soft Tip',allow_duplicate:true,
 game_config:{version:1,preset:'701-double-v1',format:'individual',context:'competitive',
  status:'completed',handicap:false,sides:{},teamScores:{},otherName:'',finish:'ordinary'},
 players:[
  {player_id:fixture.people[0].id,is_winner:true,score:65},
  {player_id:fixture.people[1].id,is_winner:false,score:55}
 ]};
let match;
try{
 sql('update rdd_private.game_modes_control set enabled=true;');
 const operation=randomUUID();
 match=unwrap(await a.rpc('rdd_save_match',{p_operation_id:operation,p_payload:payload}));
 const replay=unwrap(await a.rpc('rdd_save_match',{p_operation_id:operation,p_payload:payload}));
 assert.equal(replay.match_id,match.match_id);
 assert.equal(replay.replayed,true);
}finally{sql('update rdd_private.game_modes_control set enabled=false;');}
assert.equal(unwrap(await b.from('matches').select('id').eq('id',match.match_id)).length,1);
const soloPayload={action:'save',submitted_by:fixture.people[0].id,id:randomUUID(),
 session_id:randomUUID(),expected_revision:null,played_at:new Date().toISOString(),
 completed_at:new Date().toISOString(),timezone:'America/New_York',game_type:'501',
 board_type:'Steel Tip',preset:'501-double-v1',status:'completed',score:18,
 score_unit:'PPD',raw_total:null,darts:null,include_in_stats:true,night_id:null,
 share_with_night:false,notes:'W5 rollback fictional private note',location:null};
const operation=randomUUID();
const solo=unwrap(await a.rpc('rdd_solo_write',{p_operation_id:operation,p_payload:soloPayload}));
assert.equal(solo.revision,1);
assert.equal(unwrap(await a.rpc('rdd_solo_write',{p_operation_id:operation,p_payload:soloPayload})).replayed,true);
assert.equal(unwrap(await b.from('solo_games').select('id').eq('id',soloPayload.id)).length,0);
for(const route of ['/','/auth','/matches','/stats','/rivalries','/league-night','/solo']){
 const response=await fetch(`http://127.0.0.1:3293${route}`);
 assert.equal(response.status,200,route);
}
writeFileSync(path.join(dir,'compatible-rollback.json'),JSON.stringify({
 observedAtUtc:new Date().toISOString(),scope:'protected local copy; fictional accounts only',
 sourceRef:artifact.sourceRef,matchedExistingRecord:true,newMatchSavedAndReplayed:true,
 newSoloSavedAndReplayed:true,soloPrivate:true,routes200:7
},null,2)+'\n',{flag:'wx'});
console.log('W5 compatible app passed on upgraded protected DB: prior record read, new match/Solo writes and exact retries, seven routes healthy.');
