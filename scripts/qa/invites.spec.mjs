import { createRequire } from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { inviteStatus, inviteSql } from '../invites-local.mjs';
import { root } from '../local-environment.mjs';
const require = createRequire(import.meta.url);
if (!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright directory.');
const { test, expect } = require(path.join(process.env.RDD_PLAYWRIGHT_ROOT, 'test.js'));
const status = inviteStatus();
const password = 'Synthetic browser passphrase 2026!';
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function inviter() {
  const email = `browser-inviter-${randomUUID().slice(0,8)}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(error).toBeNull();
  inviteSql(`insert into public.league_members(user_id) values('${data.user.id}'); insert into public.profiles(id,display_name) values('${data.user.id}','Jamie from the league');`);
  return email;
}
async function mail(email, code=false) {
  const messages = await (await fetch('http://127.0.0.1:56530/messages')).json();
  const latest = messages.filter(m => m.to.includes(email) && (code ? m.subject.includes('verification') : m.subject.includes('invited'))).at(-1);
  expect(latest).toBeTruthy();
  return code ? latest.text.match(/code is (\d{8})/)[1] : latest.text.match(/http:\/\/127\.0\.0\.1:3102\/join#invite=[A-Za-z0-9_-]+/)[0];
}
async function signIn(page, email) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/matches$/);
}
test('mobile recipient joins by inbox code; sender tracks acceptance', async ({ page, browser }) => {
  const sender = await inviter();
  const recipient = `browser-join-${randomUUID().slice(0,8)}@example.test`;
  await signIn(page, sender);
  await page.getByRole('link', { name: 'Invites', exact: true }).click();
  await expect(page.getByText('Invite someone to join your next league night.')).toBeVisible();
  await page.getByLabel('Their email address').fill(recipient);
  await page.getByRole('button', { name: 'Send invitation', exact: true }).click();
  await expect(page.getByText('Invitation sent.', { exact: true })).toBeVisible();
  await expect(page.getByText(recipient, { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(root,'.qa-artifacts/invites-desktop.png'), fullPage: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const join = await context.newPage();
  const errors = [];
  join.on('pageerror', error => errors.push(error.message));
  await join.goto(await mail(recipient));
  await expect(join.getByText('Jamie from the league invited you')).toBeVisible();
  await expect(join).toHaveURL('http://127.0.0.1:3102/join');
  await expect(join.locator('input[type=email]')).toHaveCount(0);
  await join.getByRole('button', { name: 'Send verification code', exact: true }).click();
  await expect(join.getByLabel('Verification code')).toBeVisible();
  const code = await mail(recipient, true);
  await join.getByLabel('Verification code').fill(code === '00000000' ? '11111111' : '00000000');
  await join.getByLabel('First name', { exact: true }).fill('Synthetic');
  await join.getByLabel('Last name', { exact: true }).fill('Player');
  await join.getByLabel('Display name', { exact: true }).fill('Mobile Player');
  await join.getByLabel('Password', { exact: true }).fill(password);
  await join.getByRole('button', { name: 'Join the league', exact: true }).click();
  await expect(join.getByText('That verification code is incorrect. Please check the latest email.')).toBeVisible();
  await join.getByLabel('Verification code').fill(code);
  await join.getByLabel('Password', { exact: true }).fill('é'.repeat(37));
  await join.getByRole('button', { name: 'Join the league', exact: true }).click();
  await expect(join.getByText('Use a password with at least 16 characters and no more than 72 bytes. Accented letters and emoji can use more than one byte each.')).toBeVisible();
  await expect(join.getByLabel('Password', { exact: true })).toBeEnabled();
  await join.getByLabel('Password', { exact: true }).fill(password);
  await join.screenshot({ path: path.join(root,'.qa-artifacts/invites-mobile-join.png'), fullPage: true });
  await join.getByRole('button', { name: 'Join the league', exact: true }).click();
  await expect(join.getByRole('heading', { name: 'You’re in. See you at the oche.' })).toBeVisible();
  expect(await join.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await signIn(join, recipient);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.invite-accepted')).toHaveText('accepted');
  await page.screenshot({ path: path.join(root,'.qa-artifacts/invites-accepted.png'), fullPage: true });
  await context.close();
});
test('sender can revoke a pending invitation; revoked link cannot begin onboarding', async ({ page }) => {
  await signIn(page, await inviter());
  await page.goto('/invites');
  const recipient = `browser-revoke-${randomUUID().slice(0,8)}@example.test`;
  await page.getByLabel('Their email address').fill(recipient);
  await page.getByRole('button', { name: 'Send invitation', exact: true }).click();
  await expect(page.getByText('Invitation sent.', { exact: true })).toBeVisible();
  const link = await mail(recipient);
  await page.getByRole('button', { name: 'Revoke', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm revoke', exact: true }).click();
  await expect(page.locator('.invite-revoked')).toHaveText('revoked');
  await page.goto(link);
  await expect(page.getByText('This invitation is unavailable, expired, or replaced. Ask the sender for a new invitation.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send verification code' })).toHaveCount(0);
});

test('existing members can recover passwords with public registration disabled', async ({ page }) => {
  const email = await inviter();
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Forgot your password?' }).click();
  await expect(page.getByText('Password reset email sent. Check your inbox.')).toBeVisible();
  let messageId;
  await expect.poll(async () => {
    const result = await (await fetch(`http://127.0.0.1:56524/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    messageId = result.messages?.find(m => m.To?.some(to => to.Address === email))?.ID;
    return Boolean(messageId);
  }).toBe(true);
  const message = await (await fetch(`http://127.0.0.1:56524/api/v1/message/${encodeURIComponent(messageId)}`)).json();
  const link = [...(message.HTML || '').matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&')).find(value=>{
    const url = new URL(value);
    return url.origin === status.API_URL && url.pathname === '/auth/v1/verify' && url.searchParams.get('type') === 'recovery' && url.searchParams.get('redirect_to') === 'http://127.0.0.1:3102/reset-password';
  });
  expect(Boolean(link)).toBe(true);
  try { await page.goto(link); } catch { throw new Error('Local recovery redirect failed.'); }
  await expect(page.getByRole('heading', { name: 'Reset Your Password', exact: true })).toBeVisible();
  const renewed = 'Renewed synthetic league passphrase!';
  await page.locator('form input').nth(0).fill(renewed);
  await page.locator('form input').nth(1).fill(renewed);
  await page.getByRole('button', { name: 'Update Password', exact: true }).click();
  await expect(page.getByText('Password updated successfully. You can now sign in.')).toBeVisible();
  const db = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await db.auth.signInWithPassword({ email, password: renewed })).error).toBeNull();
  expect((await db.auth.refreshSession()).error).toBeNull();
});
