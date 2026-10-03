// Expose only a reviewed prefix of the W5 local migration chain to db push.
import {readFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root} from './local-environment.mjs';

const [number,...extra]=process.argv.slice(2);
const count=Number(number);
if(extra.length||!Number.isInteger(count)||count<0||count>11)throw Error('Supply reviewed release step count 0..11');
const workdir=path.join(root,'.local','release-w5-protected');
const manifest=JSON.parse(readFileSync(path.join(workdir,'manifest.json'),'utf8'));
if(manifest.targetProjectId!=='rdd-release-w4-protected'||manifest.steps.length!==11)
 throw Error('Unexpected local W5 manifest');
const migrations=path.join(workdir,'supabase','migrations');
const held=path.join(workdir,'held');
mkdirSync(held,{recursive:true});
for(const [index,step] of manifest.steps.entries()){
 const current=path.join(migrations,step.name),parked=path.join(held,step.name);
 if(existsSync(current)===existsSync(parked))throw Error(`Missing or duplicated W5 step: ${step.name}`);
 const source=existsSync(current)?current:parked;
 if(createHash('sha256').update(readFileSync(source)).digest('hex')!==step.sha256)
  throw Error(`W5 SQL hash changed: ${step.name}`);
 const destination=index<count?current:parked;
 if(source!==destination)renameSync(source,destination);
}
console.log(`W5 local migration stage: ${count} release inputs visible, ${11-count} held; baseline retained.`);
