// Read-only shared-page checks against the existing synthetic Rivalry stack.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

process.env.RDD_LOCAL_STACK = 'rivalry-room';
const { localStatus } = await import('../local-environment.mjs');
const local = localStatus(); // Checks stack identity, health and loopback bindings.
const demo = JSON.parse(fs.readFileSync('.local/rivalry-room/demo.json', 'utf8'));
const origin = 'http://127.0.0.1:3040';
const output = path.resolve('.local/rivalry-room/ui-integration');
fs.mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright directory.');
const { chromium } = require(process.env.RDD_PLAYWRIGHT_ROOT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
const errors = [];
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => [origin, local.API_URL].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('Page rendering failed')) errors.push(message.text());
  });
  await page.goto(`${origin}/auth?next=/rivalries`);
  await page.getByLabel('Email', { exact: true }).fill(demo.people[0].email);
  await page.getByLabel('Password', { exact: true }).fill(demo.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/rivalries');
  await page.locator('.rr-faceoff').waitFor();
  const summer = page.getByRole('button', { name: 'Summer: On', exact: true });
  if (await summer.count()) await summer.click();
  const routes = ['/', '/stats', '/matches', '/league-night', '/league-night/plan', '/board', '/solo', '/profiles', '/profile', `/profiles/${demo.people[0].id}`, '/rivalries', `/rivalries/pair/${demo.people[0].id}/${demo.people[1].id}`];
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1080 });
      for (const route of routes) {
        const response = await page.goto(`${origin}${route}`);
        assert.equal(response.status(), 200, `${route}: HTTP 200`);
        await page.locator('main h1').first().waitFor();
        await page.waitForLoadState('networkidle');
        assert.equal(await page.getByRole('heading', { name: 'We could not load this page.' }).count(), 0, `${route}: no render fallback`);
        assert.equal(await page.getByRole('button', { name: 'Sign Out', exact: true }).count(), 1, `${route}: admitted session retained`);
        const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, panel: getComputedStyle(document.documentElement).getPropertyValue('--stats-panel').trim() }));
        assert(dimensions.scroll <= dimensions.width + 1, `${route} ${theme} ${width}: overflow ${dimensions.scroll}`);
        const panel = dimensions.panel.replace(/^#([a-f\d])([a-f\d])([a-f\d])$/i, '#$1$1$2$2$3$3');
        assert.equal(panel, theme === 'dark' ? '#111b2b' : '#ffffff', 'OS color scheme selects the expected shared tokens');
        if (route === '/') {
          const leaderboard = await page.getByText('Overall Leaderboard (All Match Types)', { exact: true }).boundingBox();
          const board = await page.getByRole('heading', { name: 'From the League Board' }).boundingBox();
          assert(leaderboard && board && leaderboard.y < board.y, 'Home remains leaderboard-first');
        }
        if (route === '/profiles') {
          assert.equal(await page.locator('.directory-item .player-avatar').count(), demo.people.length, 'Directory keeps all synthetic people and shared avatars');
        }
        if (route === '/profile') {
          await page.locator('.avatar-grid button:not(:disabled)').first().waitFor();
          assert.equal(await page.locator('.avatar-grid button').count(), 25, 'Owner has 24 curated choices plus initials');
        }
        if (route.startsWith('/profiles/')) assert.equal(await page.locator('.player-page-heading .player-avatar').count(), 1, 'Public profile retains the shared avatar and new page heading');
        // Next Image intentionally defers portraits below the viewport.
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.player-avatar img')).every(img => {
          const box = img.getBoundingClientRect();
          return box.bottom <= 0 || box.top >= innerHeight || (img.complete && img.naturalWidth > 0);
        }));
        if ([320, 1440].includes(width) && ['/stats', '/profiles', '/profile', '/rivalries'].includes(route)) {
          await page.screenshot({ path: path.join(output, `${theme}-${route.slice(1)}-${width}.png`), fullPage: true });
        }
        results.push({ route, theme, width, overflow: false });
      }
    }
  }
  await page.setViewportSize({ width: 320, height: 900 });
  const menu = page.getByRole('button', { name: '☰ Menu', exact: true });
  await menu.click();
  const nav = page.getByRole('navigation', { name: 'Primary', exact: true });
  for (const name of ['Solo Play', 'League Night', 'Rivalry Room', 'League Board', 'Invites']) await nav.getByRole('link', { name, exact: true }).waitFor();
  assert.equal(await nav.getByRole('link', { name: 'Rivalry Room', exact: true }).getAttribute('aria-current'), 'page', 'Pair route highlights Rivalry Room');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Escape closes the merged mobile menu');
  assert(await menu.evaluate(node => node === document.activeElement), 'Escape restores menu focus');
  assert.deepEqual(errors, [], 'No caught render failures or uncaught browser exceptions');
  fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify({ date: new Date().toISOString(), projectId: 'rdd-rivalry-room', results, errors, navigation: 'passed' }, null, 2));
  console.log(`${results.length} real local route/theme/width renders passed; avatars, leaderboard order and merged navigation passed.`);
} catch (error) {
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
