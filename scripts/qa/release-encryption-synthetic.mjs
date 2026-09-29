// File-level backup encryption proof using only fictional W3 dump files.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {root,cliPath,localDockerEnv} from '../local-environment.mjs';
import {encrypt,decrypt} from '../w4-crypto.mjs';

const base=path.join(root,'.local','w4-synthetic');
const output=path.join(base,'encrypted-proof');
mkdirSync(output,{recursive:true});
const streamed=execFileSync(cliPath(),['db','dump','--local','--workdir',path.join(root,'.local','release-w3'),'--role-only'],{
 cwd:root,env:localDockerEnv(),timeout:30000,maxBuffer:1000000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
});
if(!streamed.includes(Buffer.from('ALTER ROLE'))||streamed.length<100)
 throw Error('CLI dump stdout was not SQL; in-memory encryption path is unsafe');
const password=randomBytes(48);
const entries=[];
for(const name of ['roles.sql','schema.sql','data.sql']){
 const source=readFileSync(path.join(base,name));
 const sealed=encrypt(source,password);
 writeFileSync(path.join(output,name+'.rddenc'),sealed);
 const reopened=decrypt(readFileSync(path.join(output,name+'.rddenc')),password);
 if(!reopened.equals(source))throw Error(`Synthetic ${name} encryption round trip failed`);
 entries.push({name,sourceBytes:source.length,encryptedBytes:sealed.length,
  sha256:createHash('sha256').update(sealed).digest('hex')});
 reopened.fill(0);source.fill(0);
}
password.fill(0);
writeFileSync(path.join(output,'result.json'),JSON.stringify({
 observedAt:new Date().toISOString(),scope:'fictional local backup only',entries
},null,2)+'\n');
console.log('Synthetic roles/schema/data archives all encrypted, reopened and byte-matched.');
