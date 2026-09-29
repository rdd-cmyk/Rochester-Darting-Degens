// Locally rehearse an earlier RPC/admission-capable app source with the W3
// security fixes backported. No checkout switch, hosted deploy or data restore.
import { mkdirSync, copyFileSync, symlinkSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { root, localWorkdir, localStatus, localDockerEnv, origin } from './release-environment.mjs';
const [command,...rest]=process.argv.slice(2);
if(rest.length||!['build','serve'].includes(command))throw Error('Use build/serve only');
const ref='a72f7bf',dir=path.join(localWorkdir,'compatible-rollback'),tar=path.join(localWorkdir,'compatible-rollback.tar');
const hash=value=>createHash('sha256').update(value).digest('hex');
if(command==='build'){
 if(!existsSync(dir)){
  mkdirSync(dir,{recursive:true});
  execFileSync('git',['archive','--format=tar','--output='+tar,ref],{cwd:root,windowsHide:true});
  execFileSync('tar',['-xf',tar,'-C',dir],{cwd:root,windowsHide:true});
  symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'junction');
 }else if(JSON.parse(readFileSync(path.join(localWorkdir,'rollback-artifact.json'),'utf8')).baseGitRef!==ref)throw Error('Existing rollback artifact has a different base');
 const backports=[];
 for(const file of ['app/api/change-log/route.ts','app/change-log/ChangeLogClient.tsx','lib/supabaseClient.ts','components/board/BoardComposer.tsx','components/board/BoardPostCard.tsx']){
  const destination=path.join(dir,file);copyFileSync(path.join(root,file),destination);
  backports.push({file,sha256:hash(readFileSync(destination))});
 }
 const status=localStatus();
 const env={...localDockerEnv(),NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL:origin,RDD_INVITES_ENABLED:'0',RDD_LOCAL_PREVIEW:'0',RDD_VISUAL_FIXTURE:'0',
  NEXT_PUBLIC_RDD_VISUAL_FIXTURE:'0',GITHUB_TOKEN:'',GITHUB_REPO_OWNER:'',GITHUB_REPO_NAME:'',RESEND_API_KEY:'',
  RDD_INVITE_SECRET:randomBytes(48).toString('base64url')};
 for(const name of ['VERCEL','VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VERCEL_GIT_COMMIT_SHA','RDD_RELEASE_REHEARSAL'])delete env[name];
 execFileSync(process.execPath,[path.join(dir,'node_modules/next/dist/bin/next'),'build'],{cwd:dir,env,windowsHide:true,timeout:180000,stdio:'inherit'});
 writeFileSync(path.join(localWorkdir,'rollback-artifact.json'),JSON.stringify({date:new Date().toISOString(),baseGitRef:ref,backports,scope:'isolated local compatible app source; original baseline plus reviewed access fixes',buildArtifact:path.join(dir,'.next'),database:'same already-upgraded synthetic W3 project'},null,2));
 console.log('Compatible earlier app artifact built; no database reverted.');
}else{
 const status=localStatus();
 if(!existsSync(path.join(dir,'.next')))throw Error('Build rollback artifact first');
 const env={...localDockerEnv(),NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL:origin,RDD_INVITES_ENABLED:'0',RDD_LOCAL_PREVIEW:'0',RDD_VISUAL_FIXTURE:'0',
  NEXT_PUBLIC_RDD_VISUAL_FIXTURE:'0',GITHUB_TOKEN:'',GITHUB_REPO_OWNER:'',GITHUB_REPO_NAME:'',RESEND_API_KEY:''};
 for(const name of ['VERCEL','VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VERCEL_GIT_COMMIT_SHA','RDD_RELEASE_REHEARSAL'])delete env[name];
 const app=spawn(process.execPath,[path.join(dir,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3093'],{cwd:dir,env,windowsHide:true,stdio:'inherit'});
 const stop=()=>app.kill();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 app.once('exit',code=>{process.exitCode=code??1;});
}
