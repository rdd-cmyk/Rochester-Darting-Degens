// Production W4 logical export to two owner-confirmed BitLocker drives, or
// optional file-level encrypted archives. Never place the output in Git.
import {realpathSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {root,cliPath,localDockerEnv} from './local-environment.mjs';
import {encrypt,decrypt,envelopeVersion} from './w4-crypto.mjs';

const ref='hrqsbzmsfichiimtxijj';
const [primaryArg,secondaryArg,...extra]=process.argv.slice(2);
const bitlocker=extra.length===1&&extra[0]==='--bitlocker';
if((extra.length&&!bitlocker)||!primaryArg||!secondaryArg)throw Error('Supply two protected backup directories, optionally --bitlocker');
const canonical=value=>{
 const resolved=realpathSync(value);
 if(!path.isAbsolute(resolved)||resolved.toLowerCase().startsWith(root.toLowerCase()))
  throw Error('Backup destinations must exist outside the repository');
 return resolved;
};
const primary=canonical(primaryArg),secondary=canonical(secondaryArg);
if(primary.toLowerCase()===secondary.toLowerCase()||
   path.parse(primary).root.toLowerCase()===path.parse(secondary).root.toLowerCase())
 throw Error('The independent copy must use a different filesystem root');
if(!bitlocker&&(!process.stdin.isTTY||!process.stdin.setRawMode))throw Error('Run in an interactive private terminal for a hidden passphrase prompt');
function secret(label){
 return new Promise((resolve,reject)=>{
  process.stdout.write(label);
  const characters=[];
  const finish=(error)=>{
   process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();
   process.stdout.write('\n');
   if(error)reject(error);else resolve(Buffer.from(characters));
  };
  const onData=chunk=>{
   for(const code of chunk){
    if(code===3)return finish(Error('Cancelled'));
    if(code===13||code===10)return finish();
    if(code===8||code===127){characters.pop();continue;}
    if(code<32||code>126)return finish(Error('Use printable ASCII characters in the recovery passphrase'));
    characters.push(code);
   }
  };
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('data',onData);
 });
}
let passphrase;
if(!bitlocker){
 passphrase=await secret('Enter 24+ character W4 recovery passphrase (hidden): ');
 const confirmation=await secret('Repeat recovery passphrase (hidden): ');
 if(passphrase.length<24||passphrase.length!==confirmation.length||!timingSafeEqual(passphrase,confirmation)){
  passphrase.fill(0);confirmation.fill(0);throw Error('Recovery passphrase is too short or does not match');
 }
 confirmation.fill(0);
}
const env=localDockerEnv();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function cli(args,limit=20*1024*1024){
 try{return execFileSync(cliPath(),args,{
  cwd:root,env,encoding:null,timeout:180000,maxBuffer:limit,windowsHide:true,
  stdio:['ignore','pipe','pipe']
 });}
 catch{throw Error('Supabase command failed; no connection strings or raw error output printed');}
}
function inspect(file,field){
 const response=JSON.parse(cli(['db','query','--linked','--project-ref',ref,
  '--file',path.join(root,file),'-o','json']).toString('utf8'));
 if(response.rows?.length!==1||!response.rows[0][field])throw Error('Unexpected read-only source inventory result');
 return response.rows[0][field];
}
const started=Date.now();
const before=inspect('docs/release/w4-source-digests.sql','w4_digests');
const inventoryBefore=inspect('docs/release/w4-hosted-inventory.sql','w4_inventory');
const sourceCatalog=inspect('docs/release/w1-hosted-catalog-2026-09-29.sql','w1_catalog');
const sourceEffectiveAccess=inspect('docs/release/w4-effective-access.sql','w4_effective_access');
if(inventoryBefore.database!=='postgres'||inventoryBefore.counts?.auth_users===undefined||
   inventoryBefore.counts?.storage_objects>0)throw Error('Unexpected source identity or Storage objects; review separate object backup first');
const folder=`RDD-Main-W4-${new Date().toISOString().replace(/[:.]/g,'-')}`;
const primaryDir=path.join(primary,folder),secondaryDir=path.join(secondary,folder);
mkdirSync(primaryDir,{recursive:false});
const files=[];
try{
 for(const step of [
  {name:'roles.sql',flags:['--role-only']},
  {name:'schema.sql',flags:[]},
  {name:'data.sql',flags:['--data-only','--use-copy','-x','storage.buckets_vectors','-x','storage.vector_indexes']}
 ]){
  const plaintext=cli(['db','dump','--project-ref',ref,...step.flags],256*1024*1024);
  if(plaintext.length<100||!plaintext.includes(Buffer.from('SET ')))throw Error(`Incomplete ${step.name} dump`);
  const sealed=bitlocker?plaintext:encrypt(plaintext,passphrase);
  const archiveName=bitlocker?step.name:step.name+'.rddenc';
  writeFileSync(path.join(primaryDir,archiveName),sealed,{flag:'wx',mode:0o600});
  if(!(bitlocker?readFileSync(path.join(primaryDir,archiveName)):decrypt(sealed,passphrase)).equals(plaintext))throw Error(`Unreadable ${step.name} archive`);
  files.push({name:archiveName,encryptedBytes:sealed.length,encryptedSha256:sha(sealed),
   plaintextBytes:plaintext.length,plaintextSha256:sha(plaintext)});
  plaintext.fill(0);
  console.log(`${bitlocker?'BitLocker-protected':'Encrypted'} and verified ${step.name}.`);
 }
 const after=inspect('docs/release/w4-source-digests.sql','w4_digests');
 const inventoryAfter=inspect('docs/release/w4-hosted-inventory.sql','w4_inventory');
 const stable=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
 if(!stable(before.tables,after.tables)||!stable(before.sequences,after.sequences))
  throw Error('Source rows changed during export; this backup must not be accepted as the W4 snapshot');
 for(const field of ['counts','schemas','relations','extensions','custom_trigger_count','policy_count',
  'default_acl_count','migration_history_exists','cron_job_table_exists','net_queue_table_exists'])
  if(!stable(inventoryBefore[field],inventoryAfter[field]))throw Error(`Source ${field} changed during export`);
 const integrity=Buffer.from(JSON.stringify({before,after,inventoryBefore,inventoryAfter,
  sourceCatalog,sourceEffectiveAccess,plaintextFiles:files.map(({name,plaintextBytes,plaintextSha256})=>
   ({name,plaintextBytes,plaintextSha256}))}), 'utf8');
 const integritySealed=bitlocker?integrity:encrypt(integrity,passphrase);
 const integrityName=bitlocker?'integrity.json':'integrity.json.rddenc';
 writeFileSync(path.join(primaryDir,integrityName),integritySealed,{flag:'wx',mode:0o600});
 files.push({name:integrityName,encryptedBytes:integritySealed.length,
  encryptedSha256:sha(integritySealed),plaintextBytes:integrity.length,plaintextSha256:sha(integrity)});
 integrity.fill(0);
 const manifest={format:bitlocker?'RDDW4-BITLOCKER-v1':envelopeVersion,sourceProjectRef:ref,sourceDatabase:'postgres',
  capturedAtUtc:new Date().toISOString(),durationSeconds:Math.round((Date.now()-started)/1000),
  counts:inventoryAfter.counts,sourceStableDuringExport:true,
  storageObjects:inventoryAfter.counts.storage_objects,
  files:files.map(({name,encryptedBytes,encryptedSha256})=>({name,encryptedBytes,encryptedSha256})),
  plaintextHashes:bitlocker?'BitLocker-protected integrity evidence':'encrypted integrity evidence only',
  note:bitlocker?'Owner confirms both drives use BitLocker; SQL is plaintext after unlock. Separate final cutover backup remains required.':'No plaintext SQL or recovery passphrase stored; separate final cutover backup remains required.'};
 writeFileSync(path.join(primaryDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 if(!bitlocker)copyFileSync(path.join(root,'scripts','w4-crypto.mjs'),path.join(primaryDir,'w4-crypto.mjs'));
 mkdirSync(secondaryDir,{recursive:false});
 for(const file of [...manifest.files.map(entry=>entry.name),'manifest.json',...(!bitlocker?['w4-crypto.mjs']:[])]){
  copyFileSync(path.join(primaryDir,file),path.join(secondaryDir,file));
  if(sha(readFileSync(path.join(primaryDir,file)))!==sha(readFileSync(path.join(secondaryDir,file))))
   throw Error('Independent copy checksum differs');
 }
 if(statSync(path.join(secondaryDir,bitlocker?'data.sql':'data.sql.rddenc')).size<100)throw Error('Independent data copy is empty');
 console.log('W4 backup and independent copy verified.');
 console.log(`Backup folder: ${folder}`);
}finally{passphrase?.fill(0);}
