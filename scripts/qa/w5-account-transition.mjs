// W5 protected local rehearsal: create only fictional accounts, exercise
// explicit admission, and save one fictional legacy split-write match before
// direct-write enforcement. Never print or persist restored identities.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {root,cliPath,localDockerEnv} from '../local-environment.mjs';

const workdir=path.join(root,'.local','release-w5-protected');
const fixturePath=path.join(workdir,'fictional-accounts.json');
if(existsSync(fixturePath))throw Error('W5 fictional accounts already exist; preserve and inspect them');
const manifest=JSON.parse(readFileSync(path.join(workdir,'manifest.json'),'utf8'));
if(manifest.targetProjectId!=='rdd-release-w4-protected')throw Error('Wrong W5 target');
const status=JSON.parse(execFileSync(cliPath(),['status','-o','json','--workdir',
 path.join(root,'.local','release-w4-protected')],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
}));
if(new URL(status.API_URL).origin!=='http://127.0.0.1:58921')throw Error('Nonlocal W5 API target');
const unwrap=result=>{if(result.error)throw Error(`${result.error.code}: ${result.error.message}`);return result.data;};
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,
 {auth:{persistSession:false,autoRefreshToken:false}});
const create=()=>createClient(status.API_URL,status.ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false}});
const password='W5-Fictional-'+randomBytes(18).toString('base64url')+'!';
const people=[];
for(const label of ['A','B']){
 const email=`w5-${label.toLowerCase()}-${randomUUID()}@example.test`;
 const user=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 const db=create();
 unwrap(await db.auth.signInWithPassword({email,password}));
 assert.equal(unwrap(await db.rpc('league_is_member')),false);
 assert.equal((await db.from('profiles').select('id').eq('id',user.id)).data.length,0);
 const denied=await db.from('profiles').upsert({id:user.id,display_name:`W5 fictional ${label}`});
 assert(denied.error,'Unadmitted profile write should fail');
 unwrap(await admin.from('league_members').insert({user_id:user.id,source_invite_id:null}));
 assert.equal(unwrap(await db.rpc('league_is_member')),true);
 unwrap(await db.from('profiles').upsert({id:user.id,display_name:`W5 fictional ${label}`,
  first_name:'Fictional',last_name:label,include_first_name_in_display:false}));
 assert.equal(unwrap(await db.from('profiles').select('id').eq('id',user.id)).length,1);
 people.push({label,id:user.id,email});
}
const first=create();
unwrap(await first.auth.signInWithPassword({email:people[0].email,password}));
const match=unwrap(await first.from('matches').insert({
 played_at:new Date().toISOString(),game_type:'501',board_type:'Soft Tip',
 created_by:people[0].id,notes:'W5 fictional legacy-client rehearsal'
}).select('id').single());
unwrap(await first.from('match_players').insert([
 {match_id:match.id,player_id:people[0].id,score:60,is_winner:true},
 {match_id:match.id,player_id:people[1].id,score:40,is_winner:false}
]));
writeFileSync(fixturePath,JSON.stringify({scope:'fictional local W5 only',
 createdAtUtc:new Date().toISOString(),people,password,legacyMatchId:match.id},null,2)+'\n',{flag:'wx'});
console.log('W5 fictional accounts were denied before explicit admission, accepted afterward, and saved one legacy split-write match locally.');
