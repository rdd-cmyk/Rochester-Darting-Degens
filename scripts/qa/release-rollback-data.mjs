// Verify the original synthetic rows after exercising the earlier compatible
// app against the upgraded W3 database. This never connects to a hosted target.
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {root,localWorkdir,localStatus,sql,projectId} from '../release-environment.mjs';

localStatus();
const phase=process.argv[2]??'verify';
if(!['snapshot','verify'].includes(phase)||process.argv.length>3)throw Error('Use snapshot or verify');
const artifact=JSON.parse(readFileSync(path.join(localWorkdir,'rollback-artifact.json'),'utf8'));
if(artifact.baseGitRef!=='a72f7bf'||artifact.database!=='same already-upgraded synthetic W3 project')
 throw Error('The compatible rollback artifact does not match this W3 rehearsal');
const keyedTables={
 'rivalry_private.avatar_catalog':'id::text',
 'rivalry_private.avatars':'user_id::text',
 'rivalry_private.challenges':'id::text',
 'rivalry_private.links':'match_id::text',
 'rivalry_private.events':'id::text',
 'rivalry_private.operations':"actor::text||':'||operation_id::text",
 'public.solo_sessions':'id::text',
 'public.solo_games':'id::text',
 'public.solo_preferences':'owner_id::text',
 'rdd_private.solo_operations':"owner_id::text||':'||operation_id::text"
};
const snapshot=()=>Object.fromEntries(Object.entries(keyedTables).map(([table,key])=>[
 table,JSON.parse(sql(`select coalesce(jsonb_object_agg(${key},md5(to_jsonb(t)::text)),'{}'::jsonb)::text from ${table} t;`).trim())
]));
const snapshotPath=path.join(localWorkdir,'rollback-before.json');
if(phase==='snapshot'){
 const rows=snapshot();
 writeFileSync(snapshotPath,JSON.stringify({date:new Date().toISOString(),projectId,appBaseGitRef:artifact.baseGitRef,rows},null,2)+'\n');
 console.log('Captured stable-key hashes for all Rivalry and Solo tables before additional compatible-app writes.');
 process.exit(0);
}
const before=JSON.parse(readFileSync(snapshotPath,'utf8'));
if(before.projectId!==projectId||before.appBaseGitRef!==artifact.baseGitRef)throw Error('Wrong rollback snapshot');
const after=snapshot();
const state=Object.fromEntries(Object.entries(before.rows).map(([table,rows])=>{
 for(const [key,digest] of Object.entries(rows))if(after[table]?.[key]!==digest)
  throw Error(`Rollback changed/deleted preexisting ${table} row ${key}`);
 return [table,{preexisting:Object.keys(rows).length,after:Object.keys(after[table]).length}];
}));
if(state['rivalry_private.operations'].after<=state['rivalry_private.operations'].preexisting||
   state['rivalry_private.links'].after<=state['rivalry_private.links'].preexisting||
   state['rdd_private.solo_operations'].after<=state['rdd_private.solo_operations'].preexisting)
 throw Error('Compatible-app tests did not create new Rivalry receipts/links and Solo operations');
let test=readFileSync(path.join(root,'supabase/tests/rehearsal/legacy-preservation.test.sql'),'utf8');
// The staged test expects no later inserts. On the app database, compare just
// each original identity so successful browser saves remain allowed.
for(const [from,to] of [
 ['from public.profiles order by id', 'from public.profiles where id in (select id from rdd_rehearsal.original_profiles) order by id'],
 ['from public.matches order by id', 'from public.matches where id in (select id from rdd_rehearsal.original_matches) order by id'],
 ['from public.match_players order by id', 'from public.match_players where id in (select id from rdd_rehearsal.original_participants) order by id']
]){
 if(!test.includes(from))throw Error('Stale original-row assertion: '+from);
 test=test.replace(from,to);
}
const tap=sql(test);
if(/\bnot ok\b/i.test(tap)||!tap.includes('1..9')||!tap.includes('ok 9'))
 throw Error('The original legacy rows did not pass all nine preservation assertions: '+tap.slice(-1800));
const totals=JSON.parse(sql(`select json_build_object(
 'matches',(select count(*) from public.matches),
 'participants',(select count(*) from public.match_players),
 'profiles',(select count(*) from public.profiles),
 'legacy_match',(select count(*) from public.matches where id=-990001),
 'legacy_participant',(select count(*) from public.match_players where id=-990001)
)::text;`).trim());
if(totals.legacy_match!==1||totals.legacy_participant!==1||totals.matches<2)
 throw Error('Rollback rehearsal did not retain original and post-upgrade matches');
writeFileSync(path.join(localWorkdir,'rollback-data.json'),JSON.stringify({
 date:new Date().toISOString(),projectId,appBaseGitRef:artifact.baseGitRef,
 backports:artifact.backports,legacyPreservationAssertions:9,totals,state,
 scope:'synthetic local upgraded database; compatible app served without database revert'
},null,2)+'\n');
console.log('Compatible-app rollback kept all original Rivalry/Solo row hashes, all nine legacy assertions, and post-upgrade match data.');
