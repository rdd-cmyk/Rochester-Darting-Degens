import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
delete process.env.RDD_LOCAL_STACK;
const { localStatus } = await import('../local-environment.mjs');

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

test('a delayed save after navigation cannot erase a revised draft', async ({ page }) => {
  const draftKey = `rdd-board:${user.id}:post`;
  let releaseResponse;
  let markCommitted;
  const heldResponse = new Promise(resolve => { releaseResponse = resolve; });
  const committed = new Promise(resolve => { markCommitted = resolve; });
  let held = false;
  const intercept = async route => {
    if (!held && route.request().postDataJSON()?.p_action === 'create_post') {
      held = true;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      markCommitted();
      await heldResponse;
      await route.fulfill({ response });
    } else await route.continue();
  };
  await page.route('**/rest/v1/rpc/board_write', intercept);
  try {
    await page.getByRole('button', { name: 'What’s happening, Degens?' }).click();
    await page.getByLabel('Your post', { exact: true }).fill('Pending save before navigation');
    await page.getByRole('button', { name: 'Post to league', exact: true }).click();
    await committed;
    const attempted = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), draftKey);
    const nav = page.getByRole('navigation');
    // Client navigation retains the old pending promise in this document.
    await nav.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await nav.getByRole('link', { name: 'League Board', exact: true }).click();
    await expect(page.getByLabel('Your post', { exact: true })).toHaveValue('Pending save before navigation');
    await page.getByLabel('Your post', { exact: true }).fill('Revised writing after returning');
    const responseFinished = page.waitForEvent('requestfinished', request => request.url().endsWith('/rest/v1/rpc/board_write'));
    releaseResponse();
    await responseFinished;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), draftKey)).toMatchObject({ id: attempted.id, body: 'Revised writing after returning' });
    await page.reload();
    await expect(page.getByLabel('Your post', { exact: true })).toHaveValue('Revised writing after returning');
    expect(unwrap(await admin.from('board_posts').select('body').eq('id', attempted.id).single()).body).toBe('Pending save before navigation');
  } finally {
    releaseResponse();
    await page.unroute('**/rest/v1/rpc/board_write', intercept);
  }
});

test('second-page actions retain an open conversation and draft despite new activity', async ({ page }) => {
  const prefix = `Feed window ${randomUUID()}`;
  const timestamp = Date.now() + 60000;
  const posts = Array.from({ length: 40 }, (_, index) => ({
    id: randomUUID(), author_id: user.id, body: `${prefix} conversation ${index + 1}`,
    created_at: new Date(timestamp - index * 1000).toISOString(),
    last_activity: new Date(timestamp - index * 1000).toISOString(),
  }));
  // Exercise real PostgreSQL microseconds with UUIDs ordered against the time.
  const boundarySecond = new Date(timestamp - 40000).toISOString().replace(/\.\d{3}Z$/, '');
  posts[38].id = `00000000-0000-4000-a000-${randomUUID().slice(-12)}`;
  posts[38].last_activity = `${boundarySecond}.123902Z`;
  posts[39].id = `ffffffff-ffff-4fff-afff-${randomUUID().slice(-12)}`;
  posts[39].last_activity = `${boundarySecond}.123901Z`;
  unwrap(await admin.from('board_posts').insert(posts));
  // Start the loaded window after fixtures exist; an in-flight initial read
  // could otherwise remember an older boundary and refresh through all rows.
  await page.goto('/board');
  await expect(page.getByText(`${prefix} conversation 20`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load more conversations', exact: true }).click();
  const conversation = page.getByRole('article').filter({ has: page.getByText(`${prefix} conversation 40`, { exact: true }) });
  await conversation.getByRole('button', { name: 'Reply', exact: true }).click();
  await conversation.getByLabel('Your reply', { exact: true }).fill('Keep this second-page reply draft');
  unwrap(await admin.from('board_posts').insert({
    id: randomUUID(), author_id: user.id, body: `${prefix} new external conversation`,
    last_activity: new Date(timestamp + 1000).toISOString(),
  }));
  await conversation.getByRole('button', { name: 'Cheers', exact: true }).click();
  await expect(conversation.getByRole('button', { name: 'Cheers · 1 · You', exact: true })).toBeVisible();
  await expect(page.getByText(`${prefix} new external conversation`, { exact: true })).toBeVisible();
  await expect(conversation.getByLabel('Your reply', { exact: true })).toHaveValue('Keep this second-page reply draft');
  await conversation.locator('.board-tools').first().locator('summary').click();
  await conversation.getByRole('button', { name: 'Edit post', exact: true }).click();
  await conversation.getByLabel('Edit post', { exact: true }).fill(`${prefix} edited second-page conversation`);
  await conversation.getByRole('button', { name: 'Save changes', exact: true }).click();
  const edited = page.getByRole('article').filter({ has: page.getByText(`${prefix} edited second-page conversation`, { exact: true }) });
  await expect(edited.getByLabel('Your reply', { exact: true })).toHaveValue('Keep this second-page reply draft');
  expect(await page.evaluate(key => sessionStorage.getItem(key), `rdd-board:${user.id}:edit:${posts[39].id}`)).toBeNull();
});

test('feed outages preserve loaded conversations, the pin and an open draft until retry succeeds', async ({ page }) => {
  const prefix = `Feed outage ${randomUUID()}`;
  const timestamp = Date.now() + 60000;
  const posts = Array.from({ length: 21 }, (_, index) => ({
    id: randomUUID(), author_id: user.id, body: `${prefix} conversation ${index + 1}`,
    last_activity: new Date(timestamp - index * 1000).toISOString(),
  }));
  unwrap(await admin.from('board_posts').insert(posts));
  await page.goto('/board');
  await expect(page.getByText(`${prefix} conversation 20`, { exact: true })).toBeVisible();
  const pinCount = await page.locator('.board-pinned').count();
  const conversation = page.getByRole('article').filter({ has: page.locator(`#replies-${posts[0].id}`) });
  await conversation.getByRole('button', { name: 'Reply', exact: true }).click();
  await conversation.getByLabel('Your reply', { exact: true }).fill('Draft kept through feed outages');
  let outage = false;
  const intercept = route => outage ? route.abort('failed') : route.continue();
  await page.route('**/rest/v1/rpc/board_feed', intercept);
  try {
    for (const action of ['Load more conversations', 'Refresh']) {
      outage = true;
      await page.getByRole('button', { name: action, exact: true }).click();
      await expect(page.getByRole('button', { name: 'Retry conversations', exact: true })).toBeVisible();
      await expect(page.getByText(`${prefix} conversation 20`, { exact: true })).toBeVisible();
      await expect(page.locator('.board-pinned')).toHaveCount(pinCount);
      await expect(conversation.getByLabel('Your reply', { exact: true })).toHaveValue('Draft kept through feed outages');
      if (action === 'Refresh') {
        unwrap(await admin.from('board_posts').update({ body: `${prefix} updated conversation` }).eq('id', posts[0].id));
        unwrap(await admin.from('board_posts').update({ hidden: true }).eq('id', posts[4].id));
      }
      outage = false;
      await page.getByRole('button', { name: 'Retry conversations', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Retry conversations', exact: true })).toHaveCount(0);
      await expect(conversation.getByLabel('Your reply', { exact: true })).toHaveValue('Draft kept through feed outages');
    }
    await expect(page.getByText(`${prefix} updated conversation`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${prefix} conversation 5`, { exact: true })).toHaveCount(0);
  } finally {
    outage = false;
    await page.unroute('**/rest/v1/rpc/board_feed', intercept);
  }
});

test('reply outages preserve loaded and confirmed recent replies, and retry removes hidden content', async ({ page }) => {
  const postId = await longConversation(page);
  await page.getByLabel('Your reply', { exact: true }).fill('Confirmed reply kept through outages');
  await page.getByRole('button', { name: 'Post reply', exact: true }).click();
  await expect(page.getByText('Confirmed reply kept through outages', { exact: true })).toBeVisible();
  const saved = unwrap(await admin.from('board_replies').select('id,body').eq('post_id', postId).eq('body', 'Confirmed reply kept through outages').single());
  await page.getByLabel('Your reply', { exact: true }).fill('Unfinished next reply during outage');
  let threadOutage = false;
  let recentOutage = false;
  const interceptThread = route => threadOutage ? route.abort('failed') : route.continue();
  const interceptRecent = route => recentOutage ? route.abort('failed') : route.continue();
  await page.route('**/rest/v1/rpc/board_thread', interceptThread);
  await page.route('**/rest/v1/board_replies?*', interceptRecent);
  try {
    for (const action of ['load more', 'refresh', 'recent reply read']) {
      threadOutage = action !== 'recent reply read';
      recentOutage = action === 'recent reply read';
      if (action === 'load more') await page.getByRole('button', { name: 'Load more replies', exact: true }).click();
      else if (action === 'refresh') await page.getByRole('button', { name: /^Cheers/ }).click();
      else await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Retry replies', exact: true })).toBeVisible();
      await expect(page.getByText('Historical reply 30', { exact: true })).toBeVisible();
      await expect(page.getByText('Confirmed reply kept through outages', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Your reply', { exact: true })).toHaveValue('Unfinished next reply during outage');
      if (action === 'recent reply read') unwrap(await admin.from('board_replies').update({ hidden: true }).eq('id', saved.id));
      threadOutage = false; recentOutage = false;
      await page.getByRole('button', { name: 'Retry replies', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Retry replies', exact: true })).toHaveCount(0);
      await expect(page.getByText('Historical reply 30', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Your reply', { exact: true })).toHaveValue('Unfinished next reply during outage');
    }
    await expect(page.getByText('Confirmed reply kept through outages', { exact: true })).toHaveCount(0);
    expect(unwrap(await admin.from('board_replies').select('body,hidden').eq('id', saved.id).single())).toMatchObject({ body: saved.body, hidden: true });
    unwrap(await admin.from('board_posts').update({ hidden: true }).eq('id', postId));
    await page.getByRole('button', { name: 'Load more replies', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('no longer available');
    await expect(page.getByText('Historical reply 30', { exact: true })).toHaveCount(0);
  } finally {
    threadOutage = false; recentOutage = false;
    await page.unroute('**/rest/v1/rpc/board_thread', interceptThread);
    await page.unroute('**/rest/v1/board_replies?*', interceptRecent);
  }
});

test('uncoded HTTP access denials clear cached feed and reply content', async ({ page }) => {
  const postId = randomUUID();
  const body = `Private denial regression ${randomUUID()}`;
  unwrap(await admin.from('board_posts').insert({ id: postId, author_id: user.id, body }));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  const denyFeed = route => route.request().postDataJSON()?.p_pinned
    ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Regression access denied' }) })
    : route.abort('failed');
  await page.route('**/rest/v1/rpc/board_feed', denyFeed);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Your access changed');
  await expect(page.getByText(body, { exact: true })).toHaveCount(0);
  await page.unroute('**/rest/v1/rpc/board_feed', denyFeed);
  await longConversation(page);
  await page.getByLabel('Your reply', { exact: true }).fill('Private confirmed reply to clear');
  await page.getByRole('button', { name: 'Post reply', exact: true }).click();
  await expect(page.getByText('Private confirmed reply to clear', { exact: true })).toBeVisible();
  const denyReplies = route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Regression authentication denied' }) });
  await page.route('**/rest/v1/rpc/board_thread', denyReplies);
  await page.getByRole('button', { name: /^Cheers/ }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Your access changed');
  await expect(page.getByText('Historical reply 30', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Private confirmed reply to clear', { exact: true })).toHaveCount(0);
  await page.unroute('**/rest/v1/rpc/board_thread', denyReplies);
});

test('rebased navigation preserves Board, League Night and planning routes on desktop and mobile', async ({ page }) => {
  const nav = page.getByRole('navigation');
  for (const width of [1366, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 640) await nav.getByRole('button', { name: '☰ Menu', exact: true }).click();
    await expect(nav.getByRole('link', { name: 'League Board', exact: true })).toBeVisible();
    await nav.getByRole('link', { name: 'League Night', exact: true }).click();
    await expect(page).toHaveURL(/\/league-night$/);
    await expect(page.getByRole('heading', { name: 'Good darts. Better company.', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Plan & RSVP →', exact: true }).click();
    await expect(page).toHaveURL(/\/league-night\/plan$/);
    await expect(page.getByRole('heading', { name: 'Make the next night happen.', exact: true })).toBeVisible();
    if (width < 640) await nav.getByRole('button', { name: '☰ Menu', exact: true }).click();
    await nav.getByRole('link', { name: 'League Board', exact: true }).click();
    await expect(page).toHaveURL(/\/board$/);
    await expect(page.getByRole('heading', { name: 'League Board', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
