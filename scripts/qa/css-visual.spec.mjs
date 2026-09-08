import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright package directory.');
const { test, expect } = require(path.join(process.env.RDD_PLAYWRIGHT_ROOT, 'test.js'));
// Optional replay of the preserved pre-upgrade production CSS on the otherwise
// unchanged app, for refining baseline assertions without changing dependencies.
// Never enable this when verifying the candidate. This project emits one CSS file.
const baselineCss = process.env.RDD_CSS_REPLAY_BASELINE === '1'
  ? readFileSync(new URL('../../.qa-artifacts/css-build-before/baseline.css', import.meta.url), 'utf8') : null;

// Requires the existing local-acceptance synthetic captain and league history.
// This suite signs in and reads only. Do not mutate fixtures between baseline
// and candidate runs. Missing baselines fail unless explicitly recording them.
for (const colorScheme of ['light', 'dark']) {
  for (const [size, viewport] of Object.entries({
    desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 },
  })) {
    test.describe(`${size}-${colorScheme}`, () => {
      test.use({ viewport, colorScheme });
      for (const [name, route, heading] of [
        ['main', '/', 'Overall Leaderboard (All Match Types)'],
        ['matches', '/matches', 'Darts Matches'],
        ['stats', '/stats', 'Power leaderboard'],
      ]) {
        test(name, async ({ page, context }) => {
          if (baselineCss !== null && test.info().config.updateSnapshots !== 'all') {
            throw new Error('Baseline replay is recording-only: explicitly use --update-snapshots=all, then unset RDD_CSS_REPLAY_BASELINE for candidate verification.');
          }
          const external = [];
          const errors = [];
          const stylesheets = new Set();
          await context.route('**/*', request => {
            const url = new URL(request.request().url());
            const origin = url.origin;
            if (origin === 'http://127.0.0.1:3000' && url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.css')) {
              stylesheets.add(url.pathname);
              if (baselineCss !== null) return request.fulfill({ contentType: 'text/css', body: baselineCss });
            }
            if (['http://127.0.0.1:3000', 'http://127.0.0.1:54321'].includes(origin)) return request.continue();
            external.push(origin);
            return request.abort('blockedbyclient');
          });
          page.on('pageerror', error => errors.push(error.message));
          await page.goto('/auth');
          await page.getByLabel('Email', { exact: true }).fill('demo-captain@example.test');
          await page.getByLabel('Password', { exact: true }).fill('Local-Darts-Demo-2026!');
          await page.locator('form button[type=submit]').click();
          await expect(page.getByRole('heading', { name: 'Darts Matches', exact: true })).toBeVisible();
          await page.goto(route);
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
          // Disable animation after the last document navigation. Persisting
          // "off" across a reload exposes an existing LayoutShell hydration
          // mismatch (server defaults to "on"), unrelated to CSS tooling.
          await page.getByRole('button', { name: 'Summer: On', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Summer: Off', exact: true })).toBeVisible();
          if (name === 'main') {
            const logo = page.getByAltText('Rochester Darting Degens logo', { exact: true });
            await expect.poll(() => logo.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
            const overall = page.locator('section').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
            await expect(overall.getByRole('link', { name: 'Demo captain', exact: true })).toBeVisible();
            await expect(overall.getByRole('link', { name: 'Demo rival', exact: true })).toBeVisible();
            await expect(page.getByText('Error loading leaderboard.', { exact: true })).toHaveCount(0);
            await expect(page.getByRole('combobox', { name: /^Select game type/ })).toBeEnabled();
          }
          if (name === 'matches') {
            // Date input defaults to the wall clock; stabilize visible form data.
            await page.locator('input[type="datetime-local"]').fill('2026-09-08T12:00');
          }
          if (name === 'stats') {
            await page.getByLabel('Game type').selectOption('501');
            await expect(page.getByRole('heading', { name: /consistency/i })).toBeVisible();
          }
          await page.evaluate(() => document.fonts.ready);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
          const prefix = `${name}-${size}-${colorScheme}`;
          await expect(page).toHaveScreenshot(`${prefix}.png`, { fullPage: name === 'stats' });
          // Include the entire match-entry surface, not only the top viewport.
          if (name === 'matches') await expect(page.locator('form').first()).toHaveScreenshot(`${prefix}-form.png`);
          const control = name === 'main' ? page.getByRole('combobox', { name: /^Select game type/ })
            : name === 'matches' ? page.locator('#playedAt') : page.getByRole('combobox', { name: 'Game type', exact: true });
          // Enter the actual control through keyboard navigation. A padded page
          // crop preserves its exterior focus ring, unlike an element screenshot.
          await control.focus();
          await page.keyboard.press('Shift+Tab');
          await page.keyboard.press('Tab');
          await expect(control).toBeFocused();
          await control.scrollIntoViewIfNeeded();
          const box = await control.boundingBox();
          if (!box) throw new Error('Expected a visible focus control.');
          const x = Math.max(0, box.x - 8), y = Math.max(0, box.y - 8);
          await expect(page).toHaveScreenshot(`${prefix}-focus.png`, { clip: {
            x, y, width: Math.min(viewport.width - x, box.width + 16), height: Math.min(viewport.height - y, box.height + 16),
          } });
          if (size === 'mobile') {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.getByRole('button', { name: /menu/i }).click();
            await expect(page.getByRole('link', { name: 'Advanced Stats', exact: true })).toBeVisible();
            await expect(page).toHaveScreenshot(`${prefix}-menu.png`);
          }
          expect(external).toEqual([]);
          expect(errors).toEqual([]);
          expect(stylesheets.size, 'Expected exactly one production stylesheet').toBe(1);
        });
      }
    });
  }
}
