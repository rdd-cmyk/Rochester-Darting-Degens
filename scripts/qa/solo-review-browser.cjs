/* eslint-disable @typescript-eslint/no-require-imports -- Local QA uses the bundled CommonJS Playwright entry point. */
const { chromium } = require("C:/Users/linfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const demo = JSON.parse(fs.readFileSync(".local/solo/demo.json", "utf8"));

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1100 } });
    await context.route("**/*", (route) =>
      ["http://127.0.0.1:3016", "http://127.0.0.1:56321"].includes(new URL(route.request().url()).origin)
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:3016/auth");
    await page.getByLabel("Email", { exact: true }).fill(demo.people[0].email);
    await page.getByLabel("Password", { exact: true }).fill(demo.password);
    await page.locator("form button[type=submit]").click();
    await page.getByRole("heading", { name: "Darts Matches", exact: true }).waitFor();

    await page.evaluate(() => {
      localStorage.setItem("summer-overlay-enabled", "false");
      window.dispatchEvent(new StorageEvent("storage", { key: "summer-overlay-enabled" }));
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "summer-overlay-enabled") throw new DOMException("Storage full", "QuotaExceededError");
        return write.call(this, key, value);
      };
    });
    await page.getByRole("button", { name: "Summer: Off", exact: true }).click();
    await page.getByRole("button", { name: "Summer: On", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("summer-overlay-enabled")), "false");
    await page.getByRole("button", { name: "Summer: On", exact: true }).click();
    await page.getByRole("button", { name: "Summer: Off", exact: true }).waitFor();

    await page.goto(`http://127.0.0.1:3016/profiles/${demo.people[0].id}`);
    await page.getByRole("button", { name: "Solo", exact: true }).click();
    await page.locator(".solo-profile .solo-metrics").waitFor();
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    await context.route("**/rest/v1/rpc/rdd_solo_profile", async (route) => {
      await pending;
      // Simulate a fresh denial without changing the demo owner's real consent.
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    });
    await page.getByRole("button", { name: "League", exact: true }).click();
    await page.getByRole("button", { name: "Solo", exact: true }).click();
    await page.getByText("Loading scoring summary…", { exact: true }).waitFor();
    assert.equal(await page.locator(".solo-profile .solo-metrics").count(), 0);
    release();
    await page.getByText("This player’s solo summary is private.", { exact: true }).waitFor();
    assert.equal(await page.locator(".solo-profile .solo-metrics").count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: failed preference writes remain interactive; reopened Solo hides cached metrics pending current consent and after denial; no browser script errors. No database writes.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
