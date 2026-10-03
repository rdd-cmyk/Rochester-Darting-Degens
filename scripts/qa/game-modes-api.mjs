import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.RDD_LOCAL_STACK='game-modes';
const {localStatus,gameModesLocal}=await import('../local-environment.mjs');
if(!gameModesLocal) throw Error('Isolated game-modes stack required.');
const status=localStatus();
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const password='Local-Games-Demo-2026!';
const people=[];
let checks=0;
function ok(value,message){assert(value,message);checks++;}
function unwrap(result){if(result.error) throw Error(result.error.message);return result.data;}
for(const name of ['Ace','Bee','Cal','Dee','Eli','Fay']){
 const email=`games-${name.toLowerCase()}@example.test`;
 const db=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 let signed=await db.auth.signInWithPassword({email,password});
 if(signed.error){unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:`Demo ${name}`,first_name:'Demo',last_name:'Synthetic'}}));signed=await db.auth.signInWithPassword({email,password});}
 const auth=unwrap(signed);
 unwrap(await db.from('profiles').upsert({id:auth.user.id,display_name:`Demo ${name}`,first_name:'Demo',last_name:'Synthetic',include_first_name_in_display:false}));
 people.push({id:auth.user.id,name:`Demo ${name}`,email,db});
}
const db=people[0].db;
const night=unwrap(await db.rpc('rdd_create_night',{p_id:crypto.randomUUID(),p_title:'Game modes test night',p_venue:'Local only',p_date:'2026-09-27'}));
const config=(format='individual',preset='unspecified')=>({version:1,preset,format,context:'competitive',status:'completed',handicap:false,sides:format==='individual'?{}:Object.fromEntries(people.slice(0,format==='2v2'?4:6).map((p,i)=>[p.id,i<(format==='2v2'?2:3)?'A':'B'])),teamScores:{},otherName:'',finish:'ordinary'});
function payload(game='701',size=2){return {match_id:null,expected_revision:null,night_id:night.id,played_at:new Date(Date.now()-60000).toISOString(),game_type:game,game_config:config(size===2?'individual':size===4?'2v2':'3v3'),board_type:'Soft Tip',venue:'Local only',notes:'Synthetic game mode QA',allow_duplicate:true,players:people.slice(0,size).map((p,i)=>({player_id:p.id,score:null,points_scored:null,is_winner:i<size/2}))};}
const save=(p,id=crypto.randomUUID(),client=db)=>client.rpc('rdd_save_match',{p_operation_id:id,p_payload:{...p,submitted_by:client===db?people[0].id:people[1].id}});
const fixtures=[['701','701-double-v1'],['Cut-Throat Cricket','cut-throat-v1'],['No-Score Cricket','no-score-v1'],['Count-Up','count-up-8-full-v1'],['Around the Clock','clock-v1'],['Shanghai','shanghai-7-v1'],['Gotcha','gotcha-301-return-v1'],['Halve-It / Bermuda Triangle','half-it-9-v1'],['Halve-It / Bermuda Triangle','bermuda-13-v1']];
for(const [game,preset] of fixtures){const p=payload(game);p.game_config.preset=preset;ok(unwrap(await save(p)).status==='saved',`Create ${game}`);}
const p=payload('701',4), operation=crypto.randomUUID();
p.players[0].score=60.5;p.players[1].score=52.25;
p.game_config.teamScores={A:56.375,B:40};
const first=unwrap(await save(p,operation));
ok(first.status==='saved','Doubles saved');
const replay=unwrap(await save({...p,players:[...p.players].reverse()},operation));
ok(replay.replayed && replay.match_id===first.match_id,'Exact canonical retry');
ok((await save({...p,game_config:{...p.game_config,teamScores:{A:80}}},operation)).error?.code==='22023','Changed config cannot reuse mutation ID');
const row=unwrap(await db.from('matches').select('*,match_players(*)').eq('id',first.match_id).single());
ok(row.match_players.filter(p=>p.is_winner).length===2,'Both teammates are winners');
ok(row.game_config.teamScores.A===56.375,'Shared metric stored separately');
ok(row.match_players.find(x=>x.player_id===people[1].id).score===52.25,'Individual metric preserved');
const duplicate=unwrap(await save({...p,allow_duplicate:false}));
ok(duplicate.status==='possible_duplicate','Duplicate check includes team config');
const edited={...p,match_id:first.match_id,expected_revision:row.revision,game_type:'Gotcha',game_config:{...config('2v2','gotcha-301-return-v1'),teamScores:{A:18}},players:p.players.map(x=>({...x,score:null}))};
ok(unwrap(await save(edited)).status==='saved','Reclassify team contest');
const audit=unwrap(await db.from('match_corrections').select('*').eq('match_id',first.match_id));
ok(audit.length===1 && audit[0].previous_match.game_type==='701' && audit[0].previous_players.some(x=>x.score===60.5),'Correction preserves original values');
ok(unwrap(await people[1].db.from('match_corrections').select('*').eq('match_id',first.match_id)).length===0,'Correction audit private to owner');
ok((await save(edited)).error?.code==='40001','Stale revision rejected');
ok((await save(edited,crypto.randomUUID(),people[1].db)).error?.code==='42501','Another recorder cannot edit');
const current=unwrap(await db.from('matches').select('revision').eq('id',first.match_id).single());
ok((await save({...edited,expected_revision:current.revision,game_config:null})).error?.code==='22023','Old clients cannot erase new config');
const mixed=payload('701',4);mixed.players[1].is_winner=false;mixed.players[2].is_winner=true;
ok((await save(mixed)).error?.code==='22023','Mixed-side winners rejected');
ok(unwrap(await save(payload('701',6))).status==='saved','Triples saved');
const zero=payload('Count-Up');zero.players[0].score=0;zero.players[1].score=0;
ok(unwrap(await save(zero)).status==='saved','Zero scores accepted');
const unfinished=payload('Gotcha');unfinished.players[1].score=20;
ok((await save(unfinished)).error?.code==='22023','Loser cannot report darts to finish');
const invalidPreset=payload('701');invalidPreset.game_config.preset='clock-v1';
ok((await save(invalidPreset)).error?.code==='22023','Cross-game preset rejected');
const abandoned=payload('701',4);abandoned.game_config.status='abandoned';abandoned.players.forEach(p=>p.is_winner=false);
ok(unwrap(await save(abandoned)).status==='saved','Unrated abandoned result retained');
const direct=await db.from('matches').update({game_type:'Other'}).eq('id',first.match_id);
ok(direct.error?.code==='42501','Direct writes cannot bypass validation');
const anon=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false}});
ok((await anon.rpc('rdd_save_match',{p_operation_id:crypto.randomUUID(),p_payload:p})).error?.code==='42501','Anonymous saving blocked');
mkdirSync('.local/game-modes',{recursive:true});
writeFileSync('.local/game-modes/demo.json',JSON.stringify({nightId:night.id,people:people.map(p=>({id:p.id,name:p.name,email:p.email})),password},null,2));
console.log(`${checks} local API assertions passed. All accounts and records are synthetic. Night ${night.id}.`);
