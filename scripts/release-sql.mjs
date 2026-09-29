// Synthetic-only staged upgrade and final combined regression harness.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, localWorkdir, projectId, docker, sql, releaseFiles, localStatus } from './release-environment.mjs';
const read = file => readFileSync(path.join(root, file), 'utf8');
const container = `supabase_db_${projectId}`;
const hash = text => createHash('sha256').update(text).digest('hex');
export function tap(result) {
  const plans = [...result.matchAll(/^1\.\.(\d+)\s*$/gm)];
  const total = (result.match(/^ok \d+\b/gm) ?? []).length;
  if (/^not ok|Bail out!|Looks like you failed/mi.test(result) || plans.length !== 1 || total === 0 || total !== Number(plans[0][1]))
    throw Error('Incomplete or failed TAP:\n' + result.slice(-6000));
  return total;
}
function fresh(label, legacy = true) {
  const db = `rdd_w3_${label}_${Date.now()}`;
  docker(['exec', container, 'createdb', '-U', 'postgres', '--template=template0', db]);
  sql('CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon,authenticated; CREATE SCHEMA vault; CREATE PUBLICATION supabase_realtime;', db);
  sql(docker(['exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only', '--schema=auth', '--no-owner', '--no-acl']), db);
  sql('GRANT USAGE ON SCHEMA auth TO anon,authenticated;', db);
  sql(read('supabase/tests/fixtures/existing_schema_baseline.sql'), db);
  if (legacy) sql(read('supabase/tests/rehearsal/legacy-fixture.sql'), db);
  return db;
}
function digest(db) {
  return hash(docker(['exec', container, 'pg_dump', '-U', 'postgres', '-d', db, '--schema=public', '--schema=rdd_private', '--schema=invite_private', '--schema=rivalry_private'])
    .replace(/^\\(?:un)?restrict .*$/gm, ''));
}
function original(db) {
  return sql("select jsonb_agg(to_jsonb(m)) from (select id,played_at,game_type,created_by,notes,board_type,venue from public.matches where id=-990001) m;", db).trim();
}
function run(file, db, transform = value => value) {
  const result = sql(transform(read(file)), db);
  const assertions = tap(result);
  writeFileSync(path.join(localWorkdir, path.basename(file) + '.' + db + '.tap'), result);
  return { file, database: db, assertions };
}
export function rehearseSql() {
  localStatus(); mkdirSync(localWorkdir, { recursive: true });
  const db = fresh('staged');
  const preserved = original(db), steps = [];
  for (const file of releaseFiles) {
    const source = read(file), before = digest(db);
    const commits = [...source.matchAll(/^\s*commit\s*;/gim)];
    if (commits.length !== 1) throw Error('Expected one atomic transaction: ' + file);
    const interrupted = source.replace(/^\s*commit\s*;/im, "SELECT 1/0;\nCOMMIT;");
    let refused = false;
    try { sql(interrupted, db); } catch { refused = true; }
    if (!refused || digest(db) !== before) throw Error('Interrupted file changed schema/data: ' + file);
    const start = Date.now(); sql(source, db);
    const milliseconds = Date.now() - start;
    if (original(db) !== preserved) throw Error('Original record changed: ' + file);
    const grants = sql("select has_table_privilege('authenticated','public.matches','INSERT')||'/'||has_table_privilege('authenticated','public.match_players','UPDATE');", db).trim();
    let admission = null;
    if (file.endsWith('invite_only_registration.sql')) {
      const caller = "SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"00000000-0000-4000-8000-000000000099\"}',false); SELECT public.league_is_member();";
      if (!sql(caller, db).trim().endsWith('f')) throw Error('Admission was inferred from old profile');
      sql("INSERT INTO public.league_members(user_id) VALUES('00000000-0000-4000-8000-000000000099');", db);
      if (!sql(caller, db).trim().endsWith('t')) throw Error('Explicit backfill failed');
      admission = 'existing identity denied before explicit reviewed fixture admission; active afterward';
    }
    let oldClientWrite;
    const beforeClientCount=sql('SELECT count(*) FROM public.matches;',db).trim();
    const oldClient = `BEGIN; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',true);
INSERT INTO public.matches(played_at,game_type,created_by,board_type,notes)
VALUES(now(),'501','00000000-0000-4000-8000-000000000099','Soft Tip','Old split-writer stage probe');
ROLLBACK;`;
    try { sql(oldClient,db); oldClientWrite='accepted inside rolled-back probe'; }
    catch { oldClientWrite='denied'; }
    if (grants === 'true/true' && oldClientWrite === 'denied')
      throw Error('Old client denied before direct-write enforcement: ' + file);
    if (grants === 'false/false' && oldClientWrite !== 'denied')
      throw Error('Old client accepted after enforcement: ' + file);
    if (sql('SELECT count(*) FROM public.matches;',db).trim()!==beforeClientCount)
      throw Error('Old-client probe left a committed row: '+file);
    const applied = digest(db); let replay;
    try { sql(source, db); replay = 'accepted'; } catch { replay = 'refused'; }
    if (digest(db) !== applied) throw Error('Replay changed schema/data: ' + file);
    if (original(db) !== preserved) throw Error('Replay changed original record');
    steps.push({ file, milliseconds, interrupted_transaction: 'rolled back completely', replay, legacy_table_grants: grants, old_client_split_write:oldClientWrite, admission });
  }
  const results = [run('supabase/tests/rehearsal/legacy-preservation.test.sql', db), run('supabase/tests/release/security.test.sql', db)];
  for (const suite of ['league-night/league-night', 'planning/planning', 'board/league_board', 'solo/solo', 'solo/admission', 'statistics/final']) {
    const target = fresh(suite.replaceAll('/', '_'), !suite.startsWith('statistics'));
    for (const file of releaseFiles) {
      if (file.endsWith('solo_play.sql')) sql('CREATE SCHEMA solo_before; CREATE TABLE solo_before.profiles AS TABLE public.profiles; CREATE TABLE solo_before.matches AS TABLE public.matches; CREATE TABLE solo_before.players AS TABLE public.match_players; CREATE TABLE solo_before.nights AS TABLE public.league_nights;', target);
      sql(read(file), target);
    }
    results.push(run('supabase/tests/' + suite + '.test.sql', target, text => {
      text = text.replace('\\ir /fixtures/league_planning_visibility_upgrade.sql', () => read('supabase/tests/fixtures/league_planning_visibility_upgrade.sql'));
      if (suite.startsWith('league-night') || suite.startsWith('planning') || suite.startsWith('board')) {
        const ids = suite.startsWith('board') ? [1,2,3,4].map(i => `bb000000-0000-4000-8000-00000000000${i}`) : ['aaaaaaaa-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000003'];
        const at = text.toLowerCase().indexOf('set local role');
        text = text.slice(0, at) + `INSERT INTO public.league_members(user_id) VALUES ${ids.map(id => "('"+id+"')").join(',')};\n` + text.slice(at);
        text = text.replaceAll("to_regclass('public.seasons') IS NULL", "to_regclass('public.seasons') IS NOT NULL");
      }
      if (suite.startsWith('league-night')) {
        text = text.replace("'match_id',null", "'submitted_by',auth.uid(),'match_id',null");
        // Rivalry's final receipt stores the exact original JSON, whereas the
        // earlier inner recorder accepted equivalent timestamp spellings.
        text = text.replace(/SELECT is\(public\.rdd_save_match\('00000000-0000-4000-8000-000000000001',jsonb_set\(pg_temp\.payload\(\),'\{played_at\}'.*?;\r?\n/, () => "SELECT throws_ok($$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000001',jsonb_set(pg_temp.payload(),'{played_at}','\"2026-09-01T14:00:00-04:00\"'))$$,'PT409',null,'Outer receipt requires exact original JSON');\n");
        text = text.replace("'{notes}','\"changed\"'))$$,'22023'", () => "'{notes}','\"changed\"'))$$,'PT409'");
      }
      return text;
    }));
  }
  const result = { date: new Date().toISOString(), projectId, database: db, steps, results, total_assertions: results.reduce((sum, row) => sum + row.assertions, 0), source: releaseFiles.map(file => ({ file, canonical_lf_sha256: hash(read(file).replace(/\r\n/g, '\n')) })) };
  writeFileSync(path.join(localWorkdir, 'combined-sql.json'), JSON.stringify(result, null, 2));
  console.log(`${result.total_assertions} combined SQL assertions passed; interrupted installs and replay outcomes retained.`);
  return result;
}
if (process.argv[1]?.endsWith('release-sql.mjs')) rehearseSql();
