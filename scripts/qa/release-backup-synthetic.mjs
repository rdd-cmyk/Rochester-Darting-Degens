// Prove the official roles/schema/data dump format on the disposable W3
// stack before any W4 production export. Files remain ignored synthetic data.
import {mkdirSync,statSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root,localWorkdir,localStatus,cliPath,localDockerEnv} from '../release-environment.mjs';

localStatus();
const output=path.join(root,'.local','w4-synthetic');
mkdirSync(output,{recursive:true});
const files=[
 {name:'roles.sql',flags:['--role-only']},
 {name:'schema.sql',flags:[]},
 {name:'data.sql',flags:['--data-only','--use-copy','-x','storage.buckets_vectors','-x','storage.vector_indexes']}
];
const entries=[];
for(const {name,flags} of files){
 const file=path.join(output,name);
 execFileSync(cliPath(),['db','dump','--local','--workdir',localWorkdir,'-f',file,...flags],{
  cwd:root,env:localDockerEnv(),timeout:120000,windowsHide:true,stdio:['ignore','pipe','pipe']
 });
 const bytes=statSync(file).size;
 if(bytes<100)throw Error(`Incomplete synthetic ${name}`);
 entries.push({name,bytes,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
}
writeFileSync(path.join(output,'dump-manifest.json'),JSON.stringify({
 observedAt:new Date().toISOString(),sourceProject:'rdd-release-w3',scope:'fictional local data only',entries
},null,2)+'\n');
console.log('Synthetic local roles/schema/data dump complete; files ignored, hashes recorded.');
