// Verify every original COPY row against the isolated restored database.
// Protected row values are processed in memory and never printed or saved.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root,dockerHost,localDockerEnv} from '../local-environment.mjs';

const folder=process.argv[2];
if(!folder||process.argv.length!==3)throw Error('Supply independent W4 backup folder');
const lines=readFileSync(path.join(folder,'data.sql'),'utf8').split(/\r?\n/);
const excludedEmpty=new Set(['auth.mfa_recovery_code_sets','auth.mfa_recovery_codes',
 'auth.one_time_tokens','auth.scim_tokens','auth.scim_users','storage.buckets']);
const digest=rows=>createHash('sha256').update(rows.sort().join('\n'),'utf8').digest('hex');
const results=[];
for(let i=0;i<lines.length;i++){
 const match=/^COPY "([^"]+)"\."([^"]+)" \((.*)\) FROM stdin;$/.exec(lines[i]);
 if(!match)continue;
 const table=`${match[1]}.${match[2]}`;
 const rows=[];
 while(++i<lines.length&&lines[i]!=='\\.')rows.push(lines[i]);
 if(i===lines.length)throw Error(`Unterminated COPY block: ${table}`);
 if(excludedEmpty.has(table)){
  if(rows.length)throw Error(`Excluded managed table gained rows: ${table}`);
  results.push({table,rows:0,status:'empty managed shape exception'});
  continue;
 }
 const statement=`COPY (SELECT ${match[3]} FROM "${match[1]}"."${match[2]}") TO STDOUT;\n`;
 let targetRows;
 try{
  const raw=execFileSync('docker',['--host',dockerHost,'exec','-i',
   'supabase_db_rdd-release-w4-protected','psql','-X','-U','postgres','-d','postgres',
   '-v','ON_ERROR_STOP=1','-At','-f','-'],{
   cwd:root,env:localDockerEnv(),input:statement,encoding:'utf8',timeout:30000,
   maxBuffer:20*1024*1024,windowsHide:true,stdio:['pipe','pipe','pipe']
  });
  targetRows=raw?raw.replace(/\r?\n$/,'').split(/\r?\n/):[];
 }catch{throw Error(`Could not read restored COPY rows: ${table}`);}
 results.push({table,rows:rows.length,status:rows.length===targetRows.length&&
  digest(rows)===digest(targetRows)?'matched':'MISMATCH'});
}
const failures=results.filter(item=>item.status==='MISMATCH');
console.log(JSON.stringify({blocks:results.length,nonempty:results.filter(item=>item.rows>0).length,
 totalRows:results.reduce((sum,item)=>sum+item.rows,0),emptyManagedExceptions:[...excludedEmpty],
 failures,allMatched:failures.length===0},null,2));
if(failures.length)process.exitCode=1;
