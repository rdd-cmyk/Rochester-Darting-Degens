// Refresh functions on this feature's isolated stack only. Never a hosted target.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
process.env.RDD_LOCAL_STACK = "rivalry-room";
const { localStatus, projectId, dockerHost, localDockerEnv } = await import(
  "../local-environment.mjs"
);
localStatus();
if (projectId !== "rdd-rivalry-room") throw Error("Wrong local project");
const sql = readFileSync("supabase/tests/fixtures/rivalry_room.sql", "utf8");
const functions =
  sql.slice(
    sql.indexOf("CREATE FUNCTION rivalry_private.eligible"),
    sql.indexOf("-- Preserve the existing recorder"),
  ) + sql.slice(sql.indexOf("CREATE FUNCTION public.rdd_save_match"));
const triggers =
  "DROP TRIGGER IF EXISTS rivalry_match_changed ON public.matches; DROP TRIGGER IF EXISTS rivalry_match_deleted ON public.matches; DROP TRIGGER IF EXISTS rivalry_player_changed ON public.match_players;\n";
const policies = sql.slice(
  sql.indexOf("ALTER TABLE rivalry_private.avatar_catalog"),
  sql.indexOf("CREATE FUNCTION rivalry_private.eligible"),
);
execFileSync(
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
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "-",
  ],
  {
    input:
      "BEGIN;\n" +
      policies +
      triggers +
      functions.replaceAll("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"),
    env: localDockerEnv(),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  },
);
console.log("Refreshed isolated Rivalry Room function fixture.");
