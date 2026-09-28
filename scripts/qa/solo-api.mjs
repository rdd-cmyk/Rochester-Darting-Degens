import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
process.env.RDD_LOCAL_STACK = "solo";
const { localStatus, soloLocal, docker, projectId } = await import("../local-environment.mjs");
if (!soloLocal) throw Error("Isolated solo stack required.");
const status = localStatus();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// Synthetic credentials live only in the ignored demo file, never tracked.
const password = existsSync(".local/solo/demo.json")
  ? JSON.parse(readFileSync(".local/solo/demo.json", "utf8")).password
  : `Solo-${crypto.randomUUID()}!`;
const people = [];
let checks = 0;
const ok = (condition, message) => {
  assert(condition, message);
  checks++;
};
const unwrap = (result) => {
  if (result.error)
    throw Error(`${result.error.code}: ${result.error.message}`);
  return result.data;
};
for (const name of ["Ace", "Bee"]) {
  const email = `solo-${name.toLowerCase()}@example.test`,
    db = createClient(status.API_URL, status.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  let signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) {
    unwrap(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Demo ${name}`,
          first_name: "Demo",
          last_name: "Synthetic",
        },
      }),
    );
    signed = await db.auth.signInWithPassword({ email, password });
  }
  const auth = unwrap(signed);
  // Admit only these explicitly fictional local QA accounts, never all users.
  docker(["exec", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-Atqc",
    `insert into public.league_members(user_id) values('${auth.user.id}') on conflict(user_id) do update set status='active'`]);
  unwrap(
    await db.from("profiles").upsert({
      id: auth.user.id,
      display_name: `Demo ${name}`,
      first_name: "Demo",
      last_name: "Synthetic",
      include_first_name_in_display: false,
    }),
  );
  people.push({ id: auth.user.id, email, name: `Demo ${name}`, db });
}
const [a, b] = people,
  db = a.db;
const night = unwrap(
  await db.rpc("rdd_create_night", {
    p_id: crypto.randomUUID(),
    p_title: "Solo practice QA",
    p_venue: "Synthetic venue",
    p_date: "2026-09-24",
  }),
);
const snapshot = () =>
  db.from("matches").select("*,match_players(*)").order("id");
const before = unwrap(await snapshot());
const payload = {
  action: "save",
  submitted_by: a.id,
  id: crypto.randomUUID(),
  session_id: crypto.randomUUID(),
  expected_revision: null,
  played_at: "2026-09-24T22:30:00Z",
  completed_at: "2026-09-24T22:40:00Z",
  timezone: "America/New_York",
  game_type: "501",
  board_type: "Steel Tip",
  preset: "501-double-v1",
  status: "completed",
  score: 20,
  score_unit: "PPD",
  raw_total: null,
  darts: null,
  include_in_stats: true,
  night_id: night.id,
  share_with_night: true,
  notes: "PRIVATE-NOTE",
  location: "PRIVATE-LOCATION",
};
const write = (p, op = crypto.randomUUID(), client = db) =>
  client.rpc("rdd_solo_write", { p_operation_id: op, p_payload: p });
const operation = crypto.randomUUID(),
  saved = unwrap(await write(payload, operation));
ok(saved.revision === 1, "Create solo game");
ok(
  unwrap(await write(payload, operation)).replayed,
  "Retry returns committed outcome",
);
ok(
  (await write({ ...payload, score: 30 }, operation)).error?.code === "PT409",
  "Edited retry rejected",
);
ok(
  unwrap(await db.from("solo_games").select("*").eq("id", payload.id))
    .length === 1,
  "One row after retry",
);
const simultaneousPayload = {
  ...payload,
  id: crypto.randomUUID(),
  night_id: null,
  share_with_night: false,
};
const simultaneousOperation = crypto.randomUUID();
const simultaneous = await Promise.all([
  write(simultaneousPayload, simultaneousOperation),
  write(simultaneousPayload, simultaneousOperation),
]);
ok(
  simultaneous.every((r) => !r.error) &&
    simultaneous.filter((r) => r.data.replayed).length === 1,
  "Concurrent identical retries commit once",
);
const revisions = await Promise.all([
  write({ ...simultaneousPayload, expected_revision: 1, score: 22 }),
  write({ ...simultaneousPayload, expected_revision: 1, score: 23 }),
]);
ok(
  revisions.filter((r) => !r.error).length === 1 &&
    revisions.filter((r) => r.error?.code === "40001").length === 1,
  "Concurrent edits permit only one expected revision",
);
ok(
  unwrap(await b.db.from("solo_games").select("*").eq("id", payload.id))
    .length === 0,
  "Other account cannot read private row",
);
ok(
  (await b.db.from("solo_games").update({ score: 1 }).eq("id", payload.id))
    .error != null,
  "No direct writes",
);
ok(
  (
    await write(
      { ...payload, submitted_by: b.id, expected_revision: 1 },
      crypto.randomUUID(),
      b.db,
    )
  ).error?.code === "42501",
  "Cross-owner edit blocked",
);
ok(
  unwrap(await b.db.rpc("rdd_solo_profile", { p_owner: a.id })) === null,
  "Profile summaries private by default",
);
const activity = unwrap(
  await b.db.rpc("rdd_solo_night", { p_night: night.id }),
);
ok(
  activity.find((g) => g.id === payload.id)?.score === 60,
  "Night projection normalizes PPD",
);
ok(
  !JSON.stringify(activity).includes("PRIVATE-"),
  "Projection removes notes/location",
);
unwrap(await db.rpc("rdd_set_solo_visibility", { p_shared: true }));
const visible = unwrap(await b.db.rpc("rdd_solo_profile", { p_owner: a.id }));
ok(
  visible.some((c) => c.game_type === "501" && c.score_sum >= 60),
  "Consent permits aggregates",
);
ok(
  !JSON.stringify(visible).includes(payload.id) &&
    !JSON.stringify(visible).includes("PRIVATE-"),
  "Summary reveals no individual history",
);
const edited = unwrap(
  await write({
    ...payload,
    expected_revision: 1,
    include_in_stats: false,
    share_with_night: false,
  }),
);
ok(edited.revision === 2, "Edit increments revision");
ok(
  (await write({ ...payload, expected_revision: 1 })).error?.code === "40001",
  "Stale edit rejected",
);
ok(
  !unwrap(await b.db.rpc("rdd_solo_night", { p_night: night.id })).some(
    (g) => g.id === payload.id,
  ),
  "Unsharing removes night activity",
);
const deleted = unwrap(
  await write({
    action: "delete",
    submitted_by: a.id,
    id: payload.id,
    expected_revision: 2,
  }),
);
ok(deleted.deleted && deleted.revision === 3, "Deletion confirmed");
const oldRetry = unwrap(await write(payload, operation));
ok(
  oldRetry.deleted && oldRetry.replayed,
  "Replay does not resurrect deleted game",
);
ok(
  unwrap(
    await write({
      action: "restore",
      submitted_by: a.id,
      id: payload.id,
      expected_revision: 3,
    }),
  ).revision === 4,
  "Undo restores with revision",
);
for (const changes of [
  { score: 61 },
  { score: 0, score_unit: "MPR" },
  {
    game_type: "Cricket",
    preset: "501-double-v1",
    score_unit: "MPR",
    score: 2,
  },
  { darts: 4, raw_total: null },
  { darts: 0, raw_total: 50 },
  { darts: 2.5, raw_total: 50 },
  { darts: 30, raw_total: 500.5 },
  { completed_at: "2026-09-24T20:00:00Z" },
  { timezone: "Fake/Zone" },
  { night_id: crypto.randomUUID() },
  { played_at: "2026-09-23T22:30:00Z" },
  { ranked: true },
  { submitted_by: b.id },
])
  ok(
    (await write({ ...payload, id: crypto.randomUUID(), ...changes })).error !=
      null,
    "Invalid request rejected",
  );
const anon = createClient(status.API_URL, status.ANON_KEY, {
  auth: { persistSession: false },
});
ok(
  (await write(payload, crypto.randomUUID(), anon)).error != null,
  "Signed-out writes blocked",
);
ok(
  (await anon.rpc("rdd_solo_night", { p_night: night.id })).error != null,
  "Signed-out activity blocked",
);
assert.deepEqual(unwrap(await snapshot()), before);
checks++;
unwrap(await db.rpc("rdd_set_solo_visibility", { p_shared: false }));
// Populate enough fictional history to exercise the real analysis surface.
const seed = await db
  .from("solo_games")
  .select("id")
  .eq("notes", "Seed practice trend")
  .limit(1);
if (!unwrap(seed).length) {
  for (let i = 0; i < 20; i++) {
    const date = new Date(Date.UTC(2026, 2, 5 + i * 7))
      .toISOString()
      .slice(0, 10);
    const n = unwrap(
      await db.rpc("rdd_create_night", {
        p_id: crypto.randomUUID(),
        p_title: `Synthetic Thursday ${i + 1}`,
        p_venue: "Local only",
        p_date: date,
      }),
    );
    const practice = i % 2 ? 4 : 1;
    for (let j = 0; j < practice; j++) {
      const at = new Date(
        Date.UTC(2026, 2, 2 + i * 7, 20, j * 12),
      ).toISOString();
      unwrap(
        await write({
          ...payload,
          id: crypto.randomUUID(),
          session_id: crypto.randomUUID(),
          night_id: null,
          share_with_night: false,
          played_at: at,
          completed_at: null,
          score_unit: "3DA",
          score: 48 + i * 0.6 + j,
          notes: "Seed practice trend",
          location: "",
        }),
      );
    }
    for (let j = 0; j < 3; j++)
      unwrap(
        await db.rpc("rdd_save_match", {
          p_operation_id: crypto.randomUUID(),
          p_payload: {
            submitted_by: a.id,
            match_id: null,
            expected_revision: null,
            night_id: n.id,
            played_at: `${date}T23:${String(j * 10).padStart(2, "0")}:00Z`,
            game_type: "501",
            board_type: "Steel Tip",
            venue: "Local only",
            notes: "Synthetic solo comparison",
            allow_duplicate: true,
            game_config: {
              version: 1,
              format: "individual",
              context: "competitive",
              status: "completed",
              handicap: false,
              preset: "501-double-v1",
              sides: {},
              teamScores: {},
              otherName: "",
              finish: "ordinary",
            },
            players: [
              {
                player_id: a.id,
                score: 50 + i * 0.3 + (practice === 4 ? 2 : 0) + j,
                is_winner: j !== 1,
                points_scored: null,
              },
              {
                player_id: b.id,
                score: 45 + j,
                is_winner: j === 1,
                points_scored: null,
              },
            ],
          },
        }),
      );
  }
}
// Add a third practice count to already-seeded demo history; this is fictional
// variation for exercising the conservative insight, never a production claim.
const variation = unwrap(
  await db
    .from("solo_games")
    .select("id")
    .eq("notes", "Seed practice variation")
    .limit(1),
);
if (!variation.length)
  unwrap(
    await write({
      ...payload,
      id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      played_at: "2026-04-13T20:30:00Z",
      completed_at: null,
      score: 56,
      score_unit: "3DA",
      night_id: null,
      share_with_night: false,
      notes: "Seed practice variation",
      location: "",
    }),
  );
mkdirSync(".local/solo", { recursive: true });
writeFileSync(
  ".local/solo/demo.json",
  JSON.stringify({
    people: people.map((p) => ({ id: p.id, email: p.email, name: p.name })),
    password,
    nightId: night.id,
  }),
);
console.log(
  `${checks} local API checks passed: ownership, privacy, canonical retries, stale edits, deletion/recovery, night consent, validation and unchanged competitive rows. Synthetic demo ready.`,
);
