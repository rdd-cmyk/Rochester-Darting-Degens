// One-time synthetic restore proof into the dedicated W4 local stack.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {root,dockerHost,localDockerEnv} from '../local-environment.mjs';

execFileSync(process.execPath,[path.join(root,'scripts','release-restore-local.mjs'),'status'],{
 cwd:root,env:localDockerEnv(),timeout:30000,windowsHide:true,stdio:['ignore','pipe','pipe']
});
const source=path.join(root,'.local','w4-synthetic');
const manifest=JSON.parse(readFileSync(path.join(source,'dump-manifest.json'),'utf8'));
if(manifest.sourceProject!=='rdd-release-w3')throw Error('Wrong synthetic backup source');
// Supabase's target defaults grant public-schema clients access on CREATE.
// Temporarily close those defaults before replaying source object ACLs; the
// schema dump restores the source default privileges at its end.
let input=`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
`;
for(const name of ['roles.sql','schema.sql','data.sql']){
 if(!manifest.entries.some(entry=>entry.name===name))throw Error('Missing backup manifest entry');
 if(name==='data.sql')input+='\nSET session_replication_role = replica;\n';
 let sql=readFileSync(path.join(source,name),'utf8');
 if(name==='roles.sql'){
  const platformGrant=/^GRANT SET ON PARAMETER "log_min_messages" TO "supabase_realtime_admin";\r?\n/m;
  if(!platformGrant.test(sql))throw Error('Expected platform role grant changed; review restore script');
  // Local postgres cannot re-grant this managed platform-only parameter.
  sql=sql.replace(platformGrant,'');
 }
 input+=sql+'\n';
}
let stdout;
try{
 stdout=execFileSync('docker',['--host',dockerHost,'exec','-i','supabase_db_rdd-release-w4-restore',
  'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','--single-transaction','-f','-'],{
  cwd:root,env:localDockerEnv(),windowsHide:true,input,encoding:'utf8',maxBuffer:20000000,timeout:120000,
  stdio:['pipe','pipe','pipe']
 });
}catch(error){throw Error('Synthetic restore failed: '+String(error.stderr??'').slice(-2500));}
writeFileSync(path.join(source,'restore-result.json'),JSON.stringify({
 observedAt:new Date().toISOString(),targetProject:'rdd-release-w4-restore',exitCode:0,
 scope:'fictional local data only',outputLines:stdout.split(/\r?\n/).length
},null,2)+'\n');
console.log('Synthetic roles/schema/data restored atomically into the separate W4 target.');
