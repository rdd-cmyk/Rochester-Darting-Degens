import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { localStatus, leagueNightLocal, root } from "../local-environment.mjs";
const require = createRequire(import.meta.url);
const { test, expect } = require(
  path.join(process.env.RDD_PLAYWRIGHT_ROOT, "test.js"),
);
if (!leagueNightLocal)
  throw new Error("League Night QA requires its isolated local stack.");
const status = localStatus();
const password = "Local-Darts-Demo-2026!"; // Synthetic localhost accounts only.
const unwrap = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
async function account(name) {
  const db = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `night-${name.toLowerCase()}@example.test`;
  let auth = await db.auth.signInWithPassword({ email, password });
  if (auth.error)
    auth = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: `Demo ${name}`,
          first_name: "Demo",
          last_name: "Synthetic",
          include_first_name_in_display: false,
        },
      },
    });
  const data = unwrap(auth);
  if (!data.session) throw new Error("Expected local-only session.");
  unwrap(
    await db.from("profiles").upsert({
      id: data.user.id,
      display_name: `Demo ${name}`,
      first_name: "Demo",
      last_name: "Synthetic",
      include_first_name_in_display: false,
    }),
  );
  return { db, id: data.user.id, email };
}
async function isolate(context) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["http://127.0.0.1:3010", "http://127.0.0.1:55421"].includes(
      url.origin,
    )
      ? route.continue()
      : route.abort("blockedbyclient");
  });
}
async function signIn(page, person) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form button[type=submit]").click();
  await expect(
    page.getByRole("heading", { name: "Darts Matches", exact: true }),
  ).toBeVisible();
}
let ben, tim;
test.beforeAll(async () => {
  ben = await account("Ben");
  tim = await account("Tim");
  await account("Alex");
});
function payload(nightId, options = {}) {
  return {
    match_id: null,
    expected_revision: null,
    night_id: nightId,
    played_at: new Date(Date.now() - 60000).toISOString(),
    game_type: "501",
    board_type: "Soft Tip",
    venue: "Local only",
    notes: "Synthetic League Night QA",
    players: [
      { player_id: ben.id, score: 60, points_scored: null, is_winner: true },
      { player_id: tim.id, score: 50, points_scored: null, is_winner: false },
    ],
    allow_duplicate: false,
    ...options,
  };
}
async function createNight(owner = ben) {
  return unwrap(
    await owner.db.rpc("rdd_create_night", {
      p_id: crypto.randomUUID(),
      p_title: "Synthetic League Night QA",
      p_venue: "Local only",
      p_date: "2026-09-26",
    }),
  );
}
test("concurrent transactions, independent recorders, ownership and stale versions", async () => {
  const night = await createNight();
  const p = payload(night.id);
  const operation = crypto.randomUUID();
  const retries = await Promise.all(
    Array.from({ length: 4 }, () =>
      ben.db.rpc("rdd_save_match", { p_operation_id: operation, p_payload: p }),
    ),
  );
  const results = retries.map(unwrap);
  expect(new Set(results.map((r) => r.match_id)).size).toBe(1);
  expect(
    unwrap(await ben.db.from("matches").select("id").eq("night_id", night.id)),
  ).toHaveLength(1);
  const competing = await Promise.all(
    [ben, tim].map((person) =>
      person.db.rpc("rdd_save_match", {
        p_operation_id: crypto.randomUUID(),
        p_payload: {
          ...p,
          played_at: new Date(Date.now() - 600000).toISOString(),
        },
      }),
    ),
  );
  expect(
    competing
      .map(unwrap)
      .map((r) => r.status)
      .sort(),
  ).toEqual(["possible_duplicate", "saved"]);
  const first = unwrap(
    await ben.db
      .from("matches")
      .select("id,revision")
      .eq("id", results[0].match_id)
      .single(),
  );
  const edit = {
    ...p,
    match_id: first.id,
    expected_revision: first.revision,
    notes: "Safe edit",
  };
  expect(
    (
      await tim.db.rpc("rdd_save_match", {
        p_operation_id: crypto.randomUUID(),
        p_payload: edit,
      })
    ).error.code,
  ).toBe("42501");
  const edits = await Promise.all(
    ["one", "two"].map((note) =>
      ben.db.rpc("rdd_save_match", {
        p_operation_id: crypto.randomUUID(),
        p_payload: { ...edit, notes: note },
      }),
    ),
  );
  expect(edits.filter((result) => !result.error)).toHaveLength(1);
  expect(edits.find((result) => result.error).error.code).toBe("40001");
});

test("two phones share attendance and results; drafts and lost-response recovery; recap and responsive screens", async ({
  page,
  context,
  browser,
}) => {
  await isolate(context);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/league-night");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }).last(),
  ).toBeVisible();
  await signIn(page, ben);
  await page.goto("/league-night");
  await page
    .getByRole("button", { name: "Start a night", exact: true })
    .click();
  const title = "Saturday at the oche";
  await page.getByLabel("Night name", { exact: true }).fill(title);
  await page.getByLabel("Venue optional").fill("Synthetic Demo League");
  await page
    .getByRole("button", { name: "Start night & choose who’s here" })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  const nightUrl = page.url();
  const nightId = new URL(nightUrl).searchParams.get("night");
  await page.getByRole("button", { name: /Manage attendance/ }).click();
  for (const person of [ben, tim]) {
    const checkbox = page.locator(
      `.night-attendance-editor input[value="${person.id}"]`,
    );
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  }
  await page
    .locator(".night-player-pool")
    .getByRole("button", { name: "Demo Ben", exact: true })
    .click();
  await page
    .locator(".night-player-pool")
    .getByRole("button", { name: "Demo Tim", exact: true })
    .click();
  const benCard = page.locator(".night-scorecard").filter({
    has: page.getByRole("heading", { name: "Demo Ben", exact: true }),
  });
  const timCard = page.locator(".night-scorecard").filter({
    has: page.getByRole("heading", { name: "Demo Tim", exact: true }),
  });
  await benCard.getByLabel("3DA optional").fill("62.4");
  await timCard.getByLabel("3DA optional").fill("51.2");
  await page.getByRole("button", { name: "Demo Ben is the winner" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(benCard.getByLabel("3DA optional")).toHaveValue("62.4");
  await page.route(
    "**/rest/v1/rpc/rdd_save_match",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Save & Rematch", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Check / retry this save" }),
  ).toBeVisible();
  // Expired unsent drafts may disappear; an uncertain submitted operation must not.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage).filter((k) =>
      k.startsWith("rdd:night-draft:"),
    )) {
      const value = JSON.parse(localStorage.getItem(key));
      if (value.draft?.pending) {
        value.savedAt -= 48 * 60 * 60 * 1000;
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Check / retry this save" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Previous save confirmed" }),
  ).toBeVisible();
  await expect(benCard.getByLabel("3DA optional")).toHaveValue("");
  expect(
    unwrap(await ben.db.from("matches").select("id").eq("night_id", nightId)),
  ).toHaveLength(1);

  const other = await browser.newContext({
    viewport: { width: 390, height: 1000 },
  });
  await isolate(other);
  const phone = await other.newPage();
  phone.on("dialog", (dialog) => dialog.accept());
  await signIn(phone, tim);
  await phone.goto(nightUrl);
  await expect(
    phone
      .locator(".night-attendee-chips")
      .getByText("Demo Ben", { exact: true }),
  ).toBeVisible();
  await expect(
    phone
      .locator(".night-sidebar")
      .getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await phone.getByRole("button", { name: /Manage attendance/ }).click();
  await phone.getByLabel("Demo Alex", { exact: true }).click();
  await expect(phone.getByLabel("Demo Alex", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page
      .locator(".night-attendee-chips")
      .getByText("Demo Alex", { exact: true }),
  ).toBeVisible();
  await phone
    .locator(".night-player-pool")
    .getByRole("button", { name: "Demo Ben", exact: true })
    .click();
  await phone
    .locator(".night-player-pool")
    .getByRole("button", { name: "Demo Tim", exact: true })
    .click();
  await phone
    .locator(".night-scorecard")
    .filter({
      has: phone.getByRole("heading", { name: "Demo Ben", exact: true }),
    })
    .getByLabel("3DA optional")
    .fill("62.4");
  await phone
    .locator(".night-scorecard")
    .filter({
      has: phone.getByRole("heading", { name: "Demo Tim", exact: true }),
    })
    .getByLabel("3DA optional")
    .fill("51.2");
  await phone.getByRole("button", { name: "Demo Ben is the winner" }).click();
  await phone
    .getByRole("button", { name: "Save & Finish", exact: true })
    .click();
  await expect(
    phone.getByRole("heading", { name: "This might already be saved." }),
  ).toBeVisible();
  await phone.route(
    "**/rest/v1/rpc/rdd_save_match",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await phone
    .getByRole("button", { name: "This is another game", exact: true })
    .click();
  await expect(
    phone.getByRole("button", { name: "Keep existing result", exact: true }),
  ).toHaveCount(0);
  await phone.getByRole("button", { name: "Check / retry this save" }).click();
  await expect(
    phone.getByRole("heading", { name: "Tonight’s awards", exact: true }),
  ).toBeVisible();
  expect(
    unwrap(await ben.db.from("matches").select("id").eq("night_id", nightId)),
  ).toHaveLength(2);
  await phone
    .getByRole("button", { name: "Record a match", exact: true })
    .click();
  await expect(
    phone
      .locator(".night-sidebar")
      .getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(1);
  await other.close();

  const arrival = await account(`Late${Date.now()}`);
  unwrap(
    await tim.db.rpc("rdd_set_attendance", {
      p_night_id: nightId,
      p_player_id: arrival.id,
      p_present: true,
      p_revision: 0,
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.locator(".night-player-pool").getByRole("button", {
      name: `Demo ${arrival.email.split("@")[0].slice(6).replace("late", "Late")}`,
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: /Manage attendance/ }).click();
  const artifacts = path.join(root, ".qa-artifacts");
  mkdirSync(artifacts, { recursive: true });
  await page.getByRole("button", { name: "Summer: On", exact: true }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const scheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `${width} ${scheme} overflow`).toBe(false);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: path.join(artifacts, `league-night-${width}-${scheme}.png`),
          fullPage: true,
        });
    }
  }
  await page.getByRole("button", { name: "Night recap", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tonight’s awards", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview share card", exact: true })
    .click();
  await expect(page.locator(".night-share-preview")).not.toContainText(
    "Synthetic Demo League",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download image", exact: true })
    .click();
  const card = await download;
  expect(card.suggestedFilename()).toMatch(/rdd-night-.*\.png/);
  await card.saveAs(path.join(artifacts, "league-night-share-card.png"));
  await page.screenshot({
    path: path.join(artifacts, "league-night-recap.png"),
    fullPage: true,
  });
  expect(pageErrors).toEqual([]);
});

test("Matches keeps an edit snapshot across pagination and recovers rejected input after reload", async ({
  page,
  context,
}) => {
  await isolate(context);
  page.on("dialog", (dialog) => dialog.accept());
  const marker = `Snapshot ${Date.now()}`;
  await Promise.all(
    Array.from({ length: 11 }, (_, i) =>
      ben.db
        .rpc("rdd_save_match", {
          p_operation_id: crypto.randomUUID(),
          p_payload: payload(null, {
            notes: "Synthetic pagination",
            played_at: new Date(
              Date.now() - 10000000 - i * 60000,
            ).toISOString(),
            allow_duplicate: true,
          }),
        })
        .then(unwrap),
    ),
  );
  const original = payload(null, {
    notes: marker,
    played_at: new Date().toISOString(),
    allow_duplicate: true,
  });
  const saved = unwrap(
    await ben.db.rpc("rdd_save_match", {
      p_operation_id: crypto.randomUUID(),
      p_payload: original,
    }),
  );
  await signIn(page, ben);
  await page
    .getByRole("listitem")
    .filter({ hasText: `Notes: ${marker}` })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByLabel("Player 1 3-Dart Average", { exact: true })
    .fill("88.88");
  const newer = unwrap(
    await ben.db.rpc("rdd_save_match", {
      p_operation_id: crypto.randomUUID(),
      p_payload: {
        ...original,
        match_id: saved.match_id,
        expected_revision: saved.revision,
        notes: `Newer ${marker}`,
      },
    }),
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page.getByText(`Notes: Newer ${marker}`, { exact: true }),
  ).toBeVisible();
  await page.route(
    "**/rest/v1/rpc/rdd_save_match",
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check / retry save", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("rdd:match-save:"),
    );
    const a = JSON.parse(localStorage.getItem(key));
    const operationId = crypto.randomUUID();
    const b = {
      ...a,
      operationId,
      savedAt: a.savedAt + 1,
      payload: {
        ...a.payload,
        match_id: null,
        expected_revision: null,
        notes: "Synthetic queued result",
        venue: "Queue " + Date.now(),
      },
    };
    localStorage.setItem(
      key.slice(0, key.lastIndexOf(":") + 1) + operationId,
      JSON.stringify(b),
    );
  });
  await page.reload();
  await expect(
    page.getByLabel("Player 1 3-Dart Average", { exact: true }),
  ).toHaveValue("88.88");
  await page
    .getByRole("button", { name: "Check / retry save", exact: true })
    .click();
  await expect(page.getByText(/This match changed/)).toBeVisible();
  await page
    .getByRole("button", { name: "Review next pending save", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check / retry save", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved match #" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore saved entry", exact: true })
    .click();
  await expect(
    page.getByLabel("Player 1 3-Dart Average", { exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Player 1 3-Dart Average", { exact: true }),
  ).toHaveValue("88.88");
  const unchanged = unwrap(
    await ben.db
      .from("matches")
      .select("revision,notes")
      .eq("id", saved.match_id)
      .single(),
  );
  expect(unchanged).toEqual({
    revision: newer.revision,
    notes: `Newer ${marker}`,
  });
  await page.getByRole('listitem').filter({hasText:'Notes: Synthetic queued result'}).first().getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Notes',{exact:true}).fill('Independent saved match correction');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Saved match #'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Restore saved entry',exact:true})).toBeEnabled();
});

async function fillClassic(page, venue) {
  await page.getByLabel("Player 1", { exact: true }).selectOption(ben.id);
  await page.getByLabel("Player 2", { exact: true }).selectOption(tim.id);
  await page.getByLabel("Player 1 3-Dart Average", { exact: true }).fill("60");
  await page.getByLabel("Player 2 3-Dart Average", { exact: true }).fill("50");
  await page.getByLabel("Winner", { exact: true }).selectOption(ben.id);
  await page.getByLabel("Board type", { exact: true }).selectOption("Soft Tip");
  await page.getByLabel("Venue", { exact: true }).fill(venue);
}
test("Matches duplicate dismissal and cross-tab account changes cannot lose or misattribute pending saves", async ({
  page,
  context,
}) => {
  await isolate(context);
  await signIn(page, ben);
  const venue = `Synthetic ${Date.now()}`;
  await fillClassic(page, venue);
  unwrap(
    await ben.db.rpc("rdd_save_match", {
      p_operation_id: crypto.randomUUID(),
      p_payload: payload(null, {
        venue,
        played_at: new Date().toISOString(),
        notes: null,
      }),
    }),
  );
  await page.getByRole("button", { name: "Save match", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Keep existing result / return to draft",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Player 1 3-Dart Average", { exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Venue", { exact: true }).fill(venue + " pending");
  await page.route(
    "**/rest/v1/rpc/rdd_save_match",
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check / retry save", exact: true }),
  ).toBeEnabled();
  const other = await context.newPage();
  await other.goto("/matches");
  await other.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(
    page.getByText("You must be signed in to view and add matches."),
  ).toBeVisible();
  await signIn(other, tim);
  await expect(
    page.getByRole("heading", { name: "Darts Matches", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check / retry save", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Player 1 3-Dart Average", { exact: true }),
  ).toHaveValue("");
  await other.getByRole("button", { name: "Sign Out", exact: true }).click();
  await signIn(other, ben);
  await expect(
    page.getByRole("button", { name: "Check / retry save", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Check / retry save", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved match #" }),
  ).toBeVisible();
  const rows = unwrap(
    await ben.db
      .from("matches")
      .select("created_by")
      .eq("venue", venue + " pending"),
  );
  expect(rows).toEqual([{ created_by: ben.id }]);
  await other.close();
});

test("two simultaneous Matches tabs preserve separate uncertain operations", async ({
  page,
  context,
}) => {
  await isolate(context);
  await signIn(page, ben);
  const other = await context.newPage();
  await other.goto("/matches");
  const marker = `Tabs ${Date.now()}`;
  await fillClassic(page, marker + " A");
  await fillClassic(other, marker + " B");
  let release;
  const ack = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/rest/v1/rpc/rdd_save_match",
    async (route) => {
      const response = await route.fetch();
      await ack;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save match", exact: true }).click();
  await other.route(
    "**/rest/v1/rpc/rdd_save_match",
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await other.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(
    other.getByRole("button", { name: "Check / retry save", exact: true }),
  ).toBeEnabled();
  release();
  await expect(
    page.getByRole("button", { name: "Review next pending save", exact: true }),
  ).toBeEnabled();
  await other.reload();
  await expect(other.getByLabel("Venue", { exact: true })).toHaveValue(
    marker + " B",
  );
  await other
    .getByRole("button", { name: "Check / retry save", exact: true })
    .click();
  await expect(
    other.getByRole("status").filter({ hasText: "Saved match #" }),
  ).toBeVisible();
  expect(
    unwrap(
      await ben.db
        .from("matches")
        .select("id")
        .in("venue", [marker + " A", marker + " B"]),
    ),
  ).toHaveLength(2);
  await other.close();
});

test("earned awards showcase, readable long names, exact export preview and historical edit preservation", async ({
  page,
  context,
}) => {
  await isolate(context);
  page.on("dialog", (dialog) => dialog.accept());
  const run = Date.now();
  const one = await account("ShowcaseBen" + run),
    two = await account("ShowcaseTim" + run);
  unwrap(
    await one.db
      .from("profiles")
      .update({ display_name: "Showcase Ben" })
      .eq("id", one.id),
  );
  unwrap(
    await two.db
      .from("profiles")
      .update({ display_name: "Showcase Tim" })
      .eq("id", two.id),
  );
  const night = unwrap(
    await ben.db.rpc("rdd_create_night", {
      p_id: crypto.randomUUID(),
      p_title: "Saturday night at the oche",
      p_venue: "Demo league · synthetic results",
      p_date: new Date().toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      }),
    }),
  );
  for (const person of [one, two])
    unwrap(
      await ben.db.rpc("rdd_set_attendance", {
        p_night_id: night.id,
        p_player_id: person.id,
        p_present: true,
        p_revision: 0,
      }),
    );
  const ids = [];
  for (let i = 0; i < 15; i++) {
    const inNight = i >= 12;
    const p = payload(inNight ? night.id : null, {
      allow_duplicate: true,
      played_at: new Date(
        run - (inNight ? 60 : 1440) * 60000 + i * 60000,
      ).toISOString(),
      venue: inNight ? null : "Synthetic history",
      notes: "Synthetic award showcase",
      players: [
        {
          player_id: one.id,
          score: 60,
          points_scored: null,
          is_winner: !inNight,
        },
        {
          player_id: two.id,
          score: inNight ? 63 + i : 45,
          points_scored: null,
          is_winner: inNight,
        },
      ],
    });
    ids.push(
      unwrap(
        await ben.db.rpc("rdd_save_match", {
          p_operation_id: crypto.randomUUID(),
          p_payload: p,
        }),
      ).match_id,
    );
  }
  await signIn(page, ben);
  await page.goto(`/league-night?night=${night.id}`);
  await page.getByRole("button", { name: "Night recap", exact: true }).click();
  await expect(
    page.locator(".night-award").filter({ hasText: "Giant Slayer" }),
  ).toBeVisible();
  await expect(
    page.locator(".night-award").filter({ hasText: "Power Surge" }),
  ).toBeVisible();
  await page.getByText(/All awards/).click();
  await expect(
    page.locator(".night-award").filter({ hasText: "Hat Trick" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Summer: On", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview share card", exact: true })
    .click();
  const canvas = page.locator(".night-share-preview canvas");
  await expect(canvas).toHaveAttribute("aria-label", /Giant Slayer/);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download image", exact: true })
    .click();
  const artifact = path.join(
    root,
    ".qa-artifacts",
    "league-night-awards-card.png",
  );
  await (await downloadPromise).saveAs(artifact);
  const { readFileSync } = await import("node:fs");
  const preview = await canvas.evaluate(
    (c) => c.toDataURL("image/png").split(",")[1],
  );
  expect(readFileSync(artifact).equals(Buffer.from(preview, "base64"))).toBe(
    true,
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    ).toBe(false);
    await page.screenshot({
      path: path.join(
        root,
        ".qa-artifacts",
        `league-night-awards-${width}.png`,
      ),
      fullPage: true,
    });
  }
  unwrap(
    await two.db
      .from("profiles")
      .update({
        display_name: "TheIncrediblyLongUnbrokenNickname",
        first_name: "AlexandertheLongestNameAllowed".slice(0, 29),
        include_first_name_in_display: true,
      })
      .eq("id", two.id),
  );
  await page
    .getByRole("button", { name: "Record a match", exact: true })
    .click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Night recap", exact: true }).click();
  await expect(page.locator(".night-award h3").first()).toContainText(
    "IncrediblyLong",
  );
  await page.setViewportSize({ width: 320, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  unwrap(
    await two.db
      .from("profiles")
      .update({
        display_name: "Showcase Tim",
        include_first_name_in_display: false,
      })
      .eq("id", two.id),
  );
  await page
    .getByRole("button", { name: "Record a match", exact: true })
    .click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .locator(".night-sidebar")
    .getByRole("button", { name: "Edit", exact: true })
    .first()
    .click();
  await page.getByText("Match time & notes", { exact: true }).click();
  await page.getByLabel("Match notes optional").fill("Synthetic correction");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved match #" }),
  ).toBeVisible();
  expect(
    unwrap(
      await ben.db
        .from("matches")
        .select("venue,notes")
        .eq("id", ids[14])
        .single(),
    ),
  ).toEqual({ venue: null, notes: "Synthetic correction" });
  console.log(
    `Local review night: http://127.0.0.1:3010/league-night?night=${night.id}`,
  );
});

test('ten-player mobile entry, capacity guard and optional scores',async({page,context})=>{
  await isolate(context);page.on('dialog',dialog=>dialog.accept());
  const people=await Promise.all(Array.from({length:11},(_,i)=>account('Capacity'+i)));
  const night=await createNight();
  for(const person of people) unwrap(await ben.db.rpc('rdd_set_attendance',{p_night_id:night.id,p_player_id:person.id,p_present:true,p_revision:0}));
  await signIn(page,ben);await page.goto(`/league-night?night=${night.id}`);await page.setViewportSize({width:390,height:844});
  for(const person of people.slice(0,10)) await page.locator(`.night-player-pool button[value="${person.id}"]`).click();
  await expect(page.locator('.night-scorecard')).toHaveCount(10);
  await page.locator(`.night-player-pool button[value="${people[10].id}"]`).click();await expect(page.getByRole('alert').filter({hasText:'up to ten'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.locator('.night-scorecard').first().getByRole('button',{name:/is the winner/}).click();
  await page.getByRole('button',{name:'Save & Finish',exact:true}).click();await expect(page.getByRole('heading',{name:'Tonight’s awards',exact:true})).toBeVisible();
  const rows=unwrap(await ben.db.from('matches').select('id,match_players(player_id,score)').eq('night_id',night.id));expect(rows).toHaveLength(1);expect(rows[0].match_players).toHaveLength(10);expect(rows[0].match_players.every(p=>p.score===null)).toBe(true);
});
