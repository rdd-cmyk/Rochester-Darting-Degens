import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
process.env.RDD_LOCAL_STACK = "solo";
const {
  root,
  localWorkdir,
  projectId,
  docker,
  dockerHost,
  localDockerEnv,
  localStatus,
  cliPath,
  localCliArgs,
  assertWindowsPortDefault,
} = await import("./local-environment.mjs");
const [command, ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !["start", "status", "stop", "build", "serve", "dev", "test"].includes(
    command,
  )
)
  throw Error("Use solo:local with start/status/stop/build/serve/dev/test.");
if (command === "start") {
  assertWindowsPortDefault();
  const net = JSON.parse(
    docker(["network", "inspect", "rdd-local-loopback"]),
  )[0];
  if (
    net?.Options?.["com.docker.network.bridge.host_binding_ipv4"] !==
    "127.0.0.1"
  )
    throw Error("Local Docker network must bind loopback.");
  mkdirSync(path.join(localWorkdir, "supabase"), { recursive: true });
  writeFileSync(
    path.join(localWorkdir, "supabase/config.toml"),
    readFileSync(path.join(root, "supabase/config.toml"), "utf8")
      .replace(
        'project_id = "Rochester-Darting-Degens-advanced-statis"',
        `project_id = "${projectId}"`,
      )
      .replace(/5432(\d)/g, "5632$1")
      .replaceAll(":3000", ":3016"),
  );
  const result = spawnSync(cliPath(), localCliArgs("start"), {
    cwd: root,
    env: localDockerEnv(),
    stdio: "pipe",
    windowsHide: true,
  });
  if (result.status !== 0) {
    const safe = (
      String(result.stderr ?? "") +
      "\n" +
      String(result.stdout ?? "")
        .split("\n")
        .filter(
          (line) =>
            /error|failed|port|address|daemon/i.test(line) &&
            !/key|token|secret|password/i.test(line),
        )
        .join("\n")
    )
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted]")
      .replace(/sb_(?:secret|publishable)_[\w-]+/g, "[redacted]");
    throw Error(`Local Supabase startup failed: ${safe.slice(-2500)}`);
  }
  localStatus();
  const container = `supabase_db_${projectId}`;
  const has = (table) =>
    docker([
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-Atqc",
      `select to_regclass('${table}') is not null`,
    ]) === "t";
  for (const file of [
    ...(!has("public.matches")
      ? ["supabase/tests/fixtures/existing_schema_baseline.sql"]
      : []),
    ...(!has("public.league_nights")
      ? [
          "supabase/pending/league_night.sql",
          "supabase/pending/league_night_enforce.sql",
        ]
      : []),
    ...(!has("rdd_private.game_modes_control")
      ? [
          "supabase/tests/fixtures/game_modes.sql",
          "supabase/tests/fixtures/game_modes_local_enable.sql",
        ]
      : []),
    ...(!has("public.solo_games")
      ? ["supabase/tests/fixtures/solo_play.sql"]
      : []),
  ])
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
        windowsHide: true,
      },
    );
  console.log(
    "Solo stack ready on loopback 56321; app port 3016. No hosted target.",
  );
} else if (command === "test") {
  localStatus();
  const result = spawnSync(process.execPath, ["scripts/qa/solo-api.mjs"], {
    cwd: root,
    env: localDockerEnv(),
    stdio: "inherit",
    windowsHide: true,
  });
  process.exitCode = result.status ?? 1;
} else if (["build", "serve", "dev"].includes(command)) {
  const status = localStatus();
  const npmCli =
    process.env.npm_execpath ??
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    );
  const result = spawnSync(
    process.execPath,
    command === "build"
      ? [npmCli, "run", "build"]
      : [
          path.join(root, "node_modules/next/dist/bin/next"),
          ...[
            command === "serve" ? "start" : "dev",
            "--hostname",
            "127.0.0.1",
            "--port",
            "3016",
          ],
        ],
    {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3016",
        RDD_LOCAL_PREVIEW: "1",
        GITHUB_TOKEN: "",
        GITHUB_REPO_OWNER: "",
        GITHUB_REPO_NAME: "",
      },
    },
  );
  process.exitCode = result.status ?? 1;
} else if (command === "status") {
  localStatus();
  console.log("Solo loopback services are healthy.");
} else {
  const result = spawnSync(cliPath(), localCliArgs("stop"), {
    cwd: root,
    env: localDockerEnv(),
    stdio: "pipe",
    windowsHide: true,
  });
  process.exitCode = result.status ?? 1;
}
