import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// A fixed, separate local stack. Never link this workdir to a hosted project.
process.env.RDD_LOCAL_STACK = "league-night";
const {
  root,
  localWorkdir,
  docker,
  dockerHost,
  localDockerEnv,
  localStatus,
  projectId,
} = await import("./local-environment.mjs");
const [command, ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !["start", "status", "stop", "test", "dev", "build", "serve"].includes(
    command,
  )
) {
  throw new Error(
    "Use start, status, stop, test, dev, build or serve without extra flags.",
  );
}
if (command === "start") {
  mkdirSync(path.join(localWorkdir, "supabase"), { recursive: true });
  const config = readFileSync(path.join(root, "supabase/config.toml"), "utf8")
    .replace(
      'project_id = "Rochester-Darting-Degens-advanced-statis"',
      `project_id = "${projectId}"`,
    )
    .replace(/5432(\d)/g, "5542$1")
    .replaceAll(":3000", ":3010");
  writeFileSync(path.join(localWorkdir, "supabase/config.toml"), config);
}
if (["dev", "build", "serve"].includes(command)) {
  const status = localStatus();
  const args =
    command === "build"
      ? ["build"]
      : [
          command === "serve" ? "start" : "dev",
          "--hostname",
          "127.0.0.1",
          "--port",
          "3010",
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
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3010",
        RDD_LOCAL_PREVIEW: "1",
        GITHUB_TOKEN: "",
        GITHUB_REPO_OWNER: "",
        GITHUB_REPO_NAME: "",
      },
    },
  );
  process.exitCode = result.status ?? 1;
} else {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts/supabase-local.mjs"), command],
    {
      cwd: root,
      env: localDockerEnv(),
      stdio: command === "start" || command === "status" ? "pipe" : "inherit",
      windowsHide: true,
    },
  );
  // CLI status/start includes local privileged keys. Do not forward it to logs.
  if (result.status !== 0) {
    console.error("Isolated local Supabase command failed.");
    process.exitCode = result.status ?? 1;
  } else if (command === "start") {
    const container = `supabase_db_${projectId}`;
    const exists = docker([
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-Atqc",
      "select to_regclass('public.matches') is not null",
    ]);
    for (const file of exists === "f"
      ? [
          "supabase/tests/fixtures/existing_schema_baseline.sql",
          "supabase/pending/league_night.sql",
          "supabase/pending/league_night_enforce.sql",
        ]
      : []) {
      execFileSync(
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
          "-v",
          "ON_ERROR_STOP=1",
          "-f",
          "-",
        ],
        {
          input: readFileSync(path.join(root, file)),
          env: localDockerEnv(),
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 60000,
          windowsHide: true,
        },
      );
    }
    const ready = docker([
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-Atqc",
      "select to_regclass('public.league_nights') is not null",
    ]);
    if (ready !== "t")
      throw new Error(
        "Isolated schema is incomplete; inspect it before replaying SQL.",
      );
    console.log(
      "League Night local stack ready at http://127.0.0.1:55421; app uses port 3010. No hosted changes.",
    );
  } else if (command === "status") {
    localStatus();
    console.log(
      "Isolated League Night local stack is healthy on loopback port 55421.",
    );
  }
}
