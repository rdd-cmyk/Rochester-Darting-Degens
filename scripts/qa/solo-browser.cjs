/* eslint-disable @typescript-eslint/no-require-imports -- Local QA uses the bundled CommonJS Playwright entry point. */
const {
  chromium,
} = require("C:/Users/linfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const demo = JSON.parse(fs.readFileSync(".local/solo/demo.json", "utf8"));
let diagnosticPage, activeBrowser;
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  activeBrowser = browser;
  const context = await browser.newContext({
    viewport: { width: 390, height: 1100 },
    timezoneId: "America/New_York",
  });
  await context.route("**/*", (route) =>
    ["http://127.0.0.1:3016", "http://127.0.0.1:56321"].includes(
      new URL(route.request().url()).origin,
    )
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage(),
    errors = [];
  diagnosticPage = page;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("http://127.0.0.1:3016/solo");
  await page.getByRole("link", { name: "Sign in to log a game" }).waitFor();
  await page.goto("http://127.0.0.1:3016/auth");
  await page.getByLabel("Email", { exact: true }).fill(demo.people[0].email);
  await page.getByLabel("Password", { exact: true }).fill(demo.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Darts Matches", exact: true })
    .waitFor();
  const seasonalToggle = page.getByRole("button", {
    name: "Summer: On",
    exact: true,
  });
  if (await seasonalToggle.count()) await seasonalToggle.click();
  await page.goto("http://127.0.0.1:3016/solo");
  await page
    .getByRole("heading", { name: "Get a game in.", exact: true })
    .waitFor();
  await page
    .getByLabel("Rule preset", { exact: true })
    .selectOption("501-double-v1");
  await page.locator(".solo-score-field input").fill("66.7");
  fs.mkdirSync("docs/testing/solo", { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    assert(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
      `Entry overflow ${width}`,
    );
    if (width === 1440)
      await page.screenshot({
        path: "docs/testing/solo/entry-desktop.png",
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.screenshot({
    path: "docs/testing/solo/entry-mobile.png",
    fullPage: true,
  });
  assert(
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
    "Mobile entry overflow",
  );
  let interrupted = false;
  await page.route("**/rest/v1/rpc/rdd_solo_write", async (route) => {
    if (!interrupted) {
      interrupted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save & play again" }).click();
  await page
    .getByRole("button", { name: "Check / retry save", exact: true })
    .waitFor();
  assert(
    await page.getByRole("button", { name: "Save & play again" }).isDisabled(),
    "Pending payload frozen",
  );
  const retryButton = page.getByRole("button", {
    name: "Check / retry save",
    exact: true,
  });
  await page.waitForFunction(
    (e) => !e.disabled,
    await retryButton.elementHandle(),
  );
  await page
    .getByRole("button", { name: "Check / retry save", exact: true })
    .press("Enter");
  await page.getByText(/Previous operation confirmed/).waitFor();
  await page.unroute("**/rest/v1/rpc/rdd_solo_write");
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByText("501 · 66.70 3DA", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.getByRole("heading", { name: "Edit your game" }).waitFor();
  await page.locator(".solo-score-field input").fill("67.2");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText(/Saved · 501 · 67.2/).waitFor();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Undo deletion" }).click();
  await page.getByText(/Game restored/).waitFor();
  await page.getByRole("button", { name: "Log a game", exact: true }).click();
  await page
    .getByLabel("League night (optional)", { exact: true })
    .selectOption(demo.nightId);
  await page.getByText("When, result & extra details", { exact: true }).click();
  await page.getByLabel(/When played/).fill("2026-09-24T19:25");
  await page.getByLabel(/Show in this night/).check();
  await page.locator(".solo-score-field input").fill("62.4");
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await page.getByText(/Saved · 501 · 62.4/).waitFor();
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page.getByLabel("Rules", { exact: true }).selectOption("501-double-v1");
  await page
    .getByRole("heading", { name: "Does it carry over?", exact: true })
    .waitFor();
  await page.getByText(/eligible nights after/).waitFor();
  await page
    .locator(".solo-performance .solo-text-button")
    .first()
    .press("Enter");
  await page.getByText(/Comparison details/).waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.waitForFunction(() => {
      const node = document.querySelector(".solo-chart");
      const svg = node?.querySelector("svg");
      return (
        svg &&
        Number(svg.getAttribute("viewBox").split(" ")[2]) ===
          Math.max(240, node.clientWidth)
      );
    });
    assert(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
      `Progress overflow ${width}`,
    );
    if (width === 1440)
      await page.screenshot({
        path: "docs/testing/solo/progress-desktop.png",
        fullPage: true,
      });
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.waitForFunction(() => {
    const e = document.querySelector(".solo-shell select");
    return (
      matchMedia("(prefers-color-scheme: dark)").matches &&
      getComputedStyle(e).backgroundColor ===
        getComputedStyle(e.closest(".solo-panel")).backgroundColor
    );
  });
  const contrast = await page
    .getByLabel("Rules", { exact: true })
    .evaluate((e) => {
      const luminance = (color) => {
        const channels = color
          .match(/\d+/g)
          .slice(0, 3)
          .map((v) => Number(v) / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const a = luminance(getComputedStyle(e).color),
        b = luminance(getComputedStyle(e).backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  assert(contrast >= 4.5, "Dark control text contrast");
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.screenshot({
    path: "docs/testing/solo/progress-dark-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Log a game", exact: true }).click();
  await page.getByRole("button", { name: "Cricket", exact: true }).click();
  await page.locator(".solo-score-field input").fill("2.4");
  await page
    .getByLabel("League night (optional)", { exact: true })
    .selectOption("");
  await page.getByLabel(/Include in my profile stats/).uncheck();
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await page.getByText(/Saved · Cricket · 2.4/).waitFor();
  await page.goto(`http://127.0.0.1:3016/profiles/${demo.people[0].id}`);
  await page.getByRole("button", { name: "Solo", exact: true }).click();
  await page.getByRole("heading", { name: "Solo scoring" }).waitFor();
  await page.getByLabel("Rules", { exact: true }).selectOption("501-double-v1");
  await page.getByRole("button", { name: "All play", exact: true }).click();
  await page.getByRole("heading", { name: "All play scoring" }).waitFor();
  await page.goto(`http://127.0.0.1:3016/league-night?night=${demo.nightId}`);
  await page.getByRole("button", { name: "Night recap", exact: true }).click();
  await page
    .getByRole("heading", { name: "Solo at the venue", exact: true })
    .waitFor();
  await page
    .locator(".solo-night-activity")
    .getByText(/62.40 3DA/)
    .first()
    .waitFor();
  await page.screenshot({
    path: "docs/testing/solo/night-practice-mobile.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:3016/solo");
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page.getByLabel(/Share my solo summaries/).uncheck();
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 1100 },
    timezoneId: "America/New_York",
  });
  await guestContext.route("**/*", (route) =>
    ["http://127.0.0.1:3016", "http://127.0.0.1:56321"].includes(
      new URL(route.request().url()).origin,
    )
      ? route.continue()
      : route.abort(),
  );
  const guest = await guestContext.newPage();
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.goto("http://127.0.0.1:3016/auth");
  await guest.getByLabel("Email", { exact: true }).fill(demo.people[1].email);
  await guest.getByLabel("Password", { exact: true }).fill(demo.password);
  await guest.getByRole("button", { name: "Sign in", exact: true }).click();
  await guest
    .getByRole("heading", { name: "Darts Matches", exact: true })
    .waitFor();
  await guest.goto(`http://127.0.0.1:3016/profiles/${demo.people[0].id}`);
  await guest.getByRole("button", { name: "Solo", exact: true }).click();
  await guest.getByText("This player’s solo summary is private.").waitFor();
  await page.goto("http://127.0.0.1:3016/solo");
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page.getByLabel(/Share my solo summaries/).check();
  await guest.reload();
  await guest.getByRole("button", { name: "Solo", exact: true }).click();
  await guest.getByLabel("Rules", { exact: true }).waitFor();
  assert(
    !(await guest.getByText("PRIVATE-NOTE", { exact: true }).count()),
    "Private notes leaked",
  );
  await page.getByLabel(/Share my solo summaries/).uncheck();
  await guest.reload();
  await guest.getByRole("button", { name: "Solo", exact: true }).click();
  await guest.getByText("This player’s solo summary is private.").waitFor();
  await guestContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: signed-out gate, persisted entry, lost-response retry, edit, delete/undo, explicit night sharing, Cricket history-only, profile scopes, progress at 320/390/768/1440 and dark appearance; no browser script errors.",
  );
  await browser.close();
})().catch(async (e) => {
  if (diagnosticPage)
    await diagnosticPage
      .screenshot({ path: ".local/solo/browser-failure.png", fullPage: true })
      .catch(() => {});
  console.error(e);
  await activeBrowser?.close();
  process.exitCode = 1;
});
