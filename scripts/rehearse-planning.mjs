import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
process.env.RDD_LOCAL_STACK = "league-planning";
const { docker, dockerHost, localDockerEnv, localStatus, projectId, root } =
  await import("./local-environment.mjs");
localStatus();
const container = `supabase_db_${projectId}`;
const database = `rdd_planning_rehearsal_${Date.now()}`;
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
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60000,
      windowsHide: true,
    },
  );
}
try {
  docker([
    "exec",
    container,
    "createdb",
    "-U",
    "postgres",
    "--template=template0",
    database,
  ]);
  sql(
    "CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon,authenticated; CREATE SCHEMA vault; CREATE PUBLICATION supabase_realtime;",
  );
  sql(
    docker([
      "exec",
      container,
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
  sql("GRANT USAGE ON SCHEMA auth TO anon,authenticated;");
  for (const file of [
    "supabase/tests/fixtures/existing_schema_baseline.sql",
    "supabase/tests/fixtures/league_night.sql",
    "supabase/tests/fixtures/league_night_enforce.sql",
    "supabase/tests/fixtures/league_planning.sql",
  ])
    sql(readFileSync(path.join(root, file), "utf8"));
  for (const suite of ["planning", "league-night"]) {
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
        `type=bind,source=${path.join(root, "supabase/tests", suite)},target=/tests,readonly`,
        "--mount",
        `type=bind,source=${path.join(root, "supabase/tests/fixtures")},target=/fixtures,readonly`,
        "public.ecr.aws/supabase/pg_prove:3.36",
        "pg_prove",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        database,
        `/tests/${suite}.test.sql`,
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
  }
  // Only after exact fresh-schema tests pass, refresh task-owned function
  // bodies, publication metadata and the reviewed non-null venue check.
  // No table resets or other stacks.
  const source = readFileSync(
    path.join(root, "supabase/tests/fixtures/league_planning.sql"),
    "utf8",
  );
  const functions = source.match(/CREATE FUNCTION[\s\S]*?END \$\$;/g);
  if (functions?.length !== 4)
    throw new Error("Expected four reviewed planning functions.");
  sql(
    "BEGIN;\n" +
      readFileSync(
        path.join(
          root,
          "supabase/tests/fixtures/league_planning_visibility_upgrade.sql",
        ),
        "utf8",
      ) +
      "\nALTER TABLE rdd_private.planning_options DROP CONSTRAINT planning_options_check, ADD CONSTRAINT planning_options_check CHECK ((kind='date' AND starts_at IS NOT NULL AND isfinite(starts_at) AND venue IS NULL) OR (kind='venue' AND starts_at IS NULL AND venue IS NOT NULL AND length(btrim(venue)) BETWEEN 1 AND 49));\n" +
      functions
        .map((f) => f.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"))
        .join("\n") +
      "\nREVOKE ALL ON FUNCTION public.rdd_planning_night_status(uuid[]) FROM PUBLIC,anon,authenticated;\nGRANT EXECUTE ON FUNCTION public.rdd_planning_night_status(uuid[]) TO authenticated;\nNOTIFY pgrst,'reload schema';\nCOMMIT;",
    "postgres",
  );
  console.log(
    `Fresh legacy + planning rehearsal passed; retained ${database}. Development planning functions refreshed.`,
  );
} catch (error) {
  console.error("Local planning rehearsal failed.");
  if (error.stdout) console.error(error.stdout.toString().slice(-8000));
  if (error.stderr) console.error(error.stderr.toString().slice(-4000));
  if (!error.stdout && !error.stderr) console.error(error.message);
  process.exitCode = 1;
}
