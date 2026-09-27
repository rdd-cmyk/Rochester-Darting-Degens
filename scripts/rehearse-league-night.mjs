import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
process.env.RDD_LOCAL_STACK = "league-night";
const { docker, dockerHost, localDockerEnv, localStatus, projectId, root } =
  await import("./local-environment.mjs");
localStatus();
const container = `supabase_db_${projectId}`;
const database = `rdd_night_rehearsal_${Date.now()}`;
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
  ])
    sql(readFileSync(path.join(root, file), "utf8"));
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
  // Refresh only function bodies in this task's isolated development stack.
  // Schema changes require another reviewed fixture step; no table reset here.
  const definitions = readFileSync(
    path.join(root, "supabase/pending/league_night.sql"),
    "utf8",
  ).match(/CREATE FUNCTION[\s\S]*?\$\$;/g);
  sql(
    "BEGIN;\n" +
      definitions
        .map((d) => d.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"))
        .join("\n") +
      "\n" +
      readFileSync(
        path.join(root, "supabase/pending/league_night_enforce.sql"),
        "utf8",
      )
        .replace("BEGIN;", "")
        .replace("COMMIT;", "") +
      "\nNOTIFY pgrst, 'reload schema';\nCOMMIT;",
    "postgres",
  );
  console.log(
    "Isolated development functions refreshed after the rehearsal passed.",
  );
} catch (error) {
  console.error("Local League Night rehearsal failed.");
  if (error.stdout) console.error(error.stdout.toString().slice(-5000));
  if (error.stderr) console.error(error.stderr.toString().slice(-3000));
  process.exitCode = 1;
}
