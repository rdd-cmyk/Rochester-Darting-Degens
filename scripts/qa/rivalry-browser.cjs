/* eslint-disable @typescript-eslint/no-require-imports -- Use the bundled local Playwright runtime. */
const {
  chromium,
} = require("C:/Users/linfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const demo = JSON.parse(
  fs.readFileSync(".local/rivalry-room/demo.json", "utf8"),
);
let browser, diagnosticPage;
const artifactDir =
  process.env.RDD_REVIEW_ARTIFACTS === "1"
    ? ".local/rivalry-room/browser-review"
    : "docs/testing/rivalry-room";
let checks = 0;
const ok = (v, label) => {
  assert(v, label);
  checks++;
};
(async () => {
  process.env.RDD_LOCAL_STACK = "rivalry-room";
  const { localStatus } = await import("../local-environment.mjs");
  const local = localStatus();
  const { createClient } = require("@supabase/supabase-js");
  const db = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await db.auth.signInWithPassword({
    email: demo.people[0].email,
    password: demo.password,
  });
  assert(
    !signed.error && signed.data.user.id === demo.people[0].id,
    "Synthetic local browser recorder identity",
  );
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [];
  async function context(person) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      timezoneId: "America/New_York",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) =>
      ["http://127.0.0.1:3040", "http://127.0.0.1:56621"].includes(
        new URL(route.request().url()).origin,
      )
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    diagnosticPage = page;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3040/auth?next=/rivalries");
    await page.getByLabel("Email", { exact: true }).fill(person.email);
    await page.getByLabel("Password", { exact: true }).fill(demo.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/rivalries");
    const summer = page.getByRole("button", {
      name: "Summer: On",
      exact: true,
    });
    if (await summer.count()) await summer.click();
    await page.locator(".rr-faceoff").waitFor();
    return { context, page };
  }
  const a = await context(demo.people[0]);
  const page = a.page;
  diagnosticPage = page;
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.locator(".rr-faceoff img").first().waitFor();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".rr-faceoff img")).every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1080 });
    ok(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
      `Lobby has no overflow at ${width}px`,
    );
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: `${artifactDir}/lobby-${width}.png`,
        fullPage: true,
      });
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({
    path: `${artifactDir}/lobby-light.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: `${artifactDir}/lobby-dark.png`,
    fullPage: true,
  });
  ok(
    (await page.locator(".rr-headline h2").innerText()).length > 0,
    "Evidence-based rivalry headline displayed",
  );
  // Poster is an explicit preview, then a browser download.
  await page.getByRole("button", { name: "TV view ⛶" }).click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.screenshot({ path: `${artifactDir}/tv-view.png` });
  await page.getByRole("button", { name: "Exit TV view" }).click();
  ok(
    await page.evaluate(() => !document.fullscreenElement),
    "Explicit fullscreen TV view enters and exits",
  );
  await page.getByRole("button", { name: "Make a fight poster" }).click();
  await page.keyboard.press("Tab");
  ok(
    await page.evaluate(() =>
      document.querySelector("dialog")?.contains(document.activeElement),
    ),
    "Native dialog contains keyboard focus",
  );
  await page
    .getByRole("button", { name: "Preview poster", exact: true })
    .click();
  await page.getByRole("link", { name: "Download this poster" }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download this poster" }).click();
  const download = await downloadPromise;
  ok(
    download.suggestedFilename() === "rdd-rivalry-poster.png",
    "Poster download comes from reviewed preview",
  );
  await download.saveAs(`${artifactDir}/export-poster.png`);
  await page.getByLabel("Include player names").uncheck();
  ok(
    (await page.getByRole("link", { name: "Download this poster" }).count()) ===
      0,
    "Changing export contents invalidates old preview",
  );
  await page.keyboard.press("Escape");
  // Avatar save uses its own operation and appears throughout the app.
  await page.goto("http://127.0.0.1:3040/profile");
  const attempts = [];
  let dropped = false;
  await a.context.route("**/rest/v1/rpc/rdd_rivalry_write", async (route) => {
    const payload = route.request().postDataJSON();
    if (payload.p_payload.action === "avatar") {
      attempts.push(payload.p_operation_id);
      if (!dropped) {
        dropped = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "The Eagle", exact: true }).click();
  await page.getByRole("button", { name: "Save avatar", exact: true }).click();
  await page
    .getByRole("button", { name: "Check avatar save", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Check avatar save", exact: true })
    .click();
  await page
    .getByText("Your player avatar is saved.", { exact: true })
    .waitFor();
  ok(
    attempts.length === 2 && attempts[0] === attempts[1],
    "A committed avatar with a lost response recovers after reload using the same operation",
  );
  await a.context.unroute("**/rest/v1/rpc/rdd_rivalry_write");
  await page.getByRole("button", { name: "The Tiger", exact: true }).click();
  await page.getByRole("button", { name: "Save avatar", exact: true }).click();
  await page
    .getByText("Your player avatar is saved.", { exact: true })
    .waitFor();
  await page.goto("http://127.0.0.1:3040/rivalries");
  await page.locator(".rr-faceoff img").first().waitFor();
  ok(
    (
      await page.locator(".rr-faceoff img").first().getAttribute("src")
    ).includes("tiger.webp"),
    "Saved avatar is used on rivalry poster",
  );
  await page.goto("http://127.0.0.1:3040/profile");
  await page.getByRole("button", { name: "The Bandit", exact: true }).click();
  await page.getByRole("button", { name: "Save avatar", exact: true }).click();
  await page
    .getByText("Your player avatar is saved.", { exact: true })
    .waitFor();
  await page.goto("http://127.0.0.1:3040/rivalries");
  await page.locator(".rr-faceoff").waitFor();
  await page
    .getByRole("combobox", { name: "Choose rival" })
    .selectOption(demo.people[1].id);
  await page.getByRole("button", { name: "Challenge Demo Mike" }).click();
  await page.getByLabel("Scheduled League Night").selectOption(demo.nightId);
  await page.getByRole("combobox", { name: /^Series/ }).selectOption("3");
  await page.getByRole("button", { name: "Send challenge" }).click();
  await page.waitForURL("**/rivalries/challenges/**");
  const challengeUrl = page.url();
  await page.getByRole("button", { name: "Withdraw invitation" }).waitFor();
  ok(true, "Sender creates a stable challenge detail URL");
  const b = await context(demo.people[1]);
  await b.page.goto(challengeUrl);
  await b.page
    .getByRole("button", { name: "Accept challenge", exact: true })
    .click();
  await b.page.getByRole("link", { name: "Record the next game" }).waitFor();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("link", { name: "Record the next game" }).waitFor();
  await page.getByRole("link", { name: "Record the next game" }).click();
  diagnosticPage = page;
  await page.locator(".rr-series-banner").waitFor();
  ok(
    await page.getByLabel("Game", { exact: true }).isDisabled(),
    "Challenge game is locked to accepted terms",
  );
  ok(
    await page.getByLabel("Board", { exact: true }).isDisabled(),
    "Challenge board is locked",
  );
  ok(
    (await page.locator(".night-scorecard").count()) === 2,
    "Exactly the accepted players are prefilled",
  );
  await page.screenshot({
    path: `${artifactDir}/recorder-desktop.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Demo Ben is the winner", exact: true })
    .click();
  const saveButton = page.getByRole("button", { name: /Save.*rematch/i });
  console.log(
    "Recorder save buttons:",
    await page
      .locator("button")
      .allTextContents()
      .then((text) => text.filter((t) => /save/i.test(t)).join(", ")),
  );
  if (await saveButton.count()) await saveButton.first().click();
  else await page.getByRole("button", { name: /Save.*next/i }).click();
  await page
    .locator(
      '.night-receipt,.night-warning[role=alert],.night-warning:has-text("This might already be saved")',
    )
    .first()
    .waitFor();
  if (await page.locator(".night-warning[role=alert]").count())
    throw Error(
      await page.locator(".night-warning[role=alert]").first().innerText(),
    );
  const another = page.getByRole("button", {
    name: "This is another game",
    exact: true,
  });
  if (await another.count()) {
    ok(true, "Duplicate detection requires explicit confirmation");
    await another.click();
  }
  await page.getByText(/Saved match #/).waitFor();
  await page.goto(challengeUrl);
  await page
    .getByRole("heading", { name: "In progress", exact: true })
    .waitFor();
  ok(
    (await page.locator(".rr-game-list li").count()) === 1,
    "Recorded game advances real series",
  );
  await page.screenshot({
    path: `${artifactDir}/series-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 1080 });
  ok(
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
    "Challenge page has no mobile overflow",
  );
  await page.screenshot({
    path: `${artifactDir}/series-mobile.png`,
    fullPage: true,
  });
  const ordinary = await db.rpc("rdd_save_match", {
    p_operation_id: crypto.randomUUID(),
    p_payload: {
      submitted_by: demo.people[0].id,
      match_id: null,
      expected_revision: null,
      night_id: demo.nightId,
      game_type: "Cricket",
      game_config: {
        version: 1,
        preset: "cricket-v1",
        format: "individual",
        context: "competitive",
        status: "completed",
        handicap: false,
        sides: {},
        teamScores: {},
        otherName: "",
        finish: "ordinary",
      },
      board_type: "Soft Tip",
      venue: "Synthetic Darts Club",
      notes: "Review ordinary correction",
      played_at: new Date().toISOString(),
      allow_duplicate: true,
      players: [demo.people[0].id, demo.people[2].id].map((player_id, i) => ({
        player_id,
        score: null,
        points_scored: null,
        is_winner: i === 0,
      })),
    },
  });
  assert(!ordinary.error, "Ordinary synthetic review result saved");
  const seriesId = new URL(challengeUrl).pathname.split("/").at(-1);
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto(
    `http://127.0.0.1:3040/league-night?night=${demo.nightId}&challenge=${seriesId}`,
  );
  await page.locator(".rr-series-banner").waitFor();
  await page
    .locator(".night-result")
    .filter({ hasText: `#${ordinary.data.match_id}` })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByText(new RegExp(`Saved match #${ordinary.data.match_id}`))
    .waitFor();
  ok(
    (await page.getByLabel("Game", { exact: true }).inputValue()) === "501" &&
      (await page.getByLabel("Board", { exact: true }).inputValue()) ===
        "Steel Tip",
    "Ordinary correction restores accepted challenge game and board",
  );
  ok(
    (await page.locator(".night-scorecard").allTextContents()).some((t) =>
      t.includes("Demo Mike"),
    ) &&
      !(await page.locator(".night-scorecard").allTextContents()).some((t) =>
        t.includes("Demo Alex"),
      ),
    "Ordinary correction restores accepted challenge participants",
  );
  await page.getByLabel("Enter averages as").selectOption("ppd");
  await page
    .getByRole("button", { name: "Demo Ben is the winner", exact: true })
    .click();
  const nextSaveResponse = page.waitForResponse((response) =>
    response.url().endsWith("/rest/v1/rpc/rdd_save_match"),
  );
  await page
    .getByRole("button", { name: "Save & Rematch", exact: true })
    .click();
  const nextSave = await (await nextSaveResponse).json();
  if (nextSave.status === "possible_duplicate")
    await page
      .getByRole("button", { name: "This is another game", exact: true })
      .click();
  else
    assert.equal(
      nextSave.status,
      "saved",
      "New challenge game has an acknowledged save",
    );
  await page.waitForFunction(() =>
    document
      .querySelector(".rr-series-banner")
      ?.textContent.includes("completed"),
  );
  ok(
    (await page.getByLabel("Enter averages as").inputValue()) === "ppd",
    "Challenge rematch retains the selected average input unit",
  );
  await b.page.goto(challengeUrl);
  await b.page
    .getByRole("heading", { name: "Demo Ben takes the series.", exact: true })
    .waitFor();
  ok(
    (await b.page.locator(".rr-headline h2").innerText()) ===
      "THE CHAPTER IS WON.",
    "Losing viewer sees an accurate completed-series headline",
  );
  ok(errors.length === 0, `No browser exceptions: ${errors.join("; ")}`);
  fs.writeFileSync(
    ".local/rivalry-room/browser-evidence.json",
    JSON.stringify({ date: new Date().toISOString(), checks, errors }, null, 2),
  );
  console.log(`${checks} real browser checks passed.`);
  await browser.close();
})().catch(async (error) => {
  console.error(error.message);
  if (diagnosticPage)
    await diagnosticPage
      .screenshot({
        path: ".local/rivalry-room/browser-failure.png",
        fullPage: true,
      })
      .catch(() => {});
  if (browser) await browser.close();
  process.exitCode = 1;
});
