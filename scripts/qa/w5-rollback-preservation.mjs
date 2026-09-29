// Snapshot/verify every existing application row across a compatible-app
// rollback. Hashes only are kept in the ignored protected workdir.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root,dockerHost,localDockerEnv} from '../local-environment.mjs';

const [phase,...extra]=process.argv.slice(2);
if(extra.length||!['before','after'].includes(phase))throw Error('Use before or after');
const workdir=path.join(root,'.local','release-w5-protected');
const snapshotPath=path.join(workdir,'rollback-before.json');
const evidencePath=path.join(workdir,'rollback-preservation.json');
const dump=execFileSync('docker',['--host',dockerHost,'exec',
 'supabase_db_rdd-release-w4-protected','pg_dump','-U','postgres','-d','postgres',
 '--data-only','--schema=public','--schema=rdd_private','--schema=invite_private',
 '--schema=rivalry_private'],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:60000,
 maxBuffer:20*1024*1024,windowsHide:true,stdio:['ignore','pipe','pipe']
});
const lines=dump.split(/\r?\n/);
const tables={};
for(let i=0;i<lines.length;i++){
 const match=/^COPY ([^ ]+) \(.*\) FROM stdin;$/.exec(lines[i]);
 if(!match)continue;
 const name=match[1];
 const hashes=[];
 while(++i<lines.length&&lines[i]!=='\\.')
  hashes.push(createHash('sha256').update(name+'\n'+lines[i]).digest('hex'));
 if(i===lines.length)throw Error(`Unterminated protected COPY block: ${name}`);
 tables[name]=hashes.sort();
}
if(phase==='before'){
 if(existsSync(snapshotPath))throw Error('W5 rollback snapshot already exists');
 writeFileSync(snapshotPath,JSON.stringify({observedAtUtc:new Date().toISOString(),tables},null,2)+'\n',{flag:'wx'});
 console.log(`W5 pre-rollback snapshot retained hashes for ${Object.keys(tables).length} application tables.`);
}else{
 if(existsSync(evidencePath))throw Error('W5 rollback preservation evidence already exists');
 const before=JSON.parse(readFileSync(snapshotPath,'utf8')).tables;
 const failures=[];
 let preserved=0,newRows=0;
 for(const [table,hashes] of Object.entries(before)){
  const available=new Map();
  for(const hash of tables[table]??[])available.set(hash,(available.get(hash)??0)+1);
  for(const hash of hashes){
   const count=available.get(hash)??0;
   if(!count)failures.push(table);
   else {available.set(hash,count-1);preserved++;}
  }
  newRows+=(tables[table]?.length??0)-hashes.length;
 }
 const result={observedAtUtc:new Date().toISOString(),tables:Object.keys(before).length,
  preservedRows:preserved,newRows,failures:[...new Set(failures)],allPreserved:failures.length===0};
 writeFileSync(evidencePath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 if(failures.length)throw Error('W5 rollback changed or lost existing application rows');
 console.log(`W5 compatible rollback preserved ${preserved} prior application rows across ${result.tables} tables; ${newRows} new rows added.`);
}
