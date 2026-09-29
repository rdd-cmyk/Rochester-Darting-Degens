// Compare stable full-row digests from two disposable local stacks. Never print
// or save Auth/player rows; the output contains only table names/counts/digests.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {root,dockerHost,localDockerEnv} from '../local-environment.mjs';

const source='rdd-release-w3',target='rdd-release-w4-restore';
const query=(project,statement)=>execFileSync('docker',['--host',dockerHost,'exec',
 `supabase_db_${project}`,'psql','-X','-U','postgres','-d','postgres',
 '-v','ON_ERROR_STOP=1','-At','-c',statement],{
 cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,windowsHide:true,
 stdio:['ignore','pipe','pipe']
}).trim();
const tables=query(source,`select n.nspname||'.'||c.relname from pg_class c
 join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and (
 n.nspname in ('public','rdd_private','invite_private','rivalry_private') or
 (n.nspname='auth' and c.relname in ('users','identities','sessions','refresh_tokens','mfa_factors')) or
 (n.nspname='storage' and c.relname in ('buckets','objects')))
 order by n.nspname,c.relname;`).split(/\r?\n/).filter(Boolean);
const results=[];
for(const table of tables){
 const [schema,name]=table.split('.');
 if(!/^[a-z_]+$/.test(schema)||!/^[a-z_]+$/.test(name))throw Error('Unexpected table identifier');
 const statement=`select count(*)::text||'|'||md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) order by to_jsonb(t)::text),'')) from "${schema}"."${name}" t;`;
 const before=query(source,statement),after=query(target,statement);
 if(before!==after)throw Error(`Synthetic restore drift in ${table}: source/target summary differs`);
 const [rows,sha]=before.split('|');
 results.push({table,rows:Number(rows),rowDigest:sha});
}
const counts=Object.fromEntries(results.filter(r=>['auth.users','public.profiles','public.matches',
 'public.match_players','storage.buckets','storage.objects'].includes(r.table)).map(r=>[r.table,r.rows]));
writeFileSync(path.join(root,'.local','w4-synthetic','verification.json'),JSON.stringify({
 observedAt:new Date().toISOString(),source,target,comparedTables:results.length,counts,
 scope:'synthetic local data; exact full-row count/digest equality across selected application, Auth and Storage tables'
},null,2)+'\n');
console.log(`Synthetic restore retained exact full-row digests across ${results.length} application/Auth/Storage tables.`);
