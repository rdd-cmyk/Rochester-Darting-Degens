import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {root,localWorkdir,projectId,docker,localDockerEnv,localStatus,cliPath,
 assertLocalBindings,assertWindowsPortDefault,sql,releaseFiles,origin,mailOrigin} from './release-environment.mjs';
const [command,...extra]=process.argv.slice(2);
const network='rdd-release-w3-loopback';
const read=file=>readFileSync(path.join(root,file),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
function evidence(name,data){mkdirSync(localWorkdir,{recursive:true});writeFileSync(path.join(localWorkdir,name+'.json'),JSON.stringify(data,null,2)+'\n');}
const sourceManifest=()=>releaseFiles.map(file=>({file,sha256:hash(readFileSync(path.join(root,file))),repository_lf_sha256:hash(read(file).replace(/\r\n/g,'\n'))}));
try{
 if(extra.length||!['start','setup','rehearse','build','serve','stop','status'].includes(command))throw Error('Use release-local with start/setup/rehearse/build/serve/stop/status only.');
 if(command==='start'){
  assertWindowsPortDefault();
  if(!docker(['network','ls','--format','{{.Name}}']).split(/\r?\n/).includes(network))
   docker(['network','create','--driver','bridge','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network]);
  if(JSON.parse(docker(['network','inspect',network]))[0]?.Options?.['com.docker.network.bridge.host_binding_ipv4']!=='127.0.0.1')throw Error('Non-loopback release network');
  mkdirSync(path.join(localWorkdir,'supabase'),{recursive:true});
  writeFileSync(path.join(localWorkdir,'supabase/config.toml'),read('supabase/config.toml')
   .replace(/project_id = "[^"]+"/,`project_id = "${projectId}"`).replaceAll('5432','5692').replaceAll('5433','5693').replaceAll(':3000',':3093'));
  execFileSync(cliPath(),['start','--workdir',localWorkdir,'--network-id',network,'--exclude','vector'],{
   env:localDockerEnv(),cwd:root,windowsHide:true,timeout:240000,stdio:['ignore','pipe','pipe']});
  const ids=docker(['ps','-aq','--filter',`label=com.supabase.cli.project=${projectId}`]).split(/\s+/).filter(Boolean);
  assertLocalBindings(JSON.parse(docker(['inspect',...ids])));localStatus();
  console.log('W3 release stack ready on loopback56921; no hosted target.');
 }else if(command==='stop'){
  localStatus();execFileSync(cliPath(),['stop','--workdir',localWorkdir],{env:localDockerEnv(),cwd:root,windowsHide:true,timeout:60000,stdio:['ignore','pipe','pipe']});
  console.log('W3 stack stopped; volumes retained.');
 }else if(command==='status'){
  localStatus();console.log('W3 fixed target healthy; credential output suppressed.');
 }else if(command==='setup'){
  localStatus();
  if(sql("select to_regclass('public.matches') is not null;").trim()!=='f')throw Error('W3 app database already contains schema; inspect instead of replay/reset.');
  sql(read('supabase/tests/fixtures/existing_schema_baseline.sql'));
  sql(read('supabase/tests/rehearsal/legacy-fixture.sql'));
  const steps=[];
  for(const file of releaseFiles){
   const started=Date.now();sql(read(file));steps.push({file,milliseconds:Date.now()-started});
   if(file.endsWith('invite_only_registration.sql'))sql("INSERT INTO public.league_members(user_id) VALUES('00000000-0000-4000-8000-000000000099');");
  }
  sql('NOTIFY pgrst,\'reload schema\';');
  evidence('installation',{date:new Date().toISOString(),projectId,manifest:sourceManifest(),steps,scope:'synthetic legacy baseline only'});
  console.log('W3 final app schema installed once; original synthetic row snapshots preserved.');
 }else if(command==='rehearse'){
  await import('./release-sql.mjs').then(module=>module.rehearseSql());
 }else{
  const status=localStatus();
  const env={...localDockerEnv(),NODE_ENV:'production',RDD_RELEASE_REHEARSAL:'1',
   NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,RDD_LOCAL_PREVIEW:command==='serve'?'1':'0',
   RDD_INVITES_ENABLED:command==='serve'?'1':'0',RDD_INVITE_ORIGIN:origin,RDD_INVITE_SECRET:randomBytes(48).toString('base64url'),
   RDD_VISUAL_FIXTURE:'0',NEXT_PUBLIC_RDD_VISUAL_FIXTURE:'0',GITHUB_TOKEN:'',GITHUB_REPO_OWNER:'',GITHUB_REPO_NAME:'',
   RESEND_API_KEY:'',RDD_INVITE_FROM:'',NEXT_PUBLIC_SITE_URL:origin};
  for(const name of ['VERCEL','VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VERCEL_GIT_COMMIT_SHA'])delete env[name];
  const messages=[];
  const mail=createServer(async(req,res)=>{
   if(req.headers.host!==new URL(mailOrigin).host||req.headers.origin){res.writeHead(403).end();return;}
   if(req.method==='GET'&&req.url==='/messages'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(messages));return;}
   if(req.method!=='POST'||req.url!=='/send'){res.writeHead(404).end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>20000){res.writeHead(413).end();return;}}
   try{const value=JSON.parse(body);if(!value.to?.every(email=>email.endsWith('@example.test'))){res.writeHead(400).end();return;}
    if(value.to.some(email=>email.startsWith('reject-mail-'))){res.writeHead(422).end();return;}
    if(value.to.some(email=>email.startsWith('unknown-mail-'))){res.writeHead(503).end();return;}
    let record=messages.find(m=>m.requestId===req.headers['idempotency-key']);
    if(!record){record={...value,id:randomUUID(),requestId:req.headers['idempotency-key']};messages.push(record);}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:record.id}));
   }catch{res.writeHead(400).end();}
  });
  if(command==='serve')await new Promise((resolve,reject)=>{mail.once('error',reject);mail.listen(56930,'127.0.0.1',resolve);});
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),...(command==='build'?['build']:['start','--hostname','127.0.0.1','--port','3093'])],
   {cwd:root,env,windowsHide:true,stdio:'inherit'});
  const close=()=>{mail.close();child.kill();};process.once('SIGINT',close);process.once('SIGTERM',close);
  child.once('error',()=>{mail.close();process.exitCode=1;});child.once('exit',code=>{mail.close();process.exitCode=code??1;});
 }
}catch(error){
 console.error('W3 local command failed; no hosted fallback.');
 if(String(error.cmd??'').includes('psql')){console.error(String(error.stdout??'').slice(-4000));console.error(String(error.stderr??'').slice(-2000));}
 else console.error(error.cmd?'Local process failed; inspect fixed-target readiness.':error.message);
 process.exitCode=1;
}
