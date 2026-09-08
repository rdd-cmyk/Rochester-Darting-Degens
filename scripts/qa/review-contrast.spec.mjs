import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright package directory.');
const { test, expect } = require(path.join(process.env.RDD_PLAYWRIGHT_ROOT, 'test.js'));

// Read-only UI checks using the local-acceptance synthetic captain and history.
function luminance(rgb) {
  const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

for (const colorScheme of ['light', 'dark']) {
  for (const [size, viewport] of Object.entries({
    desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 },
  })) {
    test.describe(`${size}-${colorScheme}`, () => {
      test.use({ colorScheme, viewport });
      test('rendered axis and story labels have readable contrast', async ({ page, context }, testInfo) => {
        const external = [], errors = [];
        await context.route('**/*', route => {
          const origin = new URL(route.request().url()).origin;
          if (['http://127.0.0.1:3001', 'http://127.0.0.1:54321'].includes(origin)) return route.continue();
          external.push(origin);
          return route.abort('blockedbyclient');
        });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('/auth');
        await page.getByLabel('Email', { exact: true }).fill('demo-captain@example.test');
        await page.getByLabel('Password', { exact: true }).fill('Local-Darts-Demo-2026!');
        await page.locator('form button[type=submit]').click();
        await expect(page.getByRole('heading', { name: 'Darts Matches', exact: true })).toBeVisible();
        await page.goto('/stats');
        await expect(page.getByRole('heading', { name: 'Power leaderboard', exact: true })).toBeVisible();
        const axis = page.locator('.stats-rating-chart text[text-anchor="end"]');
        const eyebrows = page.locator('.stats-story-card .stats-eyebrow');
        await expect(axis).toHaveCount(3);
        await expect(eyebrows.first()).toBeVisible();
        for (const [labels, property, panel] of [
          [axis, 'fill', '.stats-panel'], [eyebrows, 'color', '.stats-story-card'],
        ]) {
          for (const label of await labels.all()) {
            const colors = await label.evaluate((element, { property, panel }) => ({
              foreground: getComputedStyle(element)[property],
              background: getComputedStyle(element.closest(panel)).backgroundColor,
            }), { property, panel });
            const values = Object.values(colors).map(luminance);
            const ratio = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
            expect(ratio, `${property}: ${JSON.stringify(colors)}`).toBeGreaterThanOrEqual(4.5);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.getByRole('button', { name: 'Summer: On', exact: true }).click();
        await page.screenshot({ path: testInfo.outputPath('stats.png'), fullPage: true, animations: 'disabled' });
        expect(external).toEqual([]);
        expect(errors).toEqual([]);
      });
    });
  }
}
