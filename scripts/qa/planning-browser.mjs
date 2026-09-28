// Synthetic, loopback-only acceptance. Requires planning stack and built app.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
process.env.RDD_LOCAL_STACK = "league-planning";
const { localStatus, docker, projectId, root } = await import(
  "../local-environment.mjs"
);
const status = localStatus();
const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT)
  throw new Error(
    "Set RDD_PLAYWRIGHT_ROOT to an installed Playwright package.",
  );
const { chromium } = require(process.env.RDD_PLAYWRIGHT_ROOT);
const output = path.join(root, ".qa-artifacts", "planning");
mkdirSync(output, { recursive: true });
const run = Date.now();
const password = "Local-Planning-QA-2026!";
const summary = [];
const errors = [];
const unwrap = ({ data, error }) => {
  if (error) throw new Error(`${error.code}: ${error.message}`);
  return data;
};
async function account(name) {
  const db = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `planning-${name.toLowerCase()}-${run}@example.test`;
  const auth = unwrap(await db.auth.signUp({ email, password }));
  assert(auth.session);
  unwrap(
    await db.from("profiles").upsert({
      id: auth.user.id,
      display_name: `QA ${name}`,
      include_first_name_in_display: false,
    }),
  );
  return { db, id: auth.user.id, email };
}
async function write(person, action, payload, id = crypto.randomUUID()) {
  return person.db.rpc("rdd_planning_write", {
    p_operation_id: id,
    p_action: action,
    p_payload: { ...payload, actor_id: person.id },
  });
}
async function feed(person) {
  return unwrap(await person.db.rpc("rdd_planning_read"));
}
async function signIn(page, person) {
  await page.goto("http://127.0.0.1:3030/auth");
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL("**/matches");
  await page.goto("http://127.0.0.1:3030/league-night/plan");
  await page
    .getByRole("heading", { name: "Make the next night happen." })
    .waitFor();
  await page.getByText(/Updated /).waitFor();
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const organizer = await account("Organizer"),
    member = await account("Member"),
    other = await account("Other");
  assert.match(organizer.id, /^[0-9a-f-]{36}$/);
  docker([
    "exec",
    `supabase_db_${projectId}`,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `INSERT INTO rdd_private.planning_organizers(user_id) VALUES ('${organizer.id}');`,
  ]);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["http://127.0.0.1:3030", "http://127.0.0.1:55821"].includes(
      url.origin,
    )
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page, organizer);
  await page.getByRole("button", { name: "Create poll", exact: true }).click();
  const editor = page.getByRole("region", { name: "Poll editor" });
  await editor.getByLabel("Poll title").fill(`QA choose a night ${run}`);
  await editor
    .getByLabel("Voting closes (Rochester time)")
    .fill("2090-10-01T20:00");
  await editor
    .getByLabel("Date option 1 (Rochester time)")
    .fill("2090-10-09T19:00");
  await editor.getByLabel("Venue option 2").fill("QA local hall");
  await editor
    .getByRole("button", { name: "Publish poll", exact: true })
    .click();
  await editor.waitFor({ state: "hidden" });
  await page
    .getByRole("heading", { name: `QA choose a night ${run}` })
    .waitFor();
  let data = await feed(organizer);
  let poll = data.polls.find((p) => p.title === `QA choose a night ${run}`);
  assert(poll);
  const denied = await write(member, "close_poll", {
    poll_id: poll.id,
    revision: poll.revision,
  });
  assert.equal(denied.error.code, "42501");
  const optionIds = poll.options.map((o) => o.id);
  unwrap(
    await write(member, "vote", {
      poll_id: poll.id,
      revision: 0,
      options: optionIds,
    }),
  );
  unwrap(
    await write(other, "vote", {
      poll_id: poll.id,
      revision: 0,
      options: [optionIds[0]],
    }),
  );
  data = await feed(other);
  assert.deepEqual(data.polls.find((p) => p.id === poll.id).mine, [
    optionIds[0],
  ]);
  assert.deepEqual(data.polls.find((p) => p.id === poll.id).pairs, []);
  data = await feed(organizer);
  poll = data.polls.find((p) => p.id === poll.id);
  assert.equal(poll.pairs[0].support, 1);
  const suggestions = await Promise.all(
    ["One", "Two", "Three"].map((name) =>
      write(member, "suggest", {
        poll_id: poll.id,
        kind: "venue",
        venue: `QA ${name}`,
      }),
    ),
  );
  assert.equal(suggestions.filter((r) => !r.error).length, 2);
  assert.equal(suggestions.filter((r) => r.error?.code === "PT422").length, 1);
  summary.push(
    "Publish both-category poll through UI; member authorization; private ballots; aggregate overlap; 3 concurrent suggestions yield exactly 2 accepted.",
  );
  const draftId = crypto.randomUUID();
  const privateTitle = `QA private draft ${run}`;
  unwrap(
    await write(organizer, "save_poll", {
      poll_id: draftId,
      revision: 0,
      title: privateTitle,
      scope: "venue",
      publish: false,
      fixed_start_local: "2090-11-01T19:00",
      options: [{ kind: "venue", venue: "QA unpublished hall" }],
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const draftCard = page
    .getByRole("heading", { name: privateTitle })
    .locator("..");
  await draftCard.getByText("Organizer controls", { exact: true }).click();
  await draftCard
    .getByRole("button", { name: "Cancel poll", exact: true })
    .click();
  await draftCard.getByRole("button", { name: "Confirm cancellation" }).click();
  await draftCard.getByText("Cancelled", { exact: true }).waitFor();
  assert.equal(
    (await feed(organizer)).polls.find((p) => p.id === draftId).status,
    "cancelled",
  );
  assert.equal(
    (await feed(member)).polls.some((p) => p.id === draftId),
    false,
  );
  summary.push(
    "Cancel unpublished draft through organizer UI; history stays visible to organizer and absent from member feed.",
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const pollCard = page
    .getByRole("heading", { name: `QA choose a night ${run}` })
    .locator("..");
  await pollCard.getByText("Organizer controls", { exact: true }).click();
  await pollCard.getByRole("button", { name: "Close voting now" }).click();
  await pollCard
    .getByRole("button", { name: "Confirm close", exact: true })
    .click();
  await pollCard
    .getByRole("button", { name: "Review results & schedule" })
    .click();
  const schedule = page.getByRole("region", { name: "Night editor" });
  await schedule.getByLabel("Night name").fill(`QA scheduled ${run}`);
  await schedule.getByRole("button", { name: "Confirm & schedule" }).click();
  await schedule.waitFor({ state: "hidden" });
  data = await feed(organizer);
  let night = data.nights.find((n) => n.title === `QA scheduled ${run}`);
  assert(night);
  assert.equal(night.responses.length, 0);
  const duplicate = await write(organizer, "schedule", {
    poll_id: poll.id,
    title: "Duplicate",
    date_option: optionIds.find(
      (id) => poll.options.find((o) => o.id === id).kind === "date",
    ),
    venue_option: optionIds.find(
      (id) => poll.options.find((o) => o.id === id).kind === "venue",
    ),
  });
  assert.equal(duplicate.error.code, "PT409");
  summary.push(
    "Manual close and schedule in UI; no RSVP copied from votes; duplicate scheduling blocked.",
  );
  const memberContext = await browser.newContext({
    viewport: { width: 390, height: 1000 },
  });
  await memberContext.route("**/*", (route) =>
    ["http://127.0.0.1:3030", "http://127.0.0.1:55821"].includes(
      new URL(route.request().url()).origin,
    )
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  const memberPage = await memberContext.newPage();
  memberPage.on("pageerror", (e) => errors.push(e.message));
  await signIn(memberPage, member);
  assert.equal(
    await memberPage
      .getByRole("button", { name: "Create poll", exact: true })
      .count(),
    0,
  );
  const nightCard = memberPage
    .getByRole("heading", { name: `QA scheduled ${run}` })
    .locator("..")
    .locator("..");
  await nightCard.getByRole("button", { name: "Going", exact: true }).click();
  await nightCard.getByText("Your response: Going", { exact: true }).waitFor();
  await nightCard
    .getByRole("button", { name: "Not going", exact: true })
    .click();
  await nightCard
    .getByText("Your response: Not going", { exact: true })
    .waitFor();
  assert.equal(
    await memberPage
      .getByRole("button", { name: "Maybe", exact: true })
      .count(),
    0,
  );
  // Inject a committed response loss. The retry must reuse the exact operation.
  let intercepted = false;
  let submitted;
  await memberPage.route("**/rest/v1/rpc/rdd_planning_write", async (route) => {
    if (!intercepted) {
      intercepted = true;
      submitted = route.request().postDataJSON();
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await nightCard.getByRole("button", { name: "Going", exact: true }).click();
  await memberPage.getByText(/Confirmation was interrupted/).waitFor();
  const pending = await memberPage.evaluate(
    (id) => JSON.parse(localStorage.getItem(`rdd-planning-pending-v1:${id}`)),
    member.id,
  );
  assert.equal(pending.id, submitted.p_operation_id);
  await memberPage
    .getByRole("button", { name: "Check / retry saved request" })
    .click();
  await memberPage.getByText("Saved.", { exact: true }).waitFor();
  data = await feed(member);
  night = data.nights.find((n) => n.night_id === night.night_id);
  assert.equal(night.mine.revision, 3);
  assert.equal(night.responses.length, 1);
  assert.equal(night.mine.going, true);
  summary.push(
    "Member mobile RSVP Going / Not going; committed response-loss recovery does not duplicate or advance revision twice.",
  );
  // Simulate an early cutoff passing on this run's synthetic future night.
  assert.match(night.night_id, /^[0-9a-f-]{36}$/);
  docker([
    "exec",
    `supabase_db_${projectId}`,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `UPDATE rdd_private.planning_schedules SET rsvp_closes_at=clock_timestamp()-interval '1 hour' WHERE night_id='${night.night_id}';`,
  ]);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const organizerNight = page
    .getByRole("heading", { name: night.title })
    .locator("..")
    .locator("..");
  await organizerNight.getByText("Manage night", { exact: true }).click();
  await organizerNight
    .getByRole("button", { name: "Edit night", exact: true })
    .click();
  await schedule.getByLabel("Venue", { exact: true }).fill("QA changed hall");
  await schedule
    .getByLabel("Date & time (Rochester time)")
    .fill("2090-10-10T19:00");
  await schedule
    .getByText(/Choose a future RSVP cutoff or leave it blank/)
    .waitFor();
  assert.equal(
    await schedule
      .getByRole("button", { name: "Save night changes" })
      .isDisabled(),
    true,
  );
  await schedule.getByLabel("RSVP cutoff (optional, Rochester time)").fill("");
  await schedule.getByRole("button", { name: "Save night changes" }).click();
  await schedule.waitFor({ state: "hidden" });
  summary.push(
    "Event edit after early RSVP cutoff is blocked with guidance until organizer explicitly clears the cutoff.",
  );
  await memberPage
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await nightCard
    .getByText("The date or venue changed. Please respond again.")
    .waitFor();
  await nightCard.getByRole("button", { name: "Going", exact: true }).click();
  await nightCard.getByText("Your response: Going", { exact: true }).waitFor();
  await nightCard.getByRole("link", { name: "Open this league night" }).click();
  await memberPage.waitForURL(`**/league-night?night=${night.night_id}`);
  await memberPage.getByText("Who’s here?", { exact: true }).waitFor();
  const attendance = unwrap(
    await member.db
      .from("league_night_attendees")
      .select("*")
      .eq("night_id", night.night_id),
  );
  assert.equal(attendance.length, 0);
  summary.push(
    "Reschedule invalidates prior response; explicit reconfirmation; link opens same League Night; RSVP does not populate actual attendance.",
  );
  await memberPage.goto("http://127.0.0.1:3030/league-night/plan");
  await memberPage.getByText(/Updated /).waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await memberPage.setViewportSize({ width, height: 1100 });
    assert.equal(
      await memberPage.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `overflow ${width}`,
    );
    if (width === 390 || width === 1440)
      await memberPage.screenshot({
        path: path.join(output, `planning-${width}.png`),
        fullPage: true,
      });
  }
  await memberPage.emulateMedia({ colorScheme: "dark" });
  await memberPage.screenshot({
    path: path.join(output, "planning-dark.png"),
    fullPage: true,
  });
  summary.push(
    "No horizontal overflow at 320, 390, 768, 1440 pixels; desktop/mobile/dark screenshots captured.",
  );
  // Additional API lifecycle modes use the same actual database contract.
  for (const scope of ["date", "venue"]) {
    const id = crypto.randomUUID();
    const options =
      scope === "date"
        ? [{ kind: "date", starts_local: "2090-11-01T19:00" }]
        : [{ kind: "venue", venue: "QA fixed-date hall" }];
    unwrap(
      await write(organizer, "save_poll", {
        poll_id: id,
        revision: 0,
        title: `QA ${scope} ${run}`,
        scope,
        publish: true,
        options,
        fixed_venue: scope === "date" ? "QA fixed venue" : null,
        fixed_start_local: scope === "venue" ? "2090-11-01T19:00" : null,
      }),
    );
    unwrap(await write(organizer, "close_poll", { poll_id: id, revision: 1 }));
    const p = (await feed(organizer)).polls.find((p) => p.id === id);
    unwrap(
      await write(organizer, "schedule", {
        poll_id: id,
        title: `QA ${scope} night ${run}`,
        date_option: scope === "date" ? p.options[0].id : null,
        venue_option: scope === "venue" ? p.options[0].id : null,
      }),
    );
  }
  const op = crypto.randomUUID();
  const payload = {
    title: `QA direct ${run}`,
    starts_local: "2090-12-01T19:00",
    venue: "QA direct hall",
  };
  const created = unwrap(await write(organizer, "schedule", payload, op));
  const replay = unwrap(await write(organizer, "schedule", payload, op));
  assert.equal(created.night_id, replay.night_id);
  assert(replay.replayed);
  unwrap(
    await write(organizer, "cancel_night", {
      night_id: created.night_id,
      revision: 1,
    }),
  );
  const cancelled = await write(member, "rsvp", {
    night_id: created.night_id,
    event_revision: 1,
    revision: 0,
    going: true,
  });
  assert.equal(cancelled.error.code, "PT410");
  await memberPage.goto("http://127.0.0.1:3030/league-night");
  await memberPage
    .getByRole("button", { name: new RegExp(payload.title) })
    .getByText("Cancelled", { exact: true })
    .waitFor();
  await memberPage.goto(
    `http://127.0.0.1:3030/league-night?night=${created.night_id}`,
  );
  await memberPage
    .getByText("This league night was cancelled.", { exact: true })
    .waitFor();
  summary.push(
    "Date-only, venue-only, direct scheduling, idempotent schedule replay, cancellation, cancelled RSVP denial, and cancellation shown in lobby and direct night link.",
  );
  // Only this browser response is synthetic; no near-start records are persisted.
  // Server time differs from the device so the card must use its accepted offset.
  const calendarRead = "**/rest/v1/rpc/rdd_planning_read";
  const serverSkew = 60 * 60 * 1000;
  const rolloverAt = Date.now() + serverSkew + 6000;
  await memberPage.route(calendarRead, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        organizer: false,
        server_now: new Date(Date.now() + serverSkew).toISOString(),
        polls: [],
        poll_total: 0,
        night_total: 2,
        nights: [
          {
            ...night,
            title: `QA starting soon ${run}`,
            starts_at: new Date(rolloverAt).toISOString(),
          },
          {
            ...night,
            night_id: crypto.randomUUID(),
            title: `QA following night ${run}`,
            starts_at: new Date(rolloverAt + 600000).toISOString(),
          },
        ],
      }),
    }),
  );
  await memberPage.goto("http://127.0.0.1:3030/league-night");
  const nextCard = memberPage
    .getByRole("heading", { name: "Next on the calendar" })
    .locator("..");
  await nextCard.getByText(new RegExp(`QA starting soon ${run}`)).waitFor();
  await nextCard
    .getByText(new RegExp(`QA following night ${run}`))
    .waitFor({ timeout: 10000 });
  assert.equal(
    await nextCard.getByText(new RegExp(`QA starting soon ${run}`)).count(),
    0,
  );
  await memberPage.unroute(calendarRead);
  summary.push(
    "Lobby calendar advances without focus at a server-adjusted event start; mocked browser read only, no near-start database mutation.",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify(
      { at: new Date().toISOString(), checks: summary, pageErrors: errors },
      null,
      2,
    ),
  );
  console.log(summary.join("\n"));
} finally {
  await browser.close();
}
