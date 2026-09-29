// One-time fictional Auth/RLS/RPC acceptance on RDD Release Testing only.
// Key material is held in process memory; fictional credentials stay ignored.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {root,cliPath,localDockerEnv} from '../local-environment.mjs';

const dir=path.join(root,'.local','release-w6-testing');
const fixturePath=path.join(dir,'fictional-hosted.json');
if(existsSync(fixturePath))throw Error('W6 fictional hosted fixture already exists');
const manifest=JSON.parse(readFileSync(path.join(dir,'manifest.json'),'utf8'));
assert.equal(manifest.projectRef,'uepayhdrgzrxhkqbwebo');
const cli=(args)=>{
 try{return execFileSync(cliPath(),args,{cwd:root,env:localDockerEnv(),
  encoding:'utf8',timeout:30000,maxBuffer:10*1024*1024,windowsHide:true,
  stdio:['ignore','pipe','pipe']});}
 catch{throw Error('W6 isolated Supabase CLI action failed');}
};
const keys=JSON.parse(cli(['projects','api-keys','--project-ref',manifest.projectRef,
 '--reveal','-o','json']));
const key=(type,name)=>{
 const matches=keys.filter(item=>item.type===type&&item.name===name);
 assert.equal(matches.length,1,`Expected one ${type} ${name} key`);
 assert.equal(typeof matches[0].api_key,'string');
 return matches[0].api_key;
};
const url=`https://${manifest.projectRef}.supabase.co`;
const admin=createClient(url,key('secret','default'),
 {auth:{persistSession:false,autoRefreshToken:false}});
const browserKey=key('legacy','anon');
const client=()=>createClient(url,browserKey,
 {auth:{persistSession:false,autoRefreshToken:false}});
const unwrap=result=>{if(result.error)throw Error(`${result.error.code}: ${result.error.message}`);return result.data;};
const sql=statement=>{
 const response=JSON.parse(cli(['db','query','--linked','--project-ref',manifest.projectRef,
  '-o','json',statement]));
 return response.rows;
};
const preflight=sql(`select json_build_object('auth',(select count(*) from auth.users),
 'matches',(select count(*) from public.matches),
 'history',(select count(*) from supabase_migrations.schema_migrations)) as state`)[0].state;
assert.deepEqual(preflight,{auth:0,matches:0,history:12});
const password=`W6!${randomBytes(24).toString('base64url')}aA1`;
const people=[];
for(const label of ['A','B']){
 const email=`w6-${label.toLowerCase()}-${randomUUID()}@example.test`;
 const user=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 const db=client();
 unwrap(await db.auth.signInWithPassword({email,password}));
 assert.equal(unwrap(await db.rpc('league_is_member')),false);
 assert.equal(unwrap(await db.from('profiles').select('id').eq('id',user.id)).length,0);
 unwrap(await admin.from('league_members').insert({user_id:user.id,source_invite_id:null}));
 assert.equal(unwrap(await db.rpc('league_is_member')),true);
 unwrap(await db.from('profiles').upsert({id:user.id,display_name:`W6 fictional ${label}`,
  first_name:'Fictional',last_name:label,include_first_name_in_display:false}));
 people.push({label,id:user.id,email,db});
}
const [a,b]=people;
for(const person of people)assert.match(person.id,/^[0-9a-f-]{36}$/i);
sql(`insert into rdd_private.planning_organizers(user_id) values('${a.id}');
 insert into public.board_members(user_id,status,role) values('${a.id}','approved','organizer');`);
assert.equal(unwrap(await a.db.from('board_members').select('role').eq('user_id',a.id)).length,1);
const oldWrite=await a.db.from('matches').insert({played_at:new Date().toISOString(),
 game_type:'501',board_type:'Soft Tip',created_by:a.id,notes:'W6 rejected split writer'});
assert(oldWrite.error,'Old direct match writer must be denied');
const payload={submitted_by:a.id,played_at:new Date().toISOString(),game_type:'701',
 board_type:'Soft Tip',allow_duplicate:true,
 game_config:{version:1,preset:'701-double-v1',format:'individual',context:'competitive',
  status:'completed',handicap:false,sides:{},teamScores:{},otherName:'',finish:'ordinary'},
 players:[{player_id:a.id,is_winner:true,score:60},
  {player_id:b.id,is_winner:false,score:50}]};
const disabled=await a.db.rpc('rdd_save_match',{p_operation_id:randomUUID(),p_payload:payload});
assert.equal(disabled.error?.code,'22023');
sql('update rdd_private.game_modes_control set enabled=true');
const operation=randomUUID();
const match=unwrap(await a.db.rpc('rdd_save_match',{
 p_operation_id:operation,p_payload:payload}));
assert.equal(unwrap(await a.db.rpc('rdd_save_match',{
 p_operation_id:operation,p_payload:payload})).replayed,true);
assert.equal(unwrap(await b.db.from('matches').select('id').eq('id',match.match_id)).length,1);
const soloPayload={action:'save',submitted_by:a.id,id:randomUUID(),session_id:randomUUID(),
 expected_revision:null,played_at:new Date().toISOString(),
 completed_at:new Date().toISOString(),timezone:'America/New_York',game_type:'501',
 board_type:'Steel Tip',preset:'501-double-v1',status:'completed',score:20,
 score_unit:'PPD',raw_total:null,darts:null,include_in_stats:true,night_id:null,
 share_with_night:false,notes:'W6 fictional private note',location:null};
const soloOp=randomUUID();
assert.equal(unwrap(await a.db.rpc('rdd_solo_write',{
 p_operation_id:soloOp,p_payload:soloPayload})).revision,1);
assert.equal(unwrap(await a.db.rpc('rdd_solo_write',{
 p_operation_id:soloOp,p_payload:soloPayload})).replayed,true);
assert.equal(unwrap(await b.db.from('solo_games').select('id').eq('id',soloPayload.id)).length,0);
const avatar=unwrap(await a.db.rpc('rdd_avatar_self'));
const avatarPayload={action:'avatar',submitted_by:a.id,avatar_id:'tiger',
 expected_revision:avatar.revision};
const avatarOp=randomUUID();
unwrap(await a.db.rpc('rdd_rivalry_write',{p_operation_id:avatarOp,p_payload:avatarPayload}));
assert.equal(unwrap(await a.db.rpc('rdd_rivalry_write',{
 p_operation_id:avatarOp,p_payload:avatarPayload})).replayed,true);
const counts=sql(`select json_build_object('auth',(select count(*) from auth.users),
 'profiles',(select count(*) from public.profiles),
 'members',(select count(*) from public.league_members),
 'matches',(select count(*) from public.matches),
 'history',(select count(*) from supabase_migrations.schema_migrations),
 'gameModesEnabled',(select enabled from rdd_private.game_modes_control limit 1)) as state`)[0].state;
assert.deepEqual(counts,{auth:2,profiles:2,members:2,matches:1,history:12,gameModesEnabled:true});
writeFileSync(fixturePath,JSON.stringify({scope:'fictional W6 hosted testing only',
 createdAtUtc:new Date().toISOString(),projectRef:manifest.projectRef,
 password,people:people.map(({label,id,email})=>({label,id,email})),
 matchId:match.match_id,soloId:soloPayload.id},null,2)+'\n',{flag:'wx'});
writeFileSync(path.join(dir,'hosted-api-result.json'),JSON.stringify({
 observedAtUtc:new Date().toISOString(),projectRef:manifest.projectRef,
 accountsCreated:2,deniedBeforeAdmission:true,explicitAdmission:true,
 organizerPreparedForFictionalAccount:true,oldSplitWriteDenied:true,
 modesDisabledByDefault:true,modesEnabledForTesting:true,
 matchSavedAndReplayed:true,soloPrivateAndReplayed:true,avatarSavedAndReplayed:true,
 ...counts
},null,2)+'\n',{flag:'wx'});
console.log('W6 isolated hosted API passed: fictional Auth/admission, organizer, direct-write denial, match/Solo/avatar RPCs and retries. Two fictional users and game-mode testing remain enabled in test project.');
