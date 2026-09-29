// W4 real-data recovery proof from the independent protected copy into a
// fresh, dedicated local Supabase target.
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {root,dockerHost,localDockerEnv} from './local-environment.mjs';
import {decrypt,envelopeVersion,encrypt} from './w4-crypto.mjs';

const [folderArg,mode,...extra]=process.argv.slice(2);
const verifyExisting=mode==='--verify-existing';
if(extra.length||(mode&&!verifyExisting)||!folderArg)throw Error('Supply the independent W4 backup folder, optionally --verify-existing');
const folder=realpathSync(folderArg);
if(!path.isAbsolute(folder)||folder.toLowerCase().startsWith(root.toLowerCase()))
 throw Error('A protected backup folder outside the repository is required');
const manifest=JSON.parse(readFileSync(path.join(folder,'manifest.json'),'utf8'));
const bitlocker=manifest.format==='RDDW4-BITLOCKER-v1';
if(![envelopeVersion,'RDDW4-BITLOCKER-v1'].includes(manifest.format)||manifest.sourceProjectRef!=='hrqsbzmsfichiimtxijj'||
   !manifest.sourceStableDuringExport||manifest.storageObjects!==0)
 throw Error('Wrong source, format or unhandled Storage contents');
if(!bitlocker&&(!process.stdin.isTTY||!process.stdin.setRawMode))throw Error('Use an interactive private terminal for the hidden passphrase prompt');
const passphrase=bitlocker?null:await new Promise((resolve,reject)=>{
 process.stdout.write('Enter W4 recovery passphrase (hidden): ');
 const bytes=[];
 const done=error=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();
  process.stdout.write('\n');if(error)reject(error);else resolve(Buffer.from(bytes));};
 const onData=chunk=>{for(const code of chunk){
  if(code===3)return done(Error('Cancelled'));
  if(code===13||code===10)return done();
  if(code===8||code===127){bytes.pop();continue;}
  if(code<32||code>126)return done(Error('Use printable ASCII characters in the recovery passphrase'));
  bytes.push(code);
 }};
 process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('data',onData);
});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const target='rdd-release-w4-protected';
const command=(statement)=>execFileSync('docker',['--host',dockerHost,'exec','-i',`supabase_db_${target}`,
 'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-f','-'],{
 cwd:root,env:localDockerEnv(),input:statement,encoding:'utf8',timeout:60000,maxBuffer:5000000,
 windowsHide:true,stdio:['pipe','pipe','pipe']
}).trim();
const plaintext=new Map();
try{
 execFileSync(process.execPath,[path.join(root,'scripts','release-restore-local.mjs'),'status','protected'],{
  cwd:root,env:localDockerEnv(),timeout:30000,windowsHide:true,stdio:['ignore','pipe','pipe']
 });
 const targetEmpty=command("select to_regclass('public.matches') is null;")==='t'&&
   command('select count(*) from auth.users;')==='0';
 if(targetEmpty===verifyExisting)
  throw Error(verifyExisting?'No completed restore exists to verify':'The protected restore target is not empty; preserve and inspect it');
 for(const {name,encryptedSha256,encryptedBytes} of manifest.files){
  const sealed=readFileSync(path.join(folder,name));
  if(sealed.length!==encryptedBytes||sha(sealed)!==encryptedSha256)
   throw Error(`Encrypted backup checksum mismatch: ${name}`);
  plaintext.set(name,bitlocker?sealed:decrypt(sealed,passphrase));
 }
 const integrity=JSON.parse(plaintext.get(bitlocker?'integrity.json':'integrity.json.rddenc').toString('utf8'));
 if(!isDeepStrictEqual(integrity.before.tables,integrity.after.tables)||
    !isDeepStrictEqual(integrity.before.sequences,integrity.after.sequences))
  throw Error('Source changed during export; backup is not accepted');
 for(const {name,plaintextBytes,plaintextSha256} of integrity.plaintextFiles){
  const contents=plaintext.get(name);
  if(!contents||contents.length!==plaintextBytes||sha(contents)!==plaintextSha256)
   throw Error(`Plaintext integrity mismatch: ${name}`);
 }
 const emptyManagedCopyExclusions=[
  ['auth','mfa_recovery_code_sets'],['auth','mfa_recovery_codes'],
  ['auth','one_time_tokens'],['auth','scim_tokens'],['auth','scim_users'],
  ['storage','buckets']
 ];
 let restoreSeconds;
 if(!verifyExisting){
  let roles=plaintext.get(bitlocker?'roles.sql':'roles.sql.rddenc').toString('utf8');
  const platformGrant=/^GRANT SET ON PARAMETER "log_min_messages" TO "supabase_realtime_admin";\r?\n/m;
  if(platformGrant.test(roles))roles=roles.replace(platformGrant,'');
  // The local CLI image trails hosted Auth/Storage managed schema. Omit only
  // explicitly reviewed, empty COPY blocks whose target shape differs.
  let data=plaintext.get(bitlocker?'data.sql':'data.sql.rddenc').toString('utf8');
  for(const [schema,table] of emptyManagedCopyExclusions){
   const header=new RegExp(`^COPY "${schema}"\\."${table}" \\([^\\n]*\\) FROM stdin;\\r?\\n`,'m');
   const found=header.exec(data);
   if(!found)throw Error(`Expected managed COPY block missing: ${schema}.${table}`);
   const end=data.indexOf('\\.\n',found.index+found[0].length);
   if(end<0)throw Error(`Unterminated managed COPY block: ${schema}.${table}`);
   if(data.slice(found.index+found[0].length,end).trim())
    throw Error(`Managed COPY block is no longer empty: ${schema}.${table}`);
   data=data.slice(0,found.index)+data.slice(end+3);
  }
  const restore=Buffer.concat([
   Buffer.from(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;\n
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;\n
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;\n`),
   Buffer.from(roles+'\n'),plaintext.get(bitlocker?'schema.sql':'schema.sql.rddenc'),
   Buffer.from('\nSET session_replication_role = replica;\n'),Buffer.from(data),Buffer.from('\n')
  ]);
  const started=Date.now();
  try{
   execFileSync('docker',['--host',dockerHost,'exec','-i',`supabase_db_${target}`,
    'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','--single-transaction','-f','-'],{
    cwd:root,env:localDockerEnv(),input:restore,timeout:300000,maxBuffer:20000000,
    windowsHide:true,stdio:['pipe','pipe','pipe']
   });
  }catch(error){
   const diagnostic=Buffer.from(String(error.stderr??'Restore process failed'));
   writeFileSync(path.join(folder,bitlocker?'restore-error.txt':'restore-error.rddenc'),bitlocker?diagnostic:encrypt(diagnostic,passphrase));
   throw Error('Protected restore failed atomically; diagnostic saved beside the backup');
  }finally{restore.fill(0);}
  restoreSeconds=(Date.now()-started)/1000;
 }else{
  const priorFile=readFileSync(path.join(folder,bitlocker?'restore-validation.json':'restore-validation.json.rddenc'));
  const previous=JSON.parse((bitlocker?priorFile:decrypt(priorFile,passphrase)).toString('utf8'));
  restoreSeconds=previous.restoreSeconds;
 }
 const targetDigests=JSON.parse(command(readFileSync(path.join(root,'docs','release','w4-source-digests.sql'),'utf8')));
 if(!isDeepStrictEqual(targetDigests.tables,integrity.before.tables)||
    !isDeepStrictEqual(targetDigests.sequences,integrity.before.sequences))
  throw Error('Restored core row digests or sequence values differ from source snapshot');
 const targetCatalog=JSON.parse(command(readFileSync(path.join(root,'docs','release','w1-hosted-catalog-2026-09-29.sql'),'utf8')));
 const normalized=(section,value)=>{
  const copy=structuredClone(value);
  if(['schemas','relations'].includes(section))for(const item of copy??[])delete item.acl;
  if(section==='constraints')for(const item of copy??[])item.definition=item.definition?.replace(/[()\s]/g,'');
  if(section==='default_grants')copy.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if(section==='triggers')return copy.filter(item=>!['protect_bucket_control_insert',
   'protect_bucket_control_update','protect_bucket_control_update_role'].includes(item.name));
  return copy;
 };
 const sections=['postgres_version','schemas','relations','columns','constraints','indexes','policies',
  'functions','triggers','grants','column_grants','sequences','default_grants','extensions',
  'client_roles','client_role_memberships','migration_namespace_exists','migration_table_exists','counts','integrity'];
 const mismatches=sections.filter(key=>!isDeepStrictEqual(normalized(key,integrity.sourceCatalog[key]),
  normalized(key,targetCatalog[key])));
 const managedTriggerDifference=['protect_bucket_control_insert','protect_bucket_control_update',
  'protect_bucket_control_update_role'];
 for(const name of managedTriggerDifference){
  if(!integrity.sourceCatalog.triggers.some(item=>item.name===name&&item.schema==='storage')||
     targetCatalog.triggers.some(item=>item.name===name))mismatches.push(`managed_trigger_exception:${name}`);
 }
 const targetAccess=JSON.parse(command(readFileSync(path.join(root,'docs','release','w4-effective-access.sql'),'utf8')));
 if(!isDeepStrictEqual(targetAccess,integrity.sourceEffectiveAccess))mismatches.push('effective_client_privileges');
 const links=JSON.parse(command(`select jsonb_build_object(
  'profiles_without_auth',(select count(*) from public.profiles p left join auth.users u on u.id=p.id where u.id is null),
  'matches_without_creator',(select count(*) from public.matches m left join public.profiles p on p.id=m.created_by where p.id is null),
  'participants_without_profile',(select count(*) from public.match_players mp left join public.profiles p on p.id=mp.player_id where p.id is null)
 )::text;`));
 if(Object.values(links).some(value=>value!==0))mismatches.push('auth_profile_match_relationships');
 const result={observedAt:new Date().toISOString(),restoreSeconds,sourceProjectRef:manifest.sourceProjectRef,
  targetProject:target,sourceStableDuringExport:true,coreRowAndSequenceDigestsMatched:true,
  catalogSectionsCompared:sections.length,catalogMismatches:mismatches,relationships:links,
  countSummary:manifest.counts,emptyManagedCopyExclusions:emptyManagedCopyExclusions.map(item=>item.join('.')),
  managedTriggerDifference,
  scope:'protected local restore; no hosted changes or outbound delivery'};
 const validation=Buffer.from(JSON.stringify(result));
 writeFileSync(path.join(folder,bitlocker?'restore-validation.json':'restore-validation.json.rddenc'),bitlocker?validation:encrypt(validation,passphrase));
 if(mismatches.length)throw Error('Protected restore has catalog/relationship differences; validation saved');
 console.log('W4 independent-copy restore passed core row/sequence, catalog, effective-access and relationship checks.');
 console.log(`Restore seconds: ${restoreSeconds.toFixed(1)}`);
}finally{for(const value of plaintext.values())value.fill(0);passphrase?.fill(0);}
