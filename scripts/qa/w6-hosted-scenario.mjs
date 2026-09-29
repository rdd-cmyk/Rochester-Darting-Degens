// Seed a small, clearly fictional W6 preview walkthrough on RDD Release Testing.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {root,cliPath,localDockerEnv} from '../local-environment.mjs';

const dir=path.join(root,'.local','release-w6-testing');
const outputPath=path.join(dir,'hosted-scenario.json');
if(existsSync(outputPath))throw Error('W6 hosted scenario already exists');
const fixture=JSON.parse(readFileSync(path.join(dir,'fictional-hosted.json'),'utf8'));
assert.equal(fixture.projectRef,'uepayhdrgzrxhkqbwebo');
const cli=args=>{
 try{return execFileSync(cliPath(),args,{cwd:root,env:localDockerEnv(),
  encoding:'utf8',timeout:30000,windowsHide:true,stdio:['ignore','pipe','pipe']});}
 catch{throw Error('Isolated W6 CLI action failed');}
};
const keys=JSON.parse(cli(['projects','api-keys','--project-ref',fixture.projectRef,
 '--reveal','-o','json']));
const anon=keys.find(item=>item.type==='legacy'&&item.name==='anon')?.api_key;
assert.equal(typeof anon,'string');
const client=()=>createClient(`https://${fixture.projectRef}.supabase.co`,anon,
 {auth:{persistSession:false,autoRefreshToken:false}});
const unwrap=result=>{if(result.error)throw Error(`${result.error.code}: ${result.error.message}`);return result.data;};
const a=client(),b=client();
unwrap(await a.auth.signInWithPassword({email:fixture.people[0].email,password:fixture.password}));
unwrap(await b.auth.signInWithPassword({email:fixture.people[1].email,password:fixture.password}));
const [aId,bId]=fixture.people.map(p=>p.id);
assert.equal(unwrap(await a.rpc('league_is_member')),true);
assert.equal(unwrap(await b.rpc('league_is_member')),true);
const sql=statement=>JSON.parse(cli(['db','query','--linked','--project-ref',
 fixture.projectRef,'-o','json',statement])).rows;
const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
const night=unwrap(await a.rpc('rdd_create_night',{p_id:randomUUID(),
 p_title:'W6 Fictional Preview Night',p_venue:'Fictional Darts Hall',p_date:date}));
sql(`insert into rdd_private.planning_schedules(night_id,starts_at,rsvp_closes_at)
 values('${night.id}',now()+interval '2 days',now()+interval '1 day')`);
const poll=unwrap(await a.rpc('rdd_planning_write',{p_operation_id:randomUUID(),
 p_action:'save_poll',p_payload:{actor_id:aId,poll_id:randomUUID(),revision:0,
 title:'W6 Fictional October meetup',scope:'both',closes_local:'2026-10-04T20:00',
 publish:true,options:[{kind:'date',starts_local:'2026-10-10T19:00'},
 {kind:'venue',venue:'Fictional Darts Hall'}]}}));
assert.equal(unwrap(await a.rpc('rdd_planning_read')).organizer,true);
assert.equal(unwrap(await b.rpc('rdd_planning_read')).organizer,false);
unwrap(await b.rpc('board_write',{p_action:'request_access'}));
unwrap(await a.rpc('board_write',{p_action:'approve_member',p_target:bId}));
const postId=randomUUID();
unwrap(await b.rpc('board_write',{p_action:'create_post',p_id:postId,
 p_body:'W6 fictional preview: practice meetup and league-night planning.'}));
assert(unwrap(await a.rpc('board_feed',{p_id:postId})).some(row=>row.id===postId));
const create={action:'create',submitted_by:aId,id:randomUUID(),recipient:bId,
 night_id:night.id,game:'501',preset:'501-double-v1',board:'Steel Tip',best_of:3};
const first=unwrap(await a.rpc('rdd_rivalry_write',{
 p_operation_id:randomUUID(),p_payload:create})).challenge;
const challenge=unwrap(await b.rpc('rdd_rivalry_write',{
 p_operation_id:randomUUID(),p_payload:{action:'accept',submitted_by:bId,id:first.id,
 expected_revision:first.revision,event_revision:first.schedule.event_revision}})).challenge;
assert.equal(challenge.state,'accepted');
const acceptedAt=sql(`select accepted_at from rivalry_private.challenges where id='${challenge.id}'`)[0].accepted_at;
const playedAt=new Date(Math.max(Date.now(),Date.parse(acceptedAt)+1000)).toISOString();
const payload={submitted_by:aId,challenge_id:challenge.id,
 challenge_revision:challenge.revision,match_id:null,expected_revision:null,
 night_id:night.id,game_type:'501',board_type:'Steel Tip',venue:'Fictional Darts Hall',
 notes:null,played_at:playedAt,allow_duplicate:true,
 game_config:{version:1,preset:'501-double-v1',format:'individual',context:'competitive',
 status:'completed',handicap:false,sides:{},teamScores:{},otherName:'',finish:'ordinary'},
 players:[{player_id:aId,score:null,points_scored:null,is_winner:true},
 {player_id:bId,score:null,points_scored:null,is_winner:false}]};
const operation=randomUUID();
const match=unwrap(await a.rpc('rdd_save_match',{p_operation_id:operation,p_payload:payload}));
assert.equal(unwrap(await a.rpc('rdd_save_match',{
 p_operation_id:operation,p_payload:payload})).replayed,true);
assert.equal(match.challenge.state,'in_progress');
writeFileSync(outputPath,JSON.stringify({scope:'fictional W6 hosted preview only',
 observedAtUtc:new Date().toISOString(),nightId:night.id,pollCreated:Boolean(poll),
 boardPostId:postId,challengeId:challenge.id,linkedMatchId:match.match_id,
 memberOnlyPlanning:true,boardApproval:true,canonicalLinkAndReplay:true},null,2)+'\n',{flag:'wx'});
console.log('W6 fictional hosted scenario passed: night, organizer poll, Board approval/post, accepted Rivalry challenge and canonical linked game with exact retry.');
