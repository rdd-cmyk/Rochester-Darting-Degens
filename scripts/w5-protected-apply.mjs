// Apply exactly one reviewed W5 migration to the fixed loopback restore.
// The CLI workdir is ignored; no hosted project ref or linked target is used.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root,cliPath,localDockerEnv,dockerHost} from './local-environment.mjs';

const [arg,...extra]=process.argv.slice(2);
const number=Number(arg);
if(extra.length||!Number.isInteger(number)||number<1||number>11)
 throw Error('Supply exactly one W5 release step 1..11');
const workdir=path.join(root,'.local','release-w5-protected');
const manifest=JSON.parse(readFileSync(path.join(workdir,'manifest.json'),'utf8'));
if(manifest.targetProjectId!=='rdd-release-w4-protected'||
 manifest.localDbUrl!=='postgresql://postgres:postgres@127.0.0.1:58922/postgres')
 throw Error('W5 local target guard failed');
const step=manifest.steps[number-1];
const migration=path.join(workdir,'supabase','migrations',step.name);
if(!existsSync(migration)||createHash('sha256').update(readFileSync(migration)).digest('hex')!==step.sha256)
 throw Error('Expected reviewed W5 migration is missing or changed');
const evidence=path.join(workdir,`apply-${number}.json`);
if(existsSync(evidence))throw Error('Application evidence already exists; preserve it');
const history=()=>execFileSync('docker',['--host',dockerHost,'exec',
 'supabase_db_rdd-release-w4-protected','psql','-X','-U','postgres','-d','postgres',
 '-Atc','select max(version) from supabase_migrations.schema_migrations;'],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']}).trim();
const expected=number===1?manifest.baseline.version:manifest.steps[number-2].version;
if(history()!==expected)throw Error('W5 history is not at expected previous version');
const cli=(dry)=>{
 const output=execFileSync(cliPath(),['db','push',...(dry?['--dry-run']:['--yes']),
  '--skip-vault','--db-url',manifest.localDbUrl,'--workdir',workdir],{
  cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:300000,
  maxBuffer:10*1024*1024,windowsHide:true,stdio:['ignore','pipe','pipe']
 });
 const json=output.split(/\r?\n/).find(line=>line.startsWith('{"upToDate"'));
 if(!json)throw Error('Unrecognized Supabase CLI migration result');
 return JSON.parse(json);
};
const dry=cli(true);
if(!dry.dryRun||dry.migrations?.length!==1||dry.migrations[0]!==step.name)
 throw Error('W5 dry run contains unexpected migrations');
const started=Date.now();
const applied=cli(false);
const milliseconds=Date.now()-started;
if(applied.dryRun||applied.migrations?.length!==1||applied.migrations[0]!==step.name||
   history()!==step.version)throw Error('W5 migration history did not advance exactly once');
const after=cli(true);
if(!after.upToDate||after.migrations?.length)throw Error('W5 migration remains pending after application');
const fictionalData=existsSync(path.join(workdir,'fictional-accounts.json'));
const comparison=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts','qa','w4-all-copy-digests.mjs'),
 'D:\\DB BackupsHD\\RDD-Main-W4-2026-09-29T18-20-24-081Z',
 ...(fictionalData?['--allow-new-rows']:[])],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:60000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
 }));
if(!comparison.allMatched||comparison.totalRows!==677||(!fictionalData&&comparison.newRows!==0))
 throw Error('Original W4 rows changed after W5 migration');
writeFileSync(evidence,JSON.stringify({step:number,version:step.version,source:step.source,
 sha256:step.sha256,dryRunListedOnlyExpected:true,historyAdvancedExactlyOnce:true,
 repeatDryRunUpToDate:true,allOriginalRowsMatched:true,originalRows:comparison.totalRows,
 newFictionalRows:comparison.newRows,
 milliseconds,observedAtUtc:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
console.log(`W5 step ${number} applied locally in ${milliseconds} ms; history and all 677 original rows verified.`);
