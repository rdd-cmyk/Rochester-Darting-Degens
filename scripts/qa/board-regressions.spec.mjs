import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from '../local-environment.mjs';

const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright package directory.');
const { test, expect } = require(path.join(process.env.RDD_PLAYWRIGHT_ROOT, 'test.js'));
const status = localStatus();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const unwrap = result => { if (result.error) throw new Error(result.error.message); return result.data; };
let user;

test.beforeEach(async ({ page, context }) => {
  const password = `Regression-${randomUUID()}!`;
  const email = `board-regression-${randomUUID()}@example.test`;
  user = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  unwrap(await admin.from('profiles').upsert({ id: user.id, display_name: 'Temporary board regression', include_first_name_in_display: false }));
  unwrap(await admin.from('board_members').insert({ user_id: user.id, status: 'approved', role: 'organizer' }));
  await context.addInitScript(() => localStorage.setItem('summer-overlay-enabled', 'false'));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http://127.0.0.1:3100', 'http://127.0.0.1:54321'].includes(url.origin) ? route.continue() : route.abort('blockedbyclient');
  });
  await page.goto('/auth?next=%2Fboard');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/board$/);
});

test.afterEach(async () => {
  // Only this run's fresh identity/content are removed; demo accounts stay intact.
  if (user) {
    unwrap(await admin.from('board_posts').delete().eq('author_id', user.id));
    unwrap(await admin.auth.admin.deleteUser(user.id));
    user = undefined;
  }
});

async function longConversation(page) {
  const id = randomUUID();
  unwrap(await admin.from('board_posts').insert({ id, author_id: user.id, body: 'Pagination regression conversation' }));
  unwrap(await admin.from('board_replies').insert(Array.from({ length: 33 }, (_, index) => ({
    id: randomUUID(), post_id: id, author_id: user.id, body: `Historical reply ${index + 1}`,
    created_at: new Date(Date.now() - (60 - index) * 60000).toISOString(),
  }))));
  await page.goto(`/board/${id}`);
  await expect(page.getByText('Historical reply 30', { exact: true })).toBeVisible();
  return id;
}

test('edited post and reply retries preserve drafts after the original commit loses its response', async ({ page }) => {
  let postId;
  for (const kind of ['post', 'reply']) {
    if (kind === 'post') await page.getByRole('button', { name: 'What’s happening, Degens?' }).click();
    else await page.goto(`/board/${postId}`);
    const label = kind === 'post' ? 'Your post' : 'Your reply';
    const submitLabel = kind === 'post' ? 'Post to league' : 'Post reply';
    const draftKey = `rdd-board:${user.id}:${kind === 'post' ? 'post' : `reply:${postId}`}`;
    const original = `Original committed ${kind}`;
    const revised = `Revised ${kind} after lost response`;
    const composer = page.locator('.board-composer').first();
    let dropped = false;
    const intercept = async route => {
      if (!dropped && route.request().postDataJSON()?.p_action === `create_${kind}`) {
        dropped = true;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort('failed');
      } else await route.continue();
    };
    await page.route('**/rest/v1/rpc/board_write', intercept);
    await page.getByLabel(label, { exact: true }).fill(original);
    await page.getByRole('button', { name: submitLabel, exact: true }).click();
    await expect(composer.getByRole('alert')).toContainText('Your draft is kept');
    const attempted = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), draftKey);
    await page.getByLabel(label, { exact: true }).fill(revised);
    await page.getByRole('button', { name: submitLabel, exact: true }).click();
    await expect(composer.getByRole('alert')).toContainText('Your revised draft is kept');
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(revised);
    const saved = unwrap(await admin.from(`board_${kind === 'post' ? 'posts' : 'replies'}`).select('id,body').eq('id', attempted.id).single());
    expect(saved.body).toBe(original);
    if (kind === 'post') postId = saved.id;
    await expect(composer.getByRole('link', { name: 'Open saved conversation' })).toHaveAttribute('href', `/board/${postId}`);
    const persisted = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), draftKey);
    expect(persisted).toMatchObject({ id: attempted.id, body: revised });
    await composer.getByRole('button', { name: 'Use draft for a separate contribution' }).click();
    const separate = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), draftKey);
    expect(separate.id).not.toBe(attempted.id);
    expect(separate.body).toBe(revised);
    const table = `board_${kind === 'post' ? 'posts' : 'replies'}`;
    expect(unwrap(await admin.from(table).select('id').eq('id', separate.id))).toHaveLength(0);
    await page.getByRole('button', { name: submitLabel, exact: true }).click();
    await expect(composer.getByText('Saved to the league.', { exact: true })).toBeVisible();
    expect(unwrap(await admin.from(table).select('body').eq('id', separate.id).single()).body).toBe(revised);
    expect(await page.evaluate(key => sessionStorage.getItem(key), draftKey)).toBeNull();
    await page.unroute('**/rest/v1/rpc/board_write', intercept);
  }
});

test('loaded reply pages survive saving and reaction refreshes', async ({ page }) => {
  await longConversation(page);
  await page.getByRole('button', { name: 'Load more replies' }).click();
  await expect(page.getByText('Historical reply 33', { exact: true })).toBeVisible();
  await page.getByLabel('Your reply', { exact: true }).fill('Newest reply on loaded pages');
  await page.getByRole('button', { name: 'Post reply', exact: true }).click();
  await expect(page.getByRole('button', { name: '34 replies', exact: true })).toBeVisible();
  await expect(page.getByText('Newest reply on loaded pages', { exact: true })).toBeVisible();
  await expect(page.getByText('Historical reply 33', { exact: true })).toBeVisible();
  await expect(page.locator('.board-reply')).toHaveCount(34);
  await page.getByRole('button', { name: 'Cheers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cheers · 1 · You', exact: true })).toBeVisible();
  await expect(page.getByText('Historical reply 33', { exact: true })).toBeVisible();
  await expect(page.getByText('Newest reply on loaded pages', { exact: true })).toBeVisible();
});

test('organizers can hide a recent reply beyond unopened pages', async ({ page }) => {
  const postId = await longConversation(page);
  await page.getByLabel('Your reply', { exact: true }).fill('Recent reply to hide');
  await page.getByRole('button', { name: 'Post reply', exact: true }).click();
  await expect(page.getByRole('button', { name: '34 replies', exact: true })).toBeVisible();
  const recent = page.locator('[aria-label="Your recent replies"]');
  await expect(recent.getByText('Recent reply to hide', { exact: true })).toBeVisible();
  await recent.locator('summary').click();
  await recent.getByRole('button', { name: 'Hide reply', exact: true }).click();
  await expect(page.getByRole('button', { name: '33 replies', exact: true })).toBeVisible();
  await expect(page.getByText('Recent reply to hide', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Historical reply 30', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load more replies' })).toBeVisible();
  const hidden = unwrap(await admin.from('board_replies').select('hidden').eq('post_id', postId).eq('body', 'Recent reply to hide').single());
  expect(hidden.hidden).toBe(true);
});
