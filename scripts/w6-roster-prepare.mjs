// Read-only production roster resolution. Private UUIDs stay in ignored W6 workdir.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {root,cliPath,localDockerEnv} from './local-environment.mjs';

const dir=path.join(root,'.local','release-w6-testing');
const manifest=JSON.parse(readFileSync(path.join(dir,'manifest.json'),'utf8'));
assert.equal(manifest.projectRef,'uepayhdrgzrxhkqbwebo');
const sql=`select json_build_object('cutoff',now(),'authUsers',(select count(*) from auth.users),
 'people',(select json_agg(json_build_object('id',p.id,'first',p.first_name,
 'last',p.last_name,'display',p.display_name) order by p.id)
 from public.profiles p join auth.users u on u.id=p.id)) as roster`;
const output=execFileSync(cliPath(),['db','query','--linked','--project-ref',
 'hrqsbzmsfichiimtxijj','-o','json',sql],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,
 windowsHide:true,stdio:['ignore','pipe','pipe']});
const response=JSON.parse(output.slice(output.indexOf('{')));
const roster=response.rows?.[0]?.roster;
assert.equal(roster.authUsers,5,'Production Auth roster changed; reconcile before approval');
assert.equal(roster.people?.length,5,'Profile/Auth pairing changed');
const key=p=>`${p.first} ${p.last}`.trim().toLocaleLowerCase('en-US');
const select=name=>{
 const found=roster.people.filter(p=>key(p)===name);
 assert.equal(found.length,1,`Expected one ${name}`);
 assert.match(found[0].id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
 return found[0];
};
const excluded=select('captain test'),ben=select('ben linford'),tim=select('tim kiefer');
assert.equal(excluded.display,'CptTest');
const admitted=roster.people.filter(p=>p.id!==excluded.id);
assert.equal(admitted.length,4);
for(const organizer of [ben,tim])assert(admitted.some(p=>p.id===organizer.id));
const result={scope:'owner-approved W6 roster snapshot; no production write',
 sourceProjectRef:'hrqsbzmsfichiimtxijj',cutoffUtc:roster.cutoff,
 admittedUserIds:admitted.map(p=>p.id).sort(),excludedUserId:excluded.id,
 planningOrganizerIds:[ben.id,tim.id].sort(),boardOrganizerIds:[ben.id,tim.id].sort(),
 rule:'Four current Auth/profile users except Captain Test (display CptTest); new accounts require separate review'};
writeFileSync(path.join(dir,'approved-roster.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log('W6 production roster resolved uniquely: four approved current members, one excluded test account, two organizers for each role. Private IDs retained only in ignored workdir.');
