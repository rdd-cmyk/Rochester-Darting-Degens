// Synthetic integration checks for the PR 75 / release-next merge. No hosted DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright directory.');
const { chromium } = require(process.env.RDD_PLAYWRIGHT_ROOT);
const origin = process.env.RDD_UI_MERGE_ORIGIN ?? 'http://localhost:3215';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Only loopback previews are allowed.');
const captain = '11111111-1111-4111-8111-111111111111';
const output = path.resolve('.qa-artifacts/pr75-merge');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const saves = [];
  let interruptSave = true;
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (![origin, 'http://127.0.0.1:54321', 'http://localhost:54321'].includes(url.origin)) return route.abort();
    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.endsWith('/rest/v1/league_members')) return json({ user_id: captain, status: 'active' });
    if (url.pathname.endsWith('/rest/v1/board_members')) return json({ user_id: captain, status: 'approved', role: 'member' });
    if (url.pathname.endsWith('/rest/v1/solo_preferences')) return json({ share_summary: false });
    if (url.pathname === '/api/invites') {
      assert.equal(request.postDataJSON().action, 'list', 'Only synthetic invitation reads are supported.');
      return json({ items: [], total: 0, pending: 0, accepted: 0 });
    }
    if (url.pathname === '/api/change-log') {
      const pageNumber = Number(url.searchParams.get('page') ?? 1);
      return json({ pulls: [{ id: 9000 + pageNumber, title: `Synthetic release note ${pageNumber}`, merged_at: '2026-09-01T12:00:00Z', summary: 'Invented notes for **local layout review** only.' }], hasNextPage: pageNumber === 1 });
    }
    if (url.pathname.endsWith('/rest/v1/rpc/rdd_planning_read')) return json({ organizer: false, server_now: new Date().toISOString(), polls: [], nights: [], poll_total: 0, night_total: 0 });
    if (url.pathname.endsWith('/rest/v1/rpc/rdd_save_match')) {
      saves.push(request.postDataJSON());
      if (interruptSave) {
        interruptSave = false;
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic interrupted response' }) });
      }
      return json({ status: 'saved', match_id: 101, replayed: true });
    }
    if (url.pathname.includes('/rest/v1/rpc/')) return json([]);
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('Page rendering failed')) errors.push(message.text());
  });
  await page.goto(`${origin}/auth`);
  await page.getByLabel('Email', { exact: true }).fill('demo-captain@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
  assert.equal(await page.getByRole('button', { name: /sign up/i }).count(), 0);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Darts Matches' }).waitFor();
  const routes = ['/', '/stats', '/matches', '/profiles', '/profile', `/profiles/${captain}`, '/solo', '/league-night', '/league-night/plan', '/board', '/invites', '/change-log', '/reset-password', '/auth/verify-email', '/test-supabase', '/join'];
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        const response = await page.goto(`${origin}${route}${theme === 'light' ? '?qaTheme=light' : ''}`);
        assert.equal(response.status(), 200, `${route}: route must exist`);
        await page.locator('main h1').first().waitFor();
        // Wait for real page content rather than an auth/loading shell.
        if (route === '/') await page.getByText('Overall Leaderboard (All Match Types)', { exact: true }).waitFor();
        if (route === '/matches') await page.getByRole('heading', { name: 'Record a New Match' }).waitFor();
        if (route === '/stats') await page.getByRole('heading', { name: 'Advanced Statistics' }).waitFor();
        if (route === '/league-night/plan') await page.getByRole('heading', { name: 'On the calendar' }).waitFor();
        if (route === '/change-log') await page.getByText('Synthetic release note 1', { exact: true }).waitFor();
        await page.waitForTimeout(100);
        assert.equal(await page.getByRole('heading', { name: 'We could not load this page.' }).count(), 0, `${route}: no error fallback`);
        const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert(dimensions.scroll <= dimensions.width + 1, `${route} ${theme} ${width}: document overflow ${dimensions.scroll}`);
        if (route === '/') {
          const leaderboard = await page.getByText('Overall Leaderboard (All Match Types)', { exact: true }).boundingBox();
          const board = await page.getByRole('heading', { name: 'From the League Board' }).boundingBox();
          assert(leaderboard.y < board.y, 'The overall leaderboard must precede the Board preview.');
        }
        if (width === 390 && ['/', '/stats', '/matches', '/solo', '/board'].includes(route)) {
          await page.screenshot({ path: path.join(output, `${theme}-${route === '/' ? 'home' : route.slice(1)}-390.png`), fullPage: true });
        }
        results.push({ route, theme, width, overflow: false });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`${origin}/matches`);
  await page.getByRole('heading', { name: 'Record a New Match' }).waitFor();
  await page.getByRole('button', { name: '☰ Menu' }).click();
  for (const name of ['Solo Play', 'League Night', 'League Board', 'Invites']) assert(await page.getByRole('link', { name, exact: true }).isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: '☰ Menu' }).getAttribute('aria-expanded'), 'false');
  assert(await page.getByRole('button', { name: '☰ Menu' }).evaluate(element => element === document.activeElement));
  await page.getByLabel('Player 1', { exact: true }).selectOption(captain);
  await page.getByLabel('Player 2', { exact: true }).selectOption('22222222-2222-4222-8222-222222222222');
  await page.getByLabel('Player 1 3DA').fill('60');
  await page.getByLabel('Player 2 3DA').fill('55');
  await page.getByLabel('Winner', { exact: true }).selectOption(captain);
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await page.getByRole('button', { name: 'Check / retry save' }).waitFor();
  assert(await page.getByLabel('Game type').isDisabled());
  await page.getByRole('button', { name: 'Check / retry save' }).click();
  await page.getByText('✓ Saved match #101 — previous save confirmed.').waitFor();
  assert.equal(saves.length, 2);
  assert.deepEqual(saves[0], saves[1]);
  assert.equal(saves[0].p_payload.submitted_by, captain);
  assert(await page.getByLabel('Game type').isEnabled());
  await page.goto(`${origin}/change-log`);
  await page.getByText('Synthetic release note 1', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await page.getByText('Synthetic release note 2', { exact: true }).waitFor();
  assert.equal(await page.getByText('Synthetic release note 1', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await page.goto(`${origin}/profiles/${captain}`);
  await page.getByText('Sign in to view player profiles.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Player not found' }).count(), 0);
  assert.deepEqual(errors, [], 'Browser exceptions');
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ source: 'synthetic-only', renders: results.length, results, saveRetry: 'same operation and payload', menu: 'links and Escape focus passed', changeLog: 'pages 1 and 2', guestProfile: 'sign-in state', errors }, null, 2));
  process.stdout.write(`${results.length} synthetic route/theme/width checks; menu, atomic retry, Change Log pagination and guest profile passed.\n`);
} finally {
  await browser.close();
}
