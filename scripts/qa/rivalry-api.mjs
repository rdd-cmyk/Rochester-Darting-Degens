import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
process.env.RDD_LOCAL_STACK = "rivalry-room";
const { localStatus, docker, projectId } = await import(
  "../local-environment.mjs"
);
if (projectId !== "rdd-rivalry-room")
  throw Error("An isolated Rivalry Room stack is required.");
const status = localStatus();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(status.API_URL, status.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = existsSync(".local/rivalry-room/demo.json")
  ? JSON.parse(readFileSync(".local/rivalry-room/demo.json", "utf8")).password
  : `Rivalry-${crypto.randomUUID()}!`;
mkdirSync(".local/rivalry-room", { recursive: true });
if (!existsSync(".local/rivalry-room/demo.json"))
  writeFileSync(".local/rivalry-room/demo.json", JSON.stringify({ password }));
const sql = (query) =>
  docker([
    "exec",
    `supabase_db_${projectId}`,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-Atqc",
    query,
  ]);
const unwrap = (result) => {
  if (result.error)
    throw Error(`${result.error.code}: ${result.error.message}`);
  return result.data;
};
let checks = 0;
const ok = (value, label) => {
  assert(value, label);
  checks++;
};
const people = [];
for (const [name, avatar] of [
  ["Ben", "raccoon"],
  ["Mike", "fox"],
  ["Alex", "bull"],
  ["Sam", "owl"],
  ["Guest", null],
]) {
  const email = `rivalry-${name.toLowerCase()}@example.test`;
  const db = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) {
      const users = unwrap(await admin.auth.admin.listUsers()).users;
      const existing = users.find((u) => u.email === email);
      if (!existing) unwrap(created);
      unwrap(await admin.auth.admin.updateUserById(existing.id, { password }));
    }
    signed = await db.auth.signInWithPassword({ email, password });
  }
  const id = unwrap(signed).user.id;
  if (name !== "Guest") {
    sql(
      `INSERT INTO public.league_members(user_id) VALUES('${id}') ON CONFLICT(user_id) DO UPDATE SET status='active';`,
    );
    unwrap(
      await db.from("profiles").upsert({
        id,
        display_name: `Demo ${name}`,
        first_name: "Demo",
        last_name: "Synthetic",
        include_first_name_in_display: false,
      }),
    );
    sql(
      `INSERT INTO public.board_members(user_id,status,role) VALUES('${id}','approved','member') ON CONFLICT(user_id) DO UPDATE SET status='approved';`,
    );
  }
  people.push({ name: `Demo ${name}`, email, id, avatar, db });
}
const [a, b, c, d, guest] = people;
const qaIds = people
  .slice(0, 4)
  .map((p) => "'" + p.id + "'")
  .join(",");
sql(
  `DELETE FROM rivalry_private.events WHERE challenge_id IN (SELECT id FROM rivalry_private.challenges WHERE sender IN (${qaIds})); DELETE FROM rivalry_private.links WHERE challenge_id IN (SELECT id FROM rivalry_private.challenges WHERE sender IN (${qaIds})); DELETE FROM rivalry_private.challenges WHERE sender IN (${qaIds}); DELETE FROM rivalry_private.operations WHERE actor IN (${qaIds});`,
);
const write = (p, client = a.db, op = crypto.randomUUID()) =>
  client.rpc("rdd_rivalry_write", {
    p_operation_id: op,
    p_payload: {
      ...p,
      submitted_by:
        client === a.db
          ? a.id
          : client === b.db
            ? b.id
            : client === c.db
              ? c.id
              : client === d.db
                ? d.id
                : guest.id,
    },
  });
const read = async (id) =>
  unwrap(await a.db.rpc("rdd_rivalry_read", { p_id: id, p_offset: 0 }))
    .challenges[0];
const mutation = (challenge, action, extra = {}) => ({
  action,
  id: challenge.id,
  expected_revision: challenge.revision,
  event_revision: challenge.schedule.event_revision,
  ...extra,
});
ok(
  (await anon.rpc("rdd_rivalry_read")).error != null,
  "Anonymous cannot read rivalries",
);
ok(
  (await guest.db.rpc("rdd_rivalry_read")).error?.code === "42501",
  "Provisional account cannot read rivalries",
);
ok(
  (await guest.db.rpc("rdd_avatar_self")).error?.code === "42501",
  "Provisional account cannot read avatar choices",
);
for (const person of people.slice(0, 4)) {
  const av = unwrap(await person.db.rpc("rdd_avatar_self"));
  unwrap(
    await write(
      {
        action: "avatar",
        avatar_id: person.avatar,
        expected_revision: av.revision,
      },
      person.db,
    ),
  );
}
let av = unwrap(await a.db.rpc("rdd_avatar_self"));
const avatarOp = crypto.randomUUID();
const avatarPayload = {
  action: "avatar",
  avatar_id: "tiger",
  expected_revision: av.revision,
};
unwrap(await write(avatarPayload, a.db, avatarOp));
ok(
  unwrap(await write(avatarPayload, a.db, avatarOp)).replayed,
  "Avatar replay confirms same operation",
);
ok(
  (await write({ ...avatarPayload, avatar_id: "cat" }, a.db, avatarOp)).error
    ?.code === "PT409",
  "Edited avatar retry cannot overwrite earlier save",
);
ok(
  (
    await write({
      ...avatarPayload,
      avatar_id: "made-up",
      expected_revision: av.revision + 1,
    })
  ).error?.code === "22023",
  "Server rejects unknown catalog ID",
);
ok(
  (await write(avatarPayload)).error?.code === "40001",
  "Stale avatar revision rejected",
);
av = unwrap(await a.db.rpc("rdd_avatar_self"));
const avatarRaces = await Promise.all(
  ["fox", "raccoon"].map((avatar_id) =>
    write({ action: "avatar", avatar_id, expected_revision: av.revision }),
  ),
);
ok(
  avatarRaces.filter((r) => !r.error).length === 1 &&
    avatarRaces.filter((r) => r.error?.code === "40001").length === 1,
  "Concurrent avatar saves require a fresh revision",
);
ok(
  (
    await a.db.rpc("rdd_rivalry_write", {
      p_operation_id: crypto.randomUUID(),
      p_payload: {
        action: "avatar",
        avatar_id: "fox",
        expected_revision: 0,
        submitted_by: b.id,
      },
    })
  ).error?.code === "42501",
  "Forged avatar owner rejected",
);
ok(
  unwrap(
    await a.db.from("profiles").select("display_name").eq("id", a.id).single(),
  ).display_name === "Demo Ben",
  "Avatar saves preserve profile names",
);
const night = unwrap(
  await a.db.rpc("rdd_create_night", {
    p_id: crypto.randomUUID(),
    p_title: "Demo Friday Showdown",
    p_venue: "Synthetic Darts Club",
    p_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
  }),
);
sql(
  `INSERT INTO rdd_private.planning_schedules(night_id,starts_at,rsvp_closes_at) VALUES('${night.id}',now()+interval '2 days',now()+interval '1 day');`,
);
let create = {
  action: "create",
  id: crypto.randomUUID(),
  recipient: b.id,
  night_id: night.id,
  game: "501",
  preset: "501-double-v1",
  board: "Steel Tip",
  best_of: 3,
};
const createOp = crypto.randomUUID();
let challenge = unwrap(await write(create, a.db, createOp)).challenge;
ok(challenge.state === "pending", "Challenge invitation created");
ok(
  unwrap(await write(create, a.db, createOp)).replayed,
  "Invitation replay creates no duplicate",
);
ok(
  (await write({ ...create, id: crypto.randomUUID() })).error?.code === "22023",
  "One unfinished challenge per pair and night",
);
ok(
  (await write({ ...create, id: crypto.randomUUID(), recipient: a.id })).error
    ?.code === "22023",
  "Cannot challenge self",
);
ok(
  (await write(mutation(challenge, "accept"))).error?.code === "42501",
  "Sender cannot accept invitation",
);
ok(
  (await write(mutation(challenge, "accept"), c.db)).error?.code === "42501",
  "Nonparticipant cannot accept",
);
const beforeAttendance = sql(
  `SELECT count(*) FROM public.league_night_attendees WHERE night_id='${night.id}'`,
);
challenge = unwrap(await write(mutation(challenge, "accept"), b.db)).challenge;
ok(challenge.state === "accepted", "Recipient accepts");
ok(
  sql(
    `SELECT count(*) FROM public.league_night_attendees WHERE night_id='${night.id}'`,
  ) === beforeAttendance,
  "Acceptance does not change attendance",
);
const config = {
  version: 1,
  preset: "501-double-v1",
  format: "individual",
  context: "competitive",
  status: "completed",
  handicap: false,
  sides: {},
  teamScores: {},
  otherName: "",
  finish: "ordinary",
};
const gamePayload = (ch, winner = a.id) => ({
  submitted_by: a.id,
  challenge_id: ch.id,
  challenge_revision: ch.revision,
  match_id: null,
  expected_revision: null,
  night_id: night.id,
  game_type: "501",
  game_config: config,
  board_type: "Steel Tip",
  venue: "Synthetic Darts Club",
  notes: null,
  played_at: new Date().toISOString(),
  allow_duplicate: true,
  players: [a.id, b.id].map((player_id) => ({
    player_id,
    score: null,
    points_scored: null,
    is_winner: player_id === winner,
  })),
});
const save = (p, id = crypto.randomUUID(), client = a.db) =>
  client.rpc("rdd_save_match", { p_operation_id: id, p_payload: p });
const matchCount = () => sql("SELECT count(*) FROM public.matches");
const countBefore = matchCount();
ok(
  (await save({ ...gamePayload(challenge), board_type: "Soft Tip" })).error
    ?.code === "22023",
  "Wrong board rolls back canonical save",
);
ok(
  matchCount() === countBefore,
  "Rejected linked game creates no orphan match",
);
ok(
  (
    await save({
      ...gamePayload(challenge),
      players: [a.id, c.id].map((player_id) => ({
        player_id,
        score: null,
        points_scored: null,
        is_winner: player_id === a.id,
      })),
    })
  ).error?.code === "22023",
  "Wrong opponent rejected atomically",
);
const saveId = crypto.randomUUID(),
  firstPayload = gamePayload(challenge);
let first = unwrap(await save(firstPayload, saveId));
challenge = first.challenge;
ok(
  challenge.state === "in_progress" && challenge.wins[0] === 1,
  "Saved game and link advance series atomically",
);
ok(
  unwrap(await save(firstPayload, saveId)).replayed,
  "Interrupted game save confirms without a second match",
);
ok(
  (await save({ ...firstPayload, challenge_id: crypto.randomUUID() }, saveId))
    .error?.code === "PT409",
  "Cannot replay a game into a different challenge",
);
let second = unwrap(await save(gamePayload(challenge)));
challenge = second.challenge;
ok(
  challenge.state === "completed" && challenge.winner === a.id,
  "First to two clinches best of three",
);
ok(
  (await save(gamePayload(challenge))).error?.code === "22023",
  "No new games after deciding game",
);
const corrected = {
  ...firstPayload,
  match_id: first.match_id,
  expected_revision: first.revision,
  challenge_id: undefined,
  challenge_revision: undefined,
  players: firstPayload.players.map((p) => ({
    ...p,
    is_winner: p.player_id === b.id,
  })),
};
let correction = unwrap(await save(corrected));
challenge = correction.challenge;
ok(
  challenge.state === "in_progress" &&
    challenge.winner === null &&
    challenge.wins.join(",") === "1,1",
  "Canonical correction removes winner and reopens series",
);
ok(
  (await save({ ...corrected, submitted_by: b.id }, crypto.randomUUID(), b.db))
    .error?.code === "42501",
  "Participant cannot edit another recorder’s game",
);
sql(
  `UPDATE rdd_private.planning_schedules SET event_revision=event_revision+1,starts_at=starts_at+interval '1 hour' WHERE night_id='${night.id}'`,
);
challenge = await read(challenge.id);
ok(
  challenge.state === "needs_reconfirmation",
  "Changed schedule suspends series",
);
ok(
  (await save(gamePayload(challenge))).error?.code === "22023",
  "Cannot play until schedule reconfirmed",
);
challenge = unwrap(await write(mutation(challenge, "reconfirm"))).challenge;
ok(
  challenge.state === "needs_reconfirmation",
  "One confirmation is insufficient",
);
challenge = unwrap(
  await write(mutation(challenge, "reconfirm"), b.db),
).challenge;
ok(challenge.state === "in_progress", "Both players reconfirm updated night");
const sameRev = challenge.revision;
const gameRace = await Promise.all([
  save(gamePayload(challenge)),
  save(gamePayload(challenge)),
]);
ok(
  gameRace.filter((r) => !r.error).length === 1 &&
    gameRace.filter((r) => r.error?.code === "40001").length === 1,
  "Concurrent next games serialize expected challenge revision",
);
challenge = await read(challenge.id);
ok(
  challenge.revision > sameRev && challenge.state === "completed",
  "Race commits one deciding game",
);
// Truth can become ineligible: no stale winner is displayed; link repair is explicit.
const invalid = unwrap(
  await save({
    ...corrected,
    expected_revision: correction.revision,
    game_config: { ...config, context: "practice" },
  }),
);
challenge = invalid.challenge;
ok(
  challenge.state === "needs_review" && challenge.winner === null,
  "Ineligible correction requires review and clears winner",
);
challenge = unwrap(
  await write(
    mutation(challenge, "unlink", {
      match_id: first.match_id,
      match_revision: invalid.revision,
    }),
  ),
).challenge;
ok(
  challenge.state === "completed" && challenge.games.length === 2,
  "Audited unlink recomputes from remaining real games",
);
ok(
  (
    await write(
      mutation(challenge, "unlink", {
        match_id: second.match_id,
        match_revision: second.revision,
      }),
      b.db,
    )
  ).error?.code === "42501",
  "Only result creator can unlink",
);
// Expiry, cooldown and abandonment have no timeout winner.
let cd = unwrap(
  await write({ ...create, id: crypto.randomUUID(), recipient: c.id }),
).challenge;
cd = unwrap(await write(mutation(cd, "decline"), c.db)).challenge;
ok(cd.state === "declined", "Recipient declines invitation");
ok(
  (await write({ ...create, id: crypto.randomUUID(), recipient: c.id })).error
    ?.code === "22023",
  "Decline enforces pair cooldown",
);
let ad = unwrap(
  await write({ ...create, id: crypto.randomUUID(), recipient: d.id }),
).challenge;
ad = unwrap(await write(mutation(ad, "accept"), d.db)).challenge;
ad = unwrap(
  await write(
    mutation(ad, "propose_abandon", { reason: "Demo cannot finish" }),
  ),
).challenge;
ok(
  (await write(mutation(ad, "confirm_abandon"))).error?.code === "42501",
  "Abandonment proposer cannot confirm own request",
);
ad = unwrap(await write(mutation(ad, "confirm_abandon"), d.db)).challenge;
ok(
  ad.state === "abandoned" && ad.winner === null,
  "Other participant confirms abandonment without fabricated winner",
);
let exp = unwrap(
  await write({ ...create, id: crypto.randomUUID(), recipient: d.id }),
).challenge;
sql(
  `UPDATE rivalry_private.challenges SET expires_at=now()-interval '1 second' WHERE id='${exp.id}'`,
);
exp = await read(exp.id);
ok(exp.state === "expired", "Invitation expiry uses server time");
ok(
  (await write(mutation(exp, "accept"), d.db)).error?.code === "42501",
  "Expired invitation cannot be accepted",
);
// Admission revocation still governs both endpoints.
sql(
  `UPDATE public.league_members SET status='revoked' WHERE user_id='${d.id}'`,
);
ok(
  (await d.db.rpc("rdd_rivalry_read")).error?.code === "42501",
  "Revoked member cannot read challenges",
);
sql(`UPDATE public.league_members SET status='active' WHERE user_id='${d.id}'`);
ok(
  (await a.db.from("matches").insert({ game_type: "501" })).error != null,
  "Direct match writes remain closed",
);
ok(
  (await a.db.schema("rivalry_private").from("challenges").select("*")).error !=
    null,
  "Private challenge tables cannot be queried directly",
);
const extraNight = unwrap(
  await a.db.rpc("rdd_create_night", {
    p_id: crypto.randomUUID(),
    p_title: "Demo QA extra night",
    p_venue: "Synthetic Darts Club",
    p_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  }),
);
sql(
  `INSERT INTO rdd_private.planning_schedules(night_id,starts_at,rsvp_closes_at) VALUES('${extraNight.id}',now()+interval '3 days',now()+interval '2 days');`,
);
for (const recipient of [a.id, b.id, c.id])
  unwrap(
    await write(
      {
        ...create,
        id: crypto.randomUUID(),
        recipient,
        night_id: extraNight.id,
      },
      d.db,
    ),
  );
ok(
  (
    await write(
      {
        ...create,
        id: crypto.randomUUID(),
        recipient: b.id,
        night_id: night.id,
      },
      d.db,
    )
  ).error?.code === "22023",
  "Three pending outgoing invitations is the server maximum",
);
const pairRace = await Promise.all([
  write(
    {
      ...create,
      id: crypto.randomUUID(),
      recipient: a.id,
      night_id: extraNight.id,
    },
    b.db,
  ),
  write(
    {
      ...create,
      id: crypto.randomUUID(),
      recipient: a.id,
      night_id: extraNight.id,
    },
    b.db,
  ),
]);
ok(
  pairRace.filter((r) => !r.error).length === 1 &&
    pairRace.filter((r) => r.error?.code === "22023").length === 1,
  "Concurrent pair invitations create one unfinished series",
);
let organizerCase = unwrap(
  await write(
    {
      ...create,
      id: crypto.randomUUID(),
      recipient: b.id,
      night_id: extraNight.id,
    },
    c.db,
  ),
).challenge;
organizerCase = unwrap(
  await write(mutation(organizerCase, "accept"), b.db),
).challenge;
ok(
  (
    await write(
      mutation(organizerCase, "resolve", {
        reason: "Forged organizer",
        role: "organizer",
      }),
      c.db,
    )
  ).error?.code === "42501",
  "Caller cannot claim organizer authority",
);
sql(
  `INSERT INTO rdd_private.planning_organizers(user_id) VALUES('${a.id}') ON CONFLICT DO NOTHING;`,
);
organizerCase = unwrap(
  await write(
    mutation(organizerCase, "resolve", {
      reason: "Synthetic organizer resolution",
    }),
  ),
).challenge;
ok(
  organizerCase.state === "abandoned" && organizerCase.winner === null,
  "Server-owned organizer resolves without fabricated winner",
);
let otherRevoked = unwrap(
  await write({ ...create, id: crypto.randomUUID(), recipient: b.id }),
).challenge;
sql(
  `UPDATE public.league_members SET status='revoked' WHERE user_id='${a.id}'`,
);
ok(
  (await write(mutation(otherRevoked, "accept"), b.db)).error?.code === "42501",
  "Recipient cannot accept after sender admission is revoked",
);
sql(`UPDATE public.league_members SET status='active' WHERE user_id='${a.id}'`);
otherRevoked = unwrap(
  await write(mutation(otherRevoked, "accept"), b.db),
).challenge;
sql(
  `UPDATE public.league_members SET status='revoked' WHERE user_id='${b.id}'`,
);
ok(
  (await save(gamePayload(otherRevoked))).error?.code === "42501",
  "Active recorder cannot play against a revoked participant",
);
sql(`UPDATE public.league_members SET status='active' WHERE user_id='${b.id}'`);
otherRevoked = unwrap(await write(mutation(otherRevoked, "cancel"))).challenge;
ok(
  otherRevoked.state === "cancelled",
  "Either participant can cancel before the first game",
);
let moved = unwrap(
  await write({ ...create, id: crypto.randomUUID(), recipient: b.id }),
).challenge;
sql(
  `UPDATE rdd_private.planning_schedules SET starts_at=now()-interval '1 second',rsvp_closes_at=now()-interval '2 seconds',event_revision=event_revision+1 WHERE night_id='${night.id}'`,
);
ok(
  (await read(moved.id)).state === "expired",
  "Moving a night earlier expires invitations at the new start time",
);
sql(
  `UPDATE rdd_private.planning_schedules SET starts_at=now()+interval '2 days',event_revision=event_revision+1 WHERE night_id='${night.id}'; UPDATE rivalry_private.challenges SET expires_at=now()-interval '1 second' WHERE id='${moved.id}';`,
);
let declineStop = unwrap(
  await write({ ...create, id: crypto.randomUUID(), recipient: b.id }),
).challenge;
declineStop = unwrap(
  await write(mutation(declineStop, "accept"), b.db),
).challenge;
declineStop = unwrap(
  await write(
    mutation(declineStop, "propose_abandon", { reason: "Demo proposal" }),
  ),
).challenge;
declineStop = unwrap(
  await write(mutation(declineStop, "decline_abandon"), b.db),
).challenge;
ok(
  declineStop.abandonment_by === null && declineStop.state === "accepted",
  "Declining abandonment allows play to resume",
);
declineStop = unwrap(await write(mutation(declineStop, "cancel"))).challenge;
ok(
  sql(
    "SELECT bool_and(relrowsecurity) FROM pg_class WHERE relnamespace='rivalry_private'::regnamespace AND relkind='r'",
  ) === "t",
  "All private Rivalry tables enable RLS",
);
// Populate a convincing but explicitly synthetic preview using canonical games.
if (
  sql(
    `SELECT count(*) FROM public.matches WHERE notes='rivalry-demo-history'`,
  ) === "0"
) {
  for (const [opponent, wins, losses] of [
    [b, 12, 12],
    [c, 8, 11],
    [d, 9, 7],
  ])
    for (let i = 0; i < wins + losses; i++) {
      const payload = {
        ...gamePayload(challenge),
        challenge_id: undefined,
        challenge_revision: undefined,
        night_id: null,
        game_config: null,
        notes: "rivalry-demo-history",
        played_at: new Date(
          Date.now() - (wins + losses - i) * 86400000,
        ).toISOString(),
        players: [a.id, opponent.id].map((player_id) => ({
          player_id,
          score: player_id === a.id ? 60 + (i % 20) : 58 + (i % 22),
          points_scored: null,
          is_winner:
            player_id ===
            ((i % 2 === 0 && i / 2 < wins) || i >= losses * 2
              ? a.id
              : opponent.id),
        })),
      };
      // Exact counts, with alternating finishes for the close series.
      const awin = i < wins;
      payload.players = payload.players.map((p) => ({
        ...p,
        is_winner: p.player_id === (awin ? a.id : opponent.id),
      }));
      unwrap(await save(payload));
    }
}
av = unwrap(await a.db.rpc("rdd_avatar_self"));
unwrap(
  await write({
    action: "avatar",
    avatar_id: "raccoon",
    expected_revision: av.revision,
  }),
);
mkdirSync(".local/rivalry-room", { recursive: true });
writeFileSync(
  ".local/rivalry-room/demo.json",
  JSON.stringify(
    {
      password,
      people: people
        .slice(0, 4)
        .map(({ id, email, name }) => ({ id, email, name })),
      nightId: night.id,
      challengeId: challenge.id,
    },
    null,
    2,
  ),
);
writeFileSync(
  ".local/rivalry-room/api-evidence.json",
  JSON.stringify(
    { date: new Date().toISOString(), checks, projectId, apiPort: 56621 },
    null,
    2,
  ),
);
console.log(
  `${checks} isolated Rivalry Room API checks passed. Synthetic preview accounts saved in the ignored local demo file.`,
);
