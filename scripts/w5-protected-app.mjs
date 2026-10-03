// Build/serve an isolated production artifact against only the W5 local
// protected restore. Build output stays in the ignored protected workdir.
import {readFileSync,writeFileSync,mkdirSync,existsSync,symlinkSync,copyFileSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import path from 'node:path';
import {root,cliPath,localDockerEnv} from './local-environment.mjs';

const [command,version='current',...extra]=process.argv.slice(2);
if(extra.length||!['build','serve'].includes(command)||!['current','rollback'].includes(version))
 throw Error('Use build/serve with current or rollback');
const workdir=path.join(root,'.local','release-w5-protected');
const manifest=JSON.parse(readFileSync(path.join(workdir,'manifest.json'),'utf8'));
if(manifest.targetProjectId!=='rdd-release-w4-protected')throw Error('Wrong W5 target');
const status=JSON.parse(execFileSync(cliPath(),['status','-o','json','--workdir',
 path.join(root,'.local','release-w4-protected')],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
}));
if(new URL(status.API_URL).origin!=='http://127.0.0.1:58921')throw Error('Nonlocal W5 API');
const origin='http://127.0.0.1:3293';
const env={...localDockerEnv(),NODE_ENV:'production',
 NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,
 SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,NEXT_PUBLIC_SITE_URL:origin,
 RDD_INVITES_ENABLED:'0',RDD_LOCAL_PREVIEW:'0',RDD_VISUAL_FIXTURE:'0',
 NEXT_PUBLIC_RDD_VISUAL_FIXTURE:'0',GITHUB_TOKEN:'',GITHUB_REPO_OWNER:'',
 GITHUB_REPO_NAME:'',RESEND_API_KEY:'',RDD_INVITE_FROM:'',
 RDD_INVITE_SECRET:randomBytes(48).toString('base64url')};
for(const name of ['VERCEL','VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VERCEL_GIT_COMMIT_SHA'])delete env[name];
const dir=path.join(workdir,version==='current'?'app-current':'app-rollback');
const sourceRef=version==='current'?execFileSync('git',['rev-parse','HEAD'],{
 cwd:root,encoding:'utf8',windowsHide:true}).trim():'a72f7bf';
const evidence=path.join(workdir,`app-${version}.json`);
if(command==='build'){
 if(existsSync(dir)||existsSync(evidence))throw Error('W5 app artifact already exists; preserve it');
 mkdirSync(dir,{recursive:true});
 const archive=path.join(workdir,`app-${version}.tar`);
 execFileSync('git',['archive','--format=tar','--output='+archive,sourceRef],{
  cwd:root,windowsHide:true,timeout:60000,stdio:['ignore','pipe','pipe']});
 execFileSync('tar',['-xf',archive,'-C',dir],{
  cwd:root,windowsHide:true,timeout:60000,stdio:['ignore','pipe','pipe']});
 symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'junction');
 const backports=[];
 if(version==='rollback'){
  for(const file of ['app/api/change-log/route.ts','app/change-log/ChangeLogClient.tsx',
   'lib/supabaseClient.ts','components/board/BoardComposer.tsx',
   'components/board/BoardPostCard.tsx']){
   const destination=path.join(dir,file);
   copyFileSync(path.join(root,file),destination);
   backports.push({file,sha256:createHash('sha256').update(readFileSync(destination)).digest('hex')});
  }
 }
 execFileSync(process.execPath,[path.join(dir,'node_modules','next','dist','bin','next'),'build'],{
  cwd:dir,env,timeout:240000,windowsHide:true,stdio:'inherit'
 });
 writeFileSync(evidence,JSON.stringify({scope:'W5 isolated protected local build',
  sourceRef,version,backports,builtAtUtc:new Date().toISOString(),
  apiTarget:'http://127.0.0.1:58921',appOrigin:origin},null,2)+'\n',{flag:'wx'});
 console.log(`W5 ${version} app built against the protected local target; artifact retained only in ignored workdir.`);
}else{
 if(!existsSync(evidence)||!existsSync(path.join(dir,'.next')))
  throw Error('Build W5 app artifact first');
 const app=spawn(process.execPath,[path.join(dir,'node_modules','next','dist','bin','next'),
  'start','--hostname','127.0.0.1','--port','3293'],{
  cwd:dir,env,windowsHide:true,stdio:'inherit'
 });
 const stop=()=>app.kill();
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 app.once('error',()=>{process.exitCode=1;});
 app.once('exit',code=>{process.exitCode=code??1;});
}
