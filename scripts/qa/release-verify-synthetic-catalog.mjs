// Compare read-only schema/security metadata after the synthetic W4 restore.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {root,dockerHost,localDockerEnv} from '../local-environment.mjs';

const sql=readFileSync(path.join(root,'docs','release','w1-hosted-catalog-2026-09-29.sql'),'utf8');
const query=(project,statement)=>{
 const raw=execFileSync('docker',['--host',dockerHost,'exec','-i',`supabase_db_${project}`,
  'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-f','-'],{
  cwd:root,env:localDockerEnv(),input:statement,encoding:'utf8',timeout:30000,maxBuffer:5000000,
  windowsHide:true,stdio:['pipe','pipe','pipe']
 });
 return JSON.parse(raw.trim());
};
const source=query('rdd-release-w3',sql),target=query('rdd-release-w4-restore',sql);
const sections=['postgres_version','schemas','relations','columns','constraints','indexes',
 'policies','functions','triggers','grants','column_grants','sequences','default_grants',
 'extensions','client_roles','client_role_memberships','migration_namespace_exists',
 'migration_table_exists','counts','integrity'];
const normalized=(section,value)=>{
 const copy=structuredClone(value);
 // An explicit owner-only ACL and PostgreSQL's null/implicit owner ACL have
 // identical effective rights. Check actual client rights separately below.
 if(['schemas','relations'].includes(section))for(const item of copy??[])delete item.acl;
 if(section==='constraints')for(const item of copy??[])
  item.definition=item.definition?.replace(/[()\s]/g,'');
 return copy;
};
const mismatches=sections.filter(key=>!isDeepStrictEqual(normalized(key,source[key]),normalized(key,target[key])));
const accessSql=`select jsonb_build_object(
 'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,
   'anon',has_schema_privilege('anon',oid,'USAGE'),
   'authenticated',has_schema_privilege('authenticated',oid,'USAGE'),
   'service_role',has_schema_privilege('service_role',oid,'USAGE')) order by nspname)
   from pg_namespace where nspname in ('public','rdd_private','invite_private','rivalry_private')),
 'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,
   'anon_read',has_table_privilege('anon',c.oid,'SELECT'),
   'auth_read',has_table_privilege('authenticated',c.oid,'SELECT'),
   'auth_write',has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE'),
   'service_read',has_table_privilege('service_role',c.oid,'SELECT')) order by n.nspname,c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','rdd_private','invite_private','rivalry_private') and c.relkind in ('r','p','v','m')),
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
   'signature',p.oid::regprocedure::text,
   'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_role',has_function_privilege('service_role',p.oid,'EXECUTE')) order by n.nspname,p.oid::regprocedure::text)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','rdd_private','invite_private','rivalry_private'))
)::text;`;
const sourceAccess=query('rdd-release-w3',accessSql),targetAccess=query('rdd-release-w4-restore',accessSql);
if(!isDeepStrictEqual(sourceAccess,targetAccess))mismatches.push('effective_client_privileges');
function firstDifference(a,b,where=''){
 if(isDeepStrictEqual(a,b))return null;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
   const found=firstDifference(a[key],b[key],`${where}.${key}`);
   if(found)return found;
  }
 }
 return {where,source:String(JSON.stringify(a)).slice(0,250),target:String(JSON.stringify(b)).slice(0,250)};
}
const differences=Object.fromEntries(mismatches.map(key=>[key,key==='effective_client_privileges'
 ? firstDifference(sourceAccess,targetAccess,key)
 : firstDifference(normalized(key,source[key]),normalized(key,target[key]),key)]));
writeFileSync(path.join(root,'.local','w4-synthetic','catalog-result.json'),JSON.stringify({
 observedAt:new Date().toISOString(),comparedSections:sections.length,mismatches,differences,
 effectiveClientPrivilegesCompared:true,
 scope:'synthetic local schema/security metadata; no row values'
},null,2)+'\n');
if(mismatches.length)throw Error('Synthetic catalog differs in: '+mismatches.join(', '));
console.log(`Synthetic restored catalog matched ${sections.length} schema, grant, policy and integrity sections.`);
