// Complete the fictional W6 scenario after a rejected linked-game attempt.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {root,cliPath,localDockerEnv} from '../local-environment.mjs';

const dir=path.join(root,'.local','release-w6-testing');
const outputPath=path.join(dir,'hosted-scenario.json');
if(existsSync(outputPath))throw Error('W6 hosted scenario already completed');
const fixture=JSON.parse(readFileSync(path.join(dir,'fictional-hosted.json'),'utf8'));
assert.equal(fixture.projectRef,'uepayhdrgzrxhkqbwebo');
const cli=args=>{
 try{return execFileSync(cliPath(),args,{cwd:root,env:localDockerEnv(),
  encoding:'utf8',timeout:30000,windowsHide:true,stdio:['ignore','pipe','pipe']});}
 catch{throw Error('W6 isolated CLI action failed');}
};
const rows=statement=>JSON.parse(cli(['db','query','--linked','--project-ref',
 fixture.projectRef,'-o','json',statement])).rows;
const state=rows(`select c.id as challenge_id,c.night_id,c.revision,c.event_revision,
 c.state,c.game,c.preset,c.board,(select count(*) from rivalry_private.links where challenge_id=c.id) as links
 from rivalry_private.challenges c order by c.created_at desc limit 1`)[0];
assert.equal(state.state,'accepted');
assert.equal(state.links,0);
assert.equal(state.game,'501');
assert.equal(state.preset,'501-double-v1');
assert.equal(state.board,'Steel Tip');
const keys=JSON.parse(cli(['projects','api-keys','--project-ref',fixture.projectRef,
 '--reveal','-o','json']));
const anon=keys.find(item=>item.type==='legacy'&&item.name==='anon')?.api_key;
assert.equal(typeof anon,'string');
const a=createClient(`https://${fixture.projectRef}.supabase.co`,anon,
 {auth:{persistSession:false,autoRefreshToken:false}});
const unwrap=result=>{if(result.error)throw Error(`${result.error.code}: ${result.error.message}`);return result.data;};
unwrap(await a.auth.signInWithPassword({email:fixture.people[0].email,password:fixture.password}));
const [aId,bId]=fixture.people.map(p=>p.id);
const payload={submitted_by:aId,challenge_id:state.challenge_id,
 challenge_revision:state.revision,match_id:null,expected_revision:null,
 night_id:state.night_id,game_type:'501',board_type:'Steel Tip',venue:'Fictional Darts Hall',
 notes:null,played_at:new Date().toISOString(),allow_duplicate:true,
 game_config:{version:1,preset:'501-double-v1',format:'individual',context:'competitive',
 status:'completed',handicap:false,sides:{},teamScores:{},otherName:'',finish:'ordinary'},
 players:[{player_id:aId,score:null,points_scored:null,is_winner:true},
 {player_id:bId,score:null,points_scored:null,is_winner:false}]};
const op=randomUUID();
const match=unwrap(await a.rpc('rdd_save_match',{p_operation_id:op,p_payload:payload}));
assert.equal(match.challenge.state,'in_progress');
assert.equal(unwrap(await a.rpc('rdd_save_match',{
 p_operation_id:op,p_payload:payload})).replayed,true);
assert.equal(rows(`select count(*) as links from rivalry_private.links where challenge_id='${state.challenge_id}'`)[0].links,1);
writeFileSync(outputPath,JSON.stringify({scope:'fictional W6 hosted preview only',
 observedAtUtc:new Date().toISOString(),nightId:state.night_id,
 challengeId:state.challenge_id,linkedMatchId:match.match_id,
 memberOnlyPlanning:true,boardApproval:true,canonicalLinkAndReplay:true,
 recoveredAfterFirstRejectedPayload:true},null,2)+'\n',{flag:'wx'});
console.log('W6 fictional hosted scenario completed: accepted Rivalry challenge linked to one canonical match and exact retry replayed.');
