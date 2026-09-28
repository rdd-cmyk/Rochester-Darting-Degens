import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
process.env.RDD_LOCAL_STACK = "solo";
const { docker, dockerHost, localDockerEnv, localStatus, projectId, root } =
  await import("./local-environment.mjs");
localStatus();
const container = `supabase_db_${projectId}`;
const database = `rdd_solo_rehearsal_${Date.now()}`;
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
    "supabase/pending/league_night.sql",
    "supabase/pending/league_night_enforce.sql",
    "supabase/tests/rehearsal/legacy-fixture.sql",
    "supabase/tests/fixtures/game_modes.sql",
  ])
    sql(readFileSync(path.join(root, file), "utf8"));
  sql(`CREATE SCHEMA solo_before;
 CREATE TABLE solo_before.profiles AS TABLE public.profiles;
 CREATE TABLE solo_before.matches AS TABLE public.matches;
 CREATE TABLE solo_before.players AS TABLE public.match_players;
 CREATE TABLE solo_before.nights AS TABLE public.league_nights;`);
  const fixture = readFileSync(
    path.join(root, "supabase/tests/fixtures/solo_play.sql"),
    "utf8",
  );
  sql(fixture);
  const result = sql(
    readFileSync(path.join(root, "supabase/tests/solo/solo.test.sql"), "utf8"),
  );
  if (/not ok|Looks like you failed/.test(result)) throw Error(result);
  mkdirSync(path.join(root, ".local/solo"), { recursive: true });
  writeFileSync(
    path.join(root, ".local/solo/rehearsal.txt"),
    `${database}\n${result}`,
  );
  console.log(result.trim());
  console.log(`Clean-schema solo rehearsal passed; retained ${database}.`);
  // Refresh functions only in the guarded fictional demo, after the clean
  // rehearsal passes. Never reset demo records or touch another stack.
  const functions = [
    ...fixture.matchAll(/CREATE FUNCTION public\.[\s\S]*?\$\$;/g),
  ].map((m) => m[0].replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"));
  if (functions.length !== 4) throw Error("Expected four solo functions.");
  sql(
    `BEGIN;\n${functions.join("\n")}\nNOTIFY pgrst,'reload schema';\nCOMMIT;`,
    "postgres",
  );
  console.log("Isolated solo demo functions refreshed.");
} catch (error) {
  console.error("Local solo rehearsal failed.");
  console.error(error.stdout?.toString().slice(-5000) ?? error.message);
  if (error.stderr) console.error(error.stderr.toString().slice(-3000));
  process.exitCode = 1;
}
