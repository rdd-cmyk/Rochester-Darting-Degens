import { canonicalDeferredSqlSource } from './deferred-sql-source.mjs';
// Deliberately abort one not-yet-applied W5 input before COMMIT, proving the
// protected local database remains unchanged. No raw dump or row data is logged.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root,dockerHost,localDockerEnv} from './local-environment.mjs';

const [arg,...extra]=process.argv.slice(2);
const number=Number(arg);
if(extra.length||!Number.isInteger(number)||number<1||number>11)
 throw Error('Supply a pending W5 release step 1..11');
const workdir=path.join(root,'.local','release-w5-protected');
const manifest=JSON.parse(readFileSync(path.join(workdir,'manifest.json'),'utf8'));
if(manifest.targetProjectId!=='rdd-release-w4-protected')throw Error('Wrong W5 target');
const step=manifest.steps[number-1];
const source=readFileSync(path.join(root,canonicalDeferredSqlSource(step.source)));
if(createHash('sha256').update(source).digest('hex')!==step.sha256)
 throw Error('W5 SQL changed since manifest preparation');
const text=source.toString('utf8');
if([...text.matchAll(/^\s*commit\s*;/gim)].length!==1)throw Error('Expected exactly one COMMIT');
const interrupted=text.replace(/^\s*commit\s*;/im,'SELECT 1/0;\nCOMMIT;');
const container='supabase_db_rdd-release-w4-protected';
const run=(args,options={})=>execFileSync('docker',['--host',dockerHost,'exec','-i',container,...args],{
 cwd:root,env:localDockerEnv(),timeout:60000,maxBuffer:20*1024*1024,
 windowsHide:true,stdio:['pipe','pipe','pipe'],...options
});
const snapshot=()=>createHash('sha256').update(run(['pg_dump','-U','postgres','-d','postgres',
 '--schema=public','--schema=rdd_private','--schema=invite_private','--schema=rivalry_private'])
 .toString('utf8').replace(/^\\(?:un)?restrict .*$/gm,'')).digest('hex');
const history=()=>run(['psql','-X','-U','postgres','-d','postgres','-Atc',
 'select max(version) from supabase_migrations.schema_migrations;']).toString('utf8').trim();
const expected=number===1?manifest.baseline.version:manifest.steps[number-2].version;
if(history()!==expected)throw Error('The local migration history is not at the expected prior step');
const evidence=path.join(workdir,`interruption-${number}.json`);
if(existsSync(evidence))throw Error('Interruption evidence already exists; preserve it');
const before=snapshot();
let failed=false;
try{run(['psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-f','-'],
 {input:interrupted});}catch{failed=true;}
const after=snapshot();
if(!failed||before!==after||history()!==expected)
 throw Error('Interrupted W5 input changed schema, data or migration history');
writeFileSync(evidence,JSON.stringify({step:number,version:step.version,source:step.source,
 sha256:step.sha256,transactionRolledBack:true,originalSchemaAndDataUnchanged:true,
 historyUnchanged:true,observedAtUtc:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
console.log(`W5 step ${number} aborted before COMMIT and left schema, data and history unchanged.`);
