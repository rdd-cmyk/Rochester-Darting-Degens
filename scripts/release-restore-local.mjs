// W4 protected-copy restore target. Dedicated Docker identity, workdir and
// loopback ports. Outbound integrations must be disabled before real restore.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {root,docker,localDockerEnv,cliPath,assertLocalBindings,assertWindowsPortDefault} from './local-environment.mjs';

const [command,target='synthetic',...rest]=process.argv.slice(2);
if(rest.length||!['start','status','stop'].includes(command)||!['synthetic','protected'].includes(target))
 throw Error('Use start, status or stop with optional synthetic/protected target');
const protectedCopy=target==='protected';
const projectId=protectedCopy?'rdd-release-w4-protected':'rdd-release-w4-restore';
const network=protectedCopy?'rdd-release-w4-protected-loopback':'rdd-release-w4-loopback';
const workdir=path.join(root,'.local',protectedCopy?'release-w4-protected':'release-w4-restore');
const portPrefix=protectedCopy?'5892':'5792';
const cli=args=>execFileSync(cliPath(),[...args,'--workdir',workdir],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:240000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
});
function assertTarget(){
 const ids=docker(['ps','-aq','--filter',`label=com.supabase.cli.project=${projectId}`]).split(/\s+/).filter(Boolean);
 if(!ids.length)throw Error('Dedicated W4 restore containers not found');
 const containers=JSON.parse(docker(['inspect',...ids]));
 assertLocalBindings(containers);
 for(const service of ['db','auth','rest'])if(!containers.some(c=>c.Name===`/supabase_${service}_${projectId}`&&c.State.Running))
  throw Error(`W4 ${service} service not ready`);
 const details=JSON.parse(docker(['network','inspect',network]))[0];
 if(details.Options?.['com.docker.network.bridge.host_binding_ipv4']!=='127.0.0.1')
  throw Error('W4 restore network is not loopback-bound');
 const status=JSON.parse(cli(['status','-o','json']));
 if(new URL(status.API_URL).origin!==`http://127.0.0.1:${portPrefix}1`||
    new URL(status.DB_URL).port!==`${portPrefix}2`)throw Error('W4 restore port drift');
 return status;
}
if(command==='start'){
 assertWindowsPortDefault();
 if(!docker(['network','ls','--format','{{.Name}}']).split(/\r?\n/).includes(network))
  docker(['network','create','--driver','bridge',
   '--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network]);
 mkdirSync(path.join(workdir,'supabase'),{recursive:true});
 const config=readFileSync(path.join(root,'supabase','config.toml'),'utf8')
  .replace(/project_id = "[^"]+"/,`project_id = "${projectId}"`)
  .replaceAll('5432',portPrefix).replaceAll(':3000',protectedCopy?':3293':':3193')
  .replace(/(\[studio\]\r?\nenabled = )true/,'$1false')
  .replace(/(\[analytics\]\r?\nenabled = )true/,'$1false');
 writeFileSync(path.join(workdir,'supabase','config.toml'),config);
 cli(['start','--network-id',network,...(process.platform==='win32'?['--exclude','vector']:[])]);
 assertTarget();
 console.log(`W4 ${target} restore target ready on loopback; verify outbound integrations disabled before restoring real data.`);
}else if(command==='status'){
 assertTarget();console.log(`W4 ${target} restore target healthy and loopback-bound; credentials suppressed.`);
}else{
 assertTarget();cli(['stop']);console.log(`W4 ${target} restore target stopped; local volume retained.`);
}
