// Aggregate-only integrity checks for the loopback protected W5 database.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {root,dockerHost,localDockerEnv} from '../local-environment.mjs';

const sql=`SELECT json_build_object(
 'matches',(SELECT count(*) FROM public.matches),
 'participants',(SELECT count(*) FROM public.match_players),
 'profiles',(SELECT count(*) FROM public.profiles),
 'authUsers',(SELECT count(*) FROM auth.users),
 'orphanParticipants',(SELECT count(*) FROM public.match_players p LEFT JOIN public.matches m ON m.id=p.match_id WHERE m.id IS NULL),
 'orphanProfiles',(SELECT count(*) FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id WHERE u.id IS NULL),
 'orphanMembers',(SELECT count(*) FROM public.league_members m LEFT JOIN auth.users u ON u.id=m.user_id WHERE u.id IS NULL),
 'unvalidatedForeignKeys',(SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','rdd_private','invite_private','rivalry_private') AND c.contype='f' AND NOT c.convalidated),
 'unvalidatedChecks',(SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','rdd_private','invite_private','rivalry_private') AND c.contype='c' AND NOT c.convalidated),
 'migrationRows',(SELECT count(*) FROM supabase_migrations.schema_migrations),
 'distinctMigrationVersions',(SELECT count(DISTINCT version) FROM supabase_migrations.schema_migrations)
);`;
const output=execFileSync('docker',['--host',dockerHost,'exec','-i',
 'supabase_db_rdd-release-w4-protected','psql','-X','-U','postgres','-d','postgres',
 '-v','ON_ERROR_STOP=1','-At','-f','-'],{
 cwd:root,env:localDockerEnv(),input:sql,encoding:'utf8',timeout:30000,
 windowsHide:true,stdio:['pipe','pipe','pipe']}).trim();
const result=JSON.parse(output);
assert(result.matches>=10&&result.participants>=22&&result.profiles>=5&&result.authUsers>=5);
for(const key of ['orphanParticipants','orphanProfiles','orphanMembers',
 'unvalidatedForeignKeys','unvalidatedChecks'])assert.equal(result[key],0,key);
assert.equal(result.migrationRows,12);
assert.equal(result.distinctMigrationVersions,12);
writeFileSync(path.join(root,'.local','release-w5-protected','final-integrity.json'),
 JSON.stringify({observedAtUtc:new Date().toISOString(),...result},null,2)+'\n',{flag:'wx'});
console.log('W5 aggregate integrity passed: zero application orphans/unvalidated constraints, 12 distinct migration versions.');
