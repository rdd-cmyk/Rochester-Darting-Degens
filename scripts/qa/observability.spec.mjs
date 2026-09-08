import { createRequire } from 'node:module';
import path from 'node:path';
import { localStatus } from '../local-environment.mjs';

const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright package directory.');
const { test, expect } = require(path.join(process.env.RDD_PLAYWRIGHT_ROOT, 'test.js'));
localStatus(); // Validate the target without printing credentials.

test('production telemetry wiring, client navigation and privacy callbacks without hosted collection', async ({ page, context }) => {
  const unexpected = [];
  const errors = [];
  const scriptRequests = [];
  const scripts = ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js'];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['http://127.0.0.1:3000', 'http://127.0.0.1:54321'].includes(url.origin)) {
      unexpected.push(url.origin);
      return route.abort('blockedbyclient');
    }
    if (url.origin === 'http://127.0.0.1:3000' && scripts.includes(url.pathname)) {
      scriptRequests.push(url.pathname);
      // Deliberately do not emulate collection or fetch the hosted script.
      // The real SDK queues remain available to inspect the wired callbacks.
      return route.fulfill({ contentType: 'application/javascript', body: '/* local transport stub: no collection */' });
    }
    if (url.pathname.startsWith('/_vercel/')) {
      unexpected.push(url.pathname);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/auth');
  const analytics = page.locator('script[data-sdkn="@vercel/analytics/next"]');
  const speed = page.locator('script[data-sdkn="@vercel/speed-insights/next"]');
  await expect(analytics).toHaveCount(1);
  await expect(speed).toHaveCount(1);
  await expect(analytics).toHaveAttribute('data-sdkv', '2.0.1');
  await expect(speed).toHaveAttribute('data-sdkv', '2.0.0');
  await expect(speed).not.toHaveAttribute('data-sample-rate');

  // Actual Next Link navigation should reuse the root layout and SDK scripts.
  await page.getByRole('link', { name: 'Advanced Stats', exact: true }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(speed).toHaveAttribute('data-route', '/stats');
  await page.getByRole('link', { name: 'Matches', exact: true }).click();
  await expect(page).toHaveURL(/\/matches$/);
  await expect(speed).toHaveAttribute('data-route', '/matches');
  await expect(analytics).toHaveCount(1);
  await expect(speed).toHaveCount(1);
  expect(scriptRequests.sort()).toEqual([...scripts].sort());

  const callbacks = await page.evaluate(() => {
    const filters = [window.vaq, window.siq].map(queue => queue?.find(([name]) => name === 'beforeSend')?.[1]);
    return filters.map(filter => {
      if (typeof filter !== 'function') return { installed: false };
      return {
        installed: true,
        authDropped: filter({ type: 'pageview', url: 'https://example.test/auth/verify-email?email=synthetic@example.test' }) === null,
        recoveryDropped: filter({ type: 'vital', url: 'https://example.test/reset-password#fixture' }) === null,
        profileUrl: filter({ type: 'pageview', url: 'https://example.test/profiles/synthetic-id?private=fixture#fixture' })?.url,
        statsUrl: filter({ type: 'vital', url: 'https://example.test/stats?private=fixture' })?.url,
      };
    });
  });
  expect(callbacks).toEqual(Array(2).fill({ installed: true, authDropped: true, recoveryDropped: true,
    profileUrl: 'https://example.test/profiles/[id]', statsUrl: 'https://example.test/stats' }));
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
});
