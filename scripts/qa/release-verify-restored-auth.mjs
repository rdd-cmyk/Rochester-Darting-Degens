// Synthetic-only Auth/profile proof on the separate W4 restored local stack.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {root,cliPath,localDockerEnv} from '../local-environment.mjs';

const workdir=path.join(root,'.local','release-w4-restore');
const raw=execFileSync(cliPath(),['status','--workdir',workdir,'-o','json'],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
});
const status=JSON.parse(raw);
if(new URL(status.API_URL).origin!=='http://127.0.0.1:57921')throw Error('Wrong restored Auth target');
const password=JSON.parse(readFileSync(path.join(root,'.local','release-w3','rivalry-room','demo.json'),'utf8')).password;
const client=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const signed=await client.auth.signInWithPassword({email:'rivalry-ben@example.test',password});
if(signed.error||!signed.data.user)throw Error('Restored synthetic Auth password did not authenticate');
const {data,error}=await client.from('profiles').select('id').eq('id',signed.data.user.id).single();
if(error||data?.id!==signed.data.user.id)throw Error('Restored Auth/profile relationship is not usable through RLS');
writeFileSync(path.join(root,'.local','w4-synthetic','auth-result.json'),JSON.stringify({
 observedAt:new Date().toISOString(),target:'rdd-release-w4-restore',passwordLogin:true,
 profileRelationship:true,scope:'synthetic account only; no credential or identity stored'
},null,2)+'\n');
console.log('Restored synthetic account signs in and reaches its matching profile through RLS.');
