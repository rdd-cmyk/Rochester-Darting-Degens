// Create a fictional canonical Rivalry link with the current app artifact,
// then confirm its rows and read contract survive the compatible app switch.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {root,cliPath,localDockerEnv,dockerHost} from '../local-environment.mjs';

const [phase,...extra]=process.argv.slice(2);
if(extra.length||!['before','after'].includes(phase))throw Error('Use before or after');
const dir=path.join(root,'.local','release-w5-protected');
const evidencePath=path.join(dir,'rivalry-continuity.json');
if(phase==='before'&&existsSync(evidencePath))throw Error('Rivalry continuity evidence already exists');
const fixture=JSON.parse(readFileSync(path.join(dir,'fictional-accounts.json'),'utf8'));
assert.equal(fixture.scope,'fictional local W5 only');
const status=JSON.parse(execFileSync(cliPath(),['status','-o','json','--workdir',
 path.join(root,'.local','release-w4-protected')],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
}));
assert.equal(new URL(status.API_URL).origin,'http://127.0.0.1:58921');
const client=()=>createClient(status.API_URL,status.ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false}});
const a=client(),b=client();
const unwrap=result=>{if(result.error)throw Error(`${result.error.code}: ${result.error.message}`);return result.data;};
unwrap(await a.auth.signInWithPassword({email:fixture.people[0].email,password:fixture.password}));
unwrap(await b.auth.signInWithPassword({email:fixture.people[1].email,password:fixture.password}));
const sql=statement=>execFileSync('docker',['--host',dockerHost,'exec','-i',
 'supabase_db_rdd-release-w4-protected','psql','-X','-U','postgres','-d','postgres',
 '-v','ON_ERROR_STOP=1','-At','-c',statement],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']}).trim();
const digest=()=>{
 const dump=execFileSync('docker',['--host',dockerHost,'exec',
  'supabase_db_rdd-release-w4-protected','pg_dump','-U','postgres','-d','postgres',
  '--data-only','--schema=rivalry_private'],{
  cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:60000,maxBuffer:10*1024*1024,
  windowsHide:true,stdio:['ignore','pipe','pipe']});
 const rows=[];let table=null;
 for(const line of dump.split(/\r?\n/)){
  const match=/^COPY ([^ ]+) \(.*\) FROM stdin;$/.exec(line);
  if(match){table=match[1];continue;}
  if(line==='\\.'){table=null;continue;}
  if(table)rows.push(createHash('sha256').update(table+'\n'+line).digest('hex'));
 }
 return {count:rows.length,sha256:createHash('sha256').update(rows.sort().join('\n')).digest('hex')};
};
if(phase==='before'){
 const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 const night=unwrap(await a.rpc('rdd_create_night',{p_id:randomUUID(),
  p_title:'W5 Fictional Rivalry Night',p_venue:'Fictional Venue',p_date:date}));
 sql(`INSERT INTO rdd_private.planning_schedules(night_id,starts_at,rsvp_closes_at) VALUES('${night.id}',now()+interval '2 days',now()+interval '1 day')`);
 const create={action:'create',submitted_by:fixture.people[0].id,id:randomUUID(),
  recipient:fixture.people[1].id,night_id:night.id,game:'501',
  preset:'501-double-v1',board:'Steel Tip',best_of:3};
 const challenge0=unwrap(await a.rpc('rdd_rivalry_write',{
  p_operation_id:randomUUID(),p_payload:create})).challenge;
 const challenge=unwrap(await b.rpc('rdd_rivalry_write',{
  p_operation_id:randomUUID(),p_payload:{action:'accept',submitted_by:fixture.people[1].id,
   id:challenge0.id,expected_revision:challenge0.revision,
   event_revision:challenge0.schedule.event_revision}})).challenge;
 assert.equal(challenge.state,'accepted');
 const payload={submitted_by:fixture.people[0].id,challenge_id:challenge.id,
  challenge_revision:challenge.revision,match_id:null,expected_revision:null,
  night_id:night.id,game_type:'501',board_type:'Steel Tip',venue:'Fictional Venue',
  notes:null,played_at:new Date().toISOString(),allow_duplicate:true,
  game_config:{version:1,preset:'501-double-v1',format:'individual',context:'competitive',
   status:'completed',handicap:false,sides:{},teamScores:{},otherName:'',finish:'ordinary'},
  players:[fixture.people[0].id,fixture.people[1].id].map((player_id,i)=>({
   player_id,score:null,points_scored:null,is_winner:i===0}))};
 let saved;
 try{
  sql('update rdd_private.game_modes_control set enabled=true');
  const op=randomUUID();
  saved=unwrap(await a.rpc('rdd_save_match',{p_operation_id:op,p_payload:payload}));
  assert.equal(unwrap(await a.rpc('rdd_save_match',{
   p_operation_id:op,p_payload:payload})).replayed,true);
 }finally{sql('update rdd_private.game_modes_control set enabled=false');}
 assert.equal(saved.challenge.state,'in_progress');
 const counts=sql(`SELECT (SELECT count(*) FROM rivalry_private.links WHERE challenge_id='${challenge.id}'),(SELECT count(*) FROM rivalry_private.operations WHERE actor='${fixture.people[0].id}')`);
 assert.equal(Number(counts.split('|')[0]),1);
 const snapshot=digest();
 writeFileSync(evidencePath,JSON.stringify({scope:'fictional local W5 only',
  createdAtUtc:new Date().toISOString(),nightId:night.id,challengeId:challenge.id,
  matchId:saved.match_id,privateRowsBefore:snapshot,
  linkCreated:true,matchRetry:true},null,2)+'\n',{flag:'wx'});
 console.log('W5 fictional Rivalry challenge, canonical link, receipt and exact match retry created on current app.');
}else{
 const evidence=JSON.parse(readFileSync(evidencePath,'utf8'));
 assert.equal(evidence.scope,'fictional local W5 only');
 const rows=unwrap(await a.rpc('rdd_rivalry_read',{
  p_id:evidence.challengeId,p_offset:0})).challenges;
 assert.equal(rows.length,1);
 assert.equal(rows[0].state,'in_progress');
 assert.equal(unwrap(await a.from('matches').select('id').eq('id',evidence.matchId)).length,1);
 const snapshot=digest();
 assert.deepEqual(snapshot,evidence.privateRowsBefore);
 evidence.verifiedAfterRollbackAtUtc=new Date().toISOString();
 evidence.privateRowsAfter=snapshot;
 evidence.canonicalLinkAndReceiptPreserved=true;
 writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');
 console.log(`W5 compatible app retained all ${snapshot.count} Rivalry private rows, canonical link and match.`);
}
