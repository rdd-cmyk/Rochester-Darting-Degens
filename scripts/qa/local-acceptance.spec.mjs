import { createRequire } from 'node:module';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { localStatus, root } from '../local-environment.mjs';

// Standard Playwright Test, supplied by the QA runtime, not a homebrew runner.
// Keep dependency upgrades in their separately approved delivery packages.
const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright package directory.');
const { test, expect } = require(path.join(process.env.RDD_PLAYWRIGHT_ROOT, 'test.js'));
const status = localStatus();
const password = 'Local-Darts-Demo-2026!'; // Synthetic localhost accounts only.
const client = () => createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const unwrap = result => { if (result.error) throw new Error(result.error.message); return result.data; };

async function account(name) {
  const db = client();
  const email = `demo-${name}@example.test`;
  let auth = await db.auth.signInWithPassword({ email, password });
  if (auth.error) auth = await db.auth.signUp({ email, password, options: {
    data: { display_name: `Demo ${name}`, first_name: 'Demo', last_name: 'Synthetic', include_first_name_in_display: false },
  } });
  const data = unwrap(auth);
  if (!data.session) throw new Error('Expected confirmation-disabled local Auth.');
  unwrap(await db.from('profiles').upsert({ id: data.user.id, display_name: `Demo ${name}`,
    first_name: 'Demo', last_name: 'Synthetic', include_first_name_in_display: false }));
  return { db, id: data.user.id, email };
}

async function signIn(page, email) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('form button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'Darts Matches', exact: true })).toBeVisible();
}

test('local Auth, match persistence, denied access, statistics filters and responsive preview', async ({ page, context, browser }) => {
  const nonlocal = [];
  const pageErrors = [];
  // Browser writes may only reach this preview and its loopback Supabase API.
  async function isolate(ctx) {
    await ctx.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http://127.0.0.1:3000', 'http://127.0.0.1:54321'].includes(url.origin)) return route.continue();
      nonlocal.push(url.origin);
      return route.abort('blockedbyclient');
    });
  }
  await isolate(context);
  page.on('pageerror', error => pageErrors.push(error.message));
  const captain = await account('captain');
  const rival = await account('rival');
  const rookie = await account('rookie');

  await test.step('seed clearly synthetic league history using ordinary authenticated APIs', async () => {
    const prior = unwrap(await captain.db.from('matches').select('id').eq('notes', 'RDD synthetic demo'));
    if (!prior.length) {
      const players = [captain, rival, rookie];
      for (let i = 0; i < 18; i++) {
        const pair = [players[i % 3], players[(i + 1) % 3]];
        const cricket = i % 2 === 1;
        const match = unwrap(await captain.db.from('matches').insert({
          created_by: captain.id, played_at: new Date(Date.now() - (20 - i) * 86400000).toISOString(),
          game_type: cricket ? 'Cricket' : '501', board_type: i % 4 < 2 ? 'Steel Tip' : 'Soft Tip',
          venue: 'Synthetic Demo League', notes: 'RDD synthetic demo',
        }).select().single());
        unwrap(await captain.db.from('match_players').insert(pair.map((p, n) => ({
          match_id: match.id, player_id: p.id, is_winner: n === (i % 5 === 0 ? 1 : 0),
          score: cricket ? Number((2.1 + ((i + n * 2) % 9) / 10).toFixed(2)) : 48 + (i * 3 + n * 7) % 30,
          points_scored: cricket ? 30 + i : null,
        }))));
      }
    }
  });

  await test.step('signed-out access and browser signup', async () => {
    await page.goto('/matches');
    await expect(page.getByText('You must be signed in to view and add matches.')).toBeVisible();
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await page.getByLabel('First name', { exact: true }).fill('Synthetic');
    await page.getByLabel('Last name', { exact: true }).fill('Signup');
    await page.getByLabel('Display name', { exact: true }).fill('Demo signup');
    await page.getByLabel('Email', { exact: true }).fill(`signup-${Date.now()}@example.test`);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.locator('form button[type=submit]').click();
    // Existing UI shows verify-email even when local Auth issues a session.
    await expect(page).toHaveURL(/auth\/verify-email/);
    await page.goto('/matches');
    await expect(page.getByRole('heading', { name: 'Darts Matches', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();
    await page.goto('/matches');
    await expect(page.getByText('You must be signed in to view and add matches.')).toBeVisible();
  });

  let matchId;
  const note = `Browser acceptance ${Date.now()}`;
  await test.step('sign in, create, reload and edit a persisted match', async () => {
    await signIn(page, captain.email);
    const selects = page.locator('form select');
    await selects.nth(3).selectOption(captain.id);
    await selects.nth(4).selectOption(rival.id);
    await selects.nth(5).selectOption(captain.id);
    await selects.nth(6).selectOption('Steel Tip');
    await page.getByPlaceholder('e.g. 87.50').nth(0).fill('75');
    await page.getByPlaceholder('e.g. 87.50').nth(1).fill('63');
    await page.getByPlaceholder("'Other' game type, e.g.").fill(note);
    await page.getByPlaceholder('Radio Social, e.g.').fill('Local Browser QA');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.getByText(`Notes: ${note}`, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(`Notes: ${note}`, { exact: true })).toBeVisible();
    const row = unwrap(await captain.db.from('matches').select('id').eq('notes', note).single());
    matchId = row.id;
    await page.getByRole('listitem').filter({ has: page.getByText(`Notes: ${note}`, { exact: true }) })
      .getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByPlaceholder('Radio Social, e.g.').fill('Local Browser QA edited');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ has: page.getByText(`Notes: ${note}`, { exact: true }) })
      .getByText('Venue: Local Browser QA edited', { exact: true })).toBeVisible();
    expect(unwrap(await captain.db.from('match_players').select('id').eq('match_id', matchId))).toHaveLength(2);
    expect(unwrap(await captain.db.from('matches').select('venue').eq('id', matchId).single()).venue).toBe('Local Browser QA edited');
  });

  await test.step('another user cannot edit; anonymous read and spoofed insert are denied', async () => {
    const second = await browser.newContext();
    try {
      await isolate(second);
      const otherPage = await second.newPage();
      await signIn(otherPage, rival.email);
      await expect(otherPage.getByText(`Notes: ${note}`, { exact: true })).toBeVisible();
      await expect(otherPage.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
      const update = unwrap(await rival.db.from('matches').update({ venue: 'Forbidden' }).eq('id', matchId).select());
      expect(update).toHaveLength(0);
      expect((await rival.db.from('matches').insert({ created_by: captain.id, game_type: '501' })).error?.code).toBe('42501');
      expect(unwrap(await client().from('matches').select('id'))).toHaveLength(0);
    } finally { await second.close(); }
  });

  await test.step('statistics filters, desktop/mobile rendering, sample guardrails', async () => {
    await page.goto('/stats');
    await expect(page.getByRole('heading', { name: 'Power leaderboard', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Summer: On', exact: true }).click();
    await page.getByLabel('Game type').selectOption('501');
    await expect(page.getByRole('heading', { name: /consistency/i })).toBeVisible();
    await page.screenshot({ path: path.join(root, 'test-results', 'statistics-desktop.png'), fullPage: true });
    await page.getByLabel('Game type').selectOption('Cricket');
    await expect(page.getByRole('heading', { name: /consistency/i })).toBeVisible();
    await page.getByRole('combobox', { name: 'Board', exact: true }).selectOption('Steel Tip');
    await page.getByLabel('Minimum games').selectOption('10');
    await expect(page.getByText('No eligible players', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Board', exact: true }).selectOption('All');
    await page.getByLabel('Minimum games').selectOption('3');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Power leaderboard', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(root, 'test-results', 'statistics-mobile.png'), fullPage: true });
  });
  expect(pageErrors).toEqual([]);
  expect(nonlocal).toEqual([]);
});

test('framework rendering, protected profiles, server route and image optimizer', async ({ page, context }) => {
  const nonlocal = [];
  const errors = [];
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    if (['http://127.0.0.1:3000', 'http://127.0.0.1:54321'].includes(origin)) return route.continue();
    nonlocal.push(origin);
    return route.abort('blockedbyclient');
  });
  page.on('pageerror', error => errors.push(error.message));
  for (const [route, message] of [
    ['/profile', 'You must be signed in to view or edit your profile.'],
    ['/profiles', 'You must be signed in to view profiles.'],
  ]) {
    await page.goto(route);
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  }
  const api = await page.request.get('/api/change-log');
  expect(api.status()).toBe(401);
  const captain = await account('captain');
  await signIn(page, captain.email);
  await page.goto('/auth');
  await expect(page).toHaveURL(/\/matches$/);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overall Leaderboard (All Match Types)', exact: true })).toBeVisible();
  const logo = page.getByAltText('Rochester Darting Degens logo', { exact: true });
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  const optimized = await page.request.get('/_next/image?url=%2Frdd-logo.png&w=256&q=75', {
    headers: { accept: 'image/webp' },
  });
  expect(optimized.status()).toBe(200);
  expect(optimized.headers()['content-type']).toBe('image/webp');
  expect((await optimized.body()).length).toBeGreaterThan(100);
  for (const route of ['/profile', '/profiles', `/profiles/${captain.id}`]) {
    const response = await page.goto(route);
    expect(response.status()).toBe(200);
    await expect(page.locator('main')).toContainText('Demo captain');
  }
  await page.goto('/auth/verify-email?email=synthetic%40example.test');
  await expect(page.getByRole('heading', { name: 'Check your email to verify your account' })).toBeVisible();
  await expect(page.locator('main')).toContainText('synthetic@example.test');
  expect(errors).toEqual([]);
  expect(nonlocal).toEqual([]);
});

test('password recovery through the local email inbox and renewed session', async ({ page, context }) => {
  const nonlocal = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    if (['http://127.0.0.1:3000', 'http://127.0.0.1:54321'].includes(origin)) return route.continue();
    nonlocal.push(origin);
    return route.abort('blockedbyclient');
  });
  const recovery = await account(`recovery-${Date.now()}`);
  await recovery.db.auth.signOut();
  await page.goto('/reset-password');
  await expect(page.getByText('No active reset session found. Please use the password reset link from your email again.')).toBeVisible();
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(recovery.email);
  await page.getByRole('button', { name: 'Forgot your password?' }).click();
  await expect(page.getByText('Password reset email sent. Check your inbox.')).toBeVisible();

  // Only the uniquely named synthetic recipient's local mail is retrieved.
  // Never print message content or recovery URLs/tokens into shared logs.
  let messageId;
  await expect.poll(async () => {
    const response = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${recovery.email}`)}`);
    if (!response.ok) return false;
    const result = await response.json();
    messageId = result.messages?.find(m => m.To?.some(to => to.Address === recovery.email))?.ID;
    return Boolean(messageId);
  }, { timeout: 15000 }).toBe(true);
  const mail = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${encodeURIComponent(messageId)}`)).json();
  const links = [...(mail.HTML ?? '').matchAll(/href="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'));
  const link = links.find(value => {
    try {
      const url = new URL(value);
      return url.origin === 'http://127.0.0.1:54321' && url.pathname === '/auth/v1/verify'
        && url.searchParams.get('type') === 'recovery'
        && url.searchParams.get('redirect_to') === 'http://127.0.0.1:3000/reset-password';
    } catch { return false; }
  });
  expect(Boolean(link), 'Expected a strictly local recovery link').toBe(true);
  try { await page.goto(link); } catch { throw new Error('Local recovery redirect failed.'); }
  await expect(page.getByRole('heading', { name: 'Reset Your Password', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/reset-password');
  await expect(page.getByText('No active reset session found. Please use the password reset link from your email again.')).toHaveCount(0);
  const updatedPassword = 'Renewed-Local-Darts-2026!';
  await page.locator('form input').nth(0).fill(updatedPassword);
  await page.locator('form input').nth(1).fill(updatedPassword);
  await page.getByRole('button', { name: 'Update Password', exact: true }).click();
  await expect(page.getByText('Password updated successfully. You can now sign in.')).toBeVisible();
  // Recovery establishes a session; /auth is only an intermediate redirect.
  // Finish that redirect before signing out and testing the new credentials.
  await expect(page).toHaveURL(/\/matches$/);
  await expect(page.getByRole('heading', { name: 'Darts Matches', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(recovery.email);
  await page.getByLabel('Password', { exact: true }).fill(updatedPassword);
  await page.locator('form button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'Darts Matches', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Darts Matches', exact: true })).toBeVisible();
  expect((await client().auth.signInWithPassword({ email: recovery.email, password })).error?.code).toBe('invalid_credentials');
  await test.step('refresh the renewed session and clear it on sign-out', async () => {
    const db = client();
    const signedIn = unwrap(await db.auth.signInWithPassword({ email: recovery.email, password: updatedPassword }));
    const refreshed = unwrap(await db.auth.refreshSession());
    expect(refreshed.user.id).toBe(recovery.id);
    // Assert rotation without exposing either bearer credential on failure.
    expect(Boolean(refreshed.session?.refresh_token)).toBe(true);
    expect(refreshed.session.refresh_token !== signedIn.session.refresh_token).toBe(true);
    expect(unwrap(await db.auth.getUser()).user.id).toBe(recovery.id);
    expect(unwrap(await db.from('profiles').select('id').eq('id', recovery.id))).toHaveLength(1);
    unwrap(await db.auth.signOut());
    expect(unwrap(await db.auth.getSession()).session === null).toBe(true);
    for (const table of ['profiles', 'matches', 'match_players']) {
      expect(unwrap(await db.from(table).select('id'))).toHaveLength(0);
    }
  });
  expect(pageErrors).toEqual([]);
  expect(nonlocal).toEqual([]);
});
