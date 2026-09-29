// Build ignored, local-only migration inputs for the W5 protected rehearsal.
// This never links to, queries, or changes a hosted project.
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root} from './local-environment.mjs';
import {releaseFiles} from './release-environment.mjs';

const [backupArg,...extra]=process.argv.slice(2);
if(extra.length||!backupArg)throw Error('Supply the protected W4 backup folder');
const backup=realpathSync(backupArg);
if(!path.isAbsolute(backup)||backup.toLowerCase().startsWith(root.toLowerCase()))
 throw Error('W5 source must be the protected W4 backup outside Git');
const manifest=JSON.parse(readFileSync(path.join(backup,'manifest.json'),'utf8'));
if(manifest.format!=='RDDW4-BITLOCKER-v1'||manifest.sourceProjectRef!=='hrqsbzmsfichiimtxijj'||
   !manifest.sourceStableDuringExport)throw Error('Unexpected W4 backup identity');
const workdir=path.join(root,'.local','release-w5-protected');
const migrations=path.join(workdir,'supabase','migrations');
if(existsSync(path.join(workdir,'manifest.json'))||existsSync(migrations))
 throw Error('W5 workdir already prepared; preserve and inspect it instead of overwriting');
mkdirSync(migrations,{recursive:true});
writeFileSync(path.join(workdir,'supabase','config.toml'),
 readFileSync(path.join(root,'.local','release-w4-protected','supabase','config.toml')),{flag:'wx'});
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const baseline=readFileSync(path.join(backup,'schema.sql'));
const baselineVersion='20260929000000';
const baselineName=`${baselineVersion}_restored_legacy_baseline.sql`;
writeFileSync(path.join(migrations,baselineName),baseline,{flag:'wx'});
const steps=releaseFiles.map((file,index)=>{
 const source=readFileSync(path.join(root,file));
 const version=String(Number(baselineVersion)+index+1);
 const name=`${version}_${path.basename(file)}`;
 writeFileSync(path.join(migrations,name),source,{flag:'wx'});
 return {version,name,source:file,sha256:sha(source),canonicalLfSha256:sha(Buffer.from(source.toString('utf8').replace(/\r\n/g,'\n')))};
});
const result={scope:'W5 local protected restore only; never push these migrations to hosting',
 sourceProjectRef:manifest.sourceProjectRef,targetProjectId:'rdd-release-w4-protected',
 localDbUrl:'postgresql://postgres:postgres@127.0.0.1:58922/postgres',
 baseline:{version:baselineVersion,name:baselineName,sha256:sha(baseline)},steps,
 requiredOrder:releaseFiles,preparedAtUtc:new Date().toISOString()};
writeFileSync(path.join(workdir,'manifest.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(`Prepared W5 local-only baseline plus ${steps.length} ordered migration files; no database changed.`);
