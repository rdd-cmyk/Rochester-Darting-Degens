import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
process.env.RDD_LOCAL_STACK = "game-modes";
const { docker, dockerHost, localDockerEnv, localStatus, projectId, root } =
  await import("./local-environment.mjs");
localStatus();
const container = `supabase_db_${projectId}`;
const database = `rdd_games_rehearsal_${Date.now()}`;
const exec = (args) => docker(["exec", container, ...args]);
function sql(input, db = database) {
  return execFileSync(
    "docker",
    [
      "--host",
      dockerHost,
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    {
      input,
      env: localDockerEnv(),
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      timeout: 60000,
      windowsHide: true,
    },
  );
}
try {
  exec(["createdb", "-U", "postgres", "--template=template0", database]);
  sql(
    "CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon, authenticated; CREATE SCHEMA vault; CREATE PUBLICATION supabase_realtime;",
  );
  sql(
    exec([
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--schema-only",
      "--schema=auth",
      "--no-owner",
      "--no-acl",
    ]),
  );
  for (const file of [
    "supabase/tests/fixtures/existing_schema_baseline.sql",
    "supabase/tests/fixtures/league_night.sql",
    "supabase/tests/fixtures/league_night_enforce.sql",
  ])
    sql(readFileSync(path.join(root, file), "utf8"));
  sql(readFileSync(path.join(root, "supabase/tests/rehearsal/legacy-fixture.sql"), "utf8"));
  sql(readFileSync(path.join(root, "supabase/tests/fixtures/game_modes.sql"), "utf8"));
  const preservation = sql(`
    BEGIN;
    CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
    SET LOCAL search_path=public,extensions;
    SELECT plan(11);
    SELECT results_eq('select * from public.profiles order by id', 'select * from rdd_rehearsal.original_profiles order by id', 'Original profile values survive');
    SELECT results_eq('select to_jsonb(m)-''game_config'' from public.matches m order by id', 'select to_jsonb(m) from rdd_rehearsal.original_matches m order by id', 'Original match values survive');
    SELECT results_eq('select id,match_id,player_id,score,is_winner,created_at,points_scored from public.match_players order by id', 'select * from rdd_rehearsal.original_participants order by id', 'Original participant values survive');
    SELECT is((select game_config from public.matches where id=-990001),null::jsonb,'No historical rules invented');
    SELECT is((select enabled from rdd_private.game_modes_control),false,'New writes disabled by default');
    INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000098');
    INSERT INTO public.profiles(id,display_name) VALUES ('00000000-0000-4000-8000-000000000098','Gate fixture');
    CREATE FUNCTION pg_temp.gate_payload() RETURNS jsonb LANGUAGE sql AS $p$
      SELECT '{"game_type":"501","played_at":"2026-01-01T00:00:00Z","allow_duplicate":true,"players":[{"player_id":"00000000-0000-4000-8000-000000000099","is_winner":true,"score":null},{"player_id":"00000000-0000-4000-8000-000000000098","is_winner":false,"score":null}]}'::jsonb;
    $p$;
    CREATE FUNCTION pg_temp.new_payload() RETURNS jsonb LANGUAGE sql AS $p$
      SELECT pg_temp.gate_payload() || '{"game_config":{"version":1,"format":"individual","preset":"501-double-v1","context":"competitive","status":"completed","handicap":false,"sides":{},"teamScores":{},"otherName":"","finish":"ordinary"}}'::jsonb;
    $p$;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',true);
    SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000097',pg_temp.gate_payload())->>'status','saved','Legacy client writes while gate is off');
    SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000097',pg_temp.gate_payload())->>'replayed','true','Legacy exact retry works');
    SELECT throws_ok($q$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000096',pg_temp.new_payload())$q$,'22023','New game rules and teams are not enabled yet. Your entry is preserved.','Gate blocks new rules');
    RESET ROLE;
    UPDATE rdd_private.game_modes_control SET enabled=true;
    SET LOCAL ROLE authenticated;
    SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000096',pg_temp.new_payload())->>'status','saved','Enabling accepts new rules');
    RESET ROLE;
    UPDATE rdd_private.game_modes_control SET enabled=false;
    SET LOCAL ROLE authenticated;
    SELECT is(public.rdd_save_match('00000000-0000-4000-8000-000000000096',pg_temp.new_payload())->>'replayed','true','Committed retry survives gate closure');
    SELECT throws_ok($q$SELECT public.rdd_save_match('00000000-0000-4000-8000-000000000095',pg_temp.new_payload())$q$,'22023',null,'Gate closure blocks another new write');
    RESET ROLE;
    SELECT * FROM finish();
    ROLLBACK;
  `);
  if (/not ok|Looks like you failed/.test(preservation)) throw new Error(preservation);
  console.log('11 preservation, activation and retry assertions passed.');
  const testPath = "/tmp/league-night.test.sql";
  docker([
    "cp",
    path.join(root, "supabase/tests/league-night/league-night.test.sql"),
    `${container}:${testPath}`,
  ]);
  const result = execFileSync(
    "docker",
    [
      "--host",
      dockerHost,
      "run",
      "--rm",
      "--network",
      `container:${container}`,
      "-e",
      "PGPASSWORD=postgres",
      "--mount",
      `type=bind,source=${path.join(root, "supabase/tests/league-night")},target=/tests,readonly`,
      "public.ecr.aws/supabase/pg_prove:3.36",
      "pg_prove",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      database,
      "/tests/league-night.test.sql",
    ],
    {
      env: localDockerEnv(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
      windowsHide: true,
    },
  );
  console.log(result.trim());
  console.log(`Legacy-only rehearsal retained: ${database}`);
  // Keep only this isolated demo stack's function body in sync after a passing
  // clean-schema rehearsal. Never reset its records or copy any hosted data.
  const definition = readFileSync(path.join(root, 'supabase/tests/fixtures/game_modes.sql'), 'utf8')
    .match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/)?.[0];
  if (!definition) throw new Error('Game mode function definition is missing.');
  sql(`BEGIN;\n${definition}\nNOTIFY pgrst, 'reload schema';\nCOMMIT;`, 'postgres');
  console.log('Isolated game modes demo function refreshed after the rehearsal passed.');
} catch (error) {
  console.error("Local game modes rehearsal failed.");
  if (!error.stdout && !error.stderr) console.error(error.message);
  if (error.stdout) console.error(error.stdout.toString().slice(-5000));
  if (error.stderr) console.error(error.stderr.toString().slice(-3000));
  process.exitCode = 1;
}
