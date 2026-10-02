import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
process.env.RDD_LOCAL_STACK = "league-planning";
const {
  root,
  localWorkdir,
  projectId,
  docker,
  dockerHost,
  localDockerEnv,
  localStatus,
} = await import("./local-environment.mjs");
const [command, ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !["start", "status", "stop", "dev", "build", "serve", "test"].includes(
    command,
  )
)
  throw new Error(
    "Use start, status, stop, dev, build, serve or test without extra flags.",
  );
export function sql(input, database = "postgres") {
  return execFileSync(
    "docker",
    [
      "--host",
      dockerHost,
      "exec",
      "-i",
      `supabase_db_${projectId}`,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
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
  if (command === "start") {
    mkdirSync(path.join(localWorkdir, "supabase"), { recursive: true });
    const config = readFileSync(path.join(root, "supabase/config.toml"), "utf8")
      .replace(
        'project_id = "Rochester-Darting-Degens-advanced-statis"',
        `project_id = "${projectId}"`,
      )
      .replace(/5432(\d)/g, "5582$1")
      .replaceAll(":3000", ":3030");
    writeFileSync(path.join(localWorkdir, "supabase/config.toml"), config);
  }
  if (["build", "dev", "serve"].includes(command)) {
    const status = localStatus();
    const args =
      command === "build"
        ? ["build"]
        : [
            command === "serve" ? "start" : "dev",
            "--hostname",
            "127.0.0.1",
            "--port",
            "3030",
          ];
    const result = spawnSync(
      process.execPath,
      [path.join(root, "node_modules/next/dist/bin/next"), ...args],
      {
        cwd: root,
        stdio: "inherit",
        windowsHide: true,
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
          NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3030",
          RDD_LOCAL_PREVIEW: "1",
          GITHUB_TOKEN: "",
          GITHUB_REPO_OWNER: "",
          GITHUB_REPO_NAME: "",
        },
      },
    );
    process.exitCode = result.status ?? 1;
  } else if (command === "test") {
    localStatus();
    // Target the inspected database container's network namespace. A shared
    // Docker network's "db" alias may point at another worktree's database.
    const result = execFileSync(
      "docker",
      [
        "--host",
        dockerHost,
        "run",
        "--rm",
        "--network",
        `container:supabase_db_${projectId}`,
        "-e",
        "PGPASSWORD=postgres",
        "--mount",
        `type=bind,source=${path.join(root, "supabase/tests/planning")},target=/tests,readonly`,
        "--mount",
        `type=bind,source=${path.join(root, "supabase/tests/fixtures")},target=/fixtures,readonly`,
        "public.ecr.aws/supabase/pg_prove:3.36",
        "pg_prove",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "/tests/planning.test.sql",
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
  } else {
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/supabase-local.mjs"), command],
      { cwd: root, env: localDockerEnv(), stdio: "pipe", windowsHide: true },
    );
    if (result.status !== 0)
      throw new Error(
        "Planning local stack command failed. Inspect Docker availability and local port bindings.",
      );
    if (command === "start") {
      localStatus();
      const exists = docker([
        "exec",
        `supabase_db_${projectId}`,
        "psql",
        "-U",
        "postgres",
        "-Atqc",
        "select to_regclass('public.matches') is not null",
      ]);
      if (exists === "f")
        for (const file of [
          "supabase/tests/fixtures/existing_schema_baseline.sql",
          "supabase/tests/fixtures/league_night.sql",
          "supabase/tests/fixtures/league_night_enforce.sql",
          "supabase/tests/fixtures/league_planning.sql",
        ])
          sql(readFileSync(path.join(root, file), "utf8"));
      const ready = docker([
        "exec",
        `supabase_db_${projectId}`,
        "psql",
        "-U",
        "postgres",
        "-Atqc",
        "select to_regclass('rdd_private.planning_polls') is not null",
      ]);
      if (ready !== "t")
        throw new Error(
          "Planning schema is incomplete. Inspect before applying any SQL.",
        );
    }
    if (command !== "stop") localStatus();
    console.log(
      `Planning ${command} complete. Local API 55821; app 3030. No hosted changes.`,
    );
  }
} catch (error) {
  console.error(error.message?.split("\n")[0] ?? "Planning command failed.");
  if (command === "test" || command === "start") {
    if (error.stdout) console.error(error.stdout.toString().slice(-6000));
    if (error.stderr) console.error(error.stderr.toString().slice(-3000));
  }
  process.exitCode = 1;
}
