// Prepare an ignored, test-project-only migration workdir. No hosted changes.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root} from './local-environment.mjs';
import {releaseFiles} from './release-environment.mjs';

const dir=path.join(root,'.local','release-w6-testing');
const migrations=path.join(dir,'supabase','migrations');
if(existsSync(dir))throw Error('W6 test workdir already exists; preserve it');
const w5=JSON.parse(readFileSync(path.join(root,'.local','release-w5-protected','manifest.json'),'utf8'));
if(w5.targetProjectId!=='rdd-release-w4-protected'||w5.steps.length!==11)
 throw Error('W5 reviewed manifest is missing or unexpected');
mkdirSync(migrations,{recursive:true});
writeFileSync(path.join(dir,'supabase','config.toml'),
 'project_id = "rdd-release-w6-testing"\n',{flag:'wx'});
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const baselineFile='supabase/tests/fixtures/existing_schema_baseline.sql';
const baseline=readFileSync(path.join(root,baselineFile));
const baselineName='20260929000000_existing_schema_baseline.sql';
writeFileSync(path.join(migrations,baselineName),baseline,{flag:'wx'});
const steps=releaseFiles.map((source,index)=>{
 const content=readFileSync(path.join(root,source));
 const expected=w5.steps[index];
 const canonical=hash(Buffer.from(content.toString('utf8').replace(/\r\n/g,'\n')));
 if(expected.source!==source||expected.canonicalLfSha256!==canonical)
  throw Error(`W6 source drift from W5 at step ${index+1}`);
 const name=expected.name;
 writeFileSync(path.join(migrations,name),content,{flag:'wx'});
 return {source,name,sha256:hash(content),canonicalLfSha256:canonical};
});
writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({
 scope:'W6 RDD Release Testing only; not production',
 projectRef:'uepayhdrgzrxhkqbwebo',
 baseline:{source:baselineFile,name:baselineName,sha256:hash(baseline)},
 steps,preparedAtUtc:new Date().toISOString()
},null,2)+'\n',{flag:'wx'});
console.log('Prepared W6 ignored test-only baseline and 11 exact W5 release inputs; no database changed.');
