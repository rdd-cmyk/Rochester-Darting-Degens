import 'server-only';
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { inviteMessages, normalizeEmail, onboarding } from './shared';

type Data = Record<string, unknown>;
type Settings = ReturnType<typeof settings>;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function required(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error('invalid_request');
  return value;
}
function settings() {
  if (process.env.RDD_INVITES_ENABLED !== '1') throw new Error('disabled');
  const origin = new URL(process.env.RDD_INVITE_ORIGIN || 'invalid');
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'invalid');
  const local = process.env.RDD_LOCAL_PREVIEW === '1' && origin.origin === 'http://127.0.0.1:3102' && url.origin === 'http://127.0.0.1:56521';
  if ((!local && (origin.protocol !== 'https:' || url.protocol !== 'https:')) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('disabled');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.RDD_INVITE_SECRET;
  if (!key || !secret || secret.length < 32) throw new Error('disabled');
  if (!local && (!process.env.RESEND_API_KEY || !process.env.RDD_INVITE_FROM)) throw new Error('disabled');
  return { origin: origin.origin, local, secret, url: url.origin, key, cookie: local ? 'rdd-join' : '__Host-rdd-join' };
}
function keyed(config: Settings, domain: string, value: string) {
  return createHmac('sha256', config.secret).update(`${domain}:${value}`).digest('base64url');
}
function response(data: Data, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

// Bound the actual stream; Content-Length is not trustworthy and may be absent.
async function readBody(request: NextRequest): Promise<Data> {
  if (!request.headers.get('content-type')?.startsWith('application/json') || !request.body) throw new Error('invalid_request');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); throw new Error('invalid_request'); }
    chunks.push(value);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('invalid_request'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_request');
  return body as Data;
}

async function sendMail(config: Settings, id: string, to: string, subject: string, text: string) {
  try {
    const result = await fetch(config.local ? 'http://127.0.0.1:56530/send' : 'https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id,
        ...(!config.local ? { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } : {}) },
      body: JSON.stringify({ from: config.local ? 'League <league@example.test>' : process.env.RDD_INVITE_FROM, to: [to], subject, text }),
    });
    if (!result.ok) return { state: result.status >= 500 ? 'unknown' : 'failed', provider_id: null };
    const value = await result.json();
    return typeof value.id === 'string' ? { state: 'sent', provider_id: value.id } : { state: 'unknown', provider_id: null };
  } catch { return { state: 'unknown', provider_id: null }; }
}

export async function handleInvite(request: NextRequest) {
  try {
    const config = settings();
    if (request.headers.get('origin') !== config.origin) return response({ error: 'invalid_request', message: inviteMessages.invalid_request }, 403);
    const body = await readBody(request);
    const action = required(body.action, /^(list|create|resend|revoke|preview|challenge|complete)$/);
    const admin = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    async function rpc(name: string, data: Data, actor: string | null = null): Promise<Data> {
      const result = await admin.rpc('invite_service', { p_action: name, p_actor: actor, p_data: data });
      if (result.error || !result.data) throw new Error('service_error');
      if (result.data.error) throw new Error(result.data.error);
      return result.data;
    }
    let actor: string | null = null;
    const authorization = request.headers.get('authorization');
    if (authorization?.startsWith('Bearer ')) {
      const { data, error } = await admin.auth.getUser(authorization.slice(7));
      if (error || !data.user) throw new Error('membership_required');
      actor = data.user.id;
    }
    // Only trust the hosting platform's overwritten IP header. Other deployments
    // share a conservative bucket until a trusted proxy is explicitly configured.
    const address = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'shared';
    const ip_hash = keyed(config, 'ip', address);
    if (action === 'list') {
      if (!actor) throw new Error('membership_required');
      const page = typeof body.page === 'number' && Number.isSafeInteger(body.page) && body.page >= 0 ? body.page : 0;
      const filter = required(body.filter || 'all', /^(all|pending|accepted|expired|revoked)$/);
      return response(await rpc('list', { page, filter }, actor));
    }
    if (['create', 'resend', 'revoke'].includes(action)) {
      if (!actor) throw new Error('membership_required');
      const request_id = required(body.requestId, uuidPattern);
      const token = keyed(config, 'invite', request_id);
      const data = await rpc(action, { request_id, ip_hash, token_hash: digest(token),
        ...(action === 'create' ? { email: normalizeEmail(body.email) } : { id: required(body.id, uuidPattern) }) }, actor);
      if (data.replayed) return response({ message: 'This request was already recorded. Refresh the list to see its status.' });
      if (data.neutral) return response({ message: 'If this address needs an invitation, it can be invited when no current invitation or membership exists.' });
      if (action === 'revoke') return response({ message: 'Invitation revoked.' });
      const mail = await sendMail(config, request_id, String(data.email), 'You’re invited to Rochester Darting Degens',
        `${data.inviter} invited you to join Rochester Darting Degens.\n\nJoin the league: ${config.origin}/join#invite=${token}\n\nThis invitation is for this email address and expires in 7 days. You will receive a separate verification code when you join. If you did not expect this invitation, you can ignore it.`);
      await rpc('delivery', { request_id, ...mail });
      return response({ message: mail.state === 'sent' ? 'Invitation sent.' : inviteMessages[mail.state === 'failed' ? 'mail_failed' : 'mail_unknown'] });
    }
    if (action === 'preview' || action === 'challenge') {
      const token = required(body.token, /^[A-Za-z0-9_-]{43}$/);
      if (action === 'preview') return response(await rpc('preview', { token_hash: digest(token), ip_hash }));
      const challenge_id = randomUUID();
      const browser = randomBytes(32).toString('base64url');
      const code = randomInt(0, 100000000).toString().padStart(8, '0');
      const data = await rpc('challenge', { token_hash: digest(token), ip_hash, challenge_id,
        browser_hash: digest(browser), code_hash: keyed(config, 'code', `${challenge_id}:${code}`) });
      const mail = await sendMail(config, challenge_id, String(data.email), 'Your league verification code',
        `Your verification code is ${code}.\n\nIt expires in 10 minutes. Enter it only on ${config.origin}/join. Do not share it. If you did not request this code, ignore this email.`);
      await rpc('delivery', { request_id: challenge_id, ...mail });
      const reply = response({ challenge: true, message: mail.state === 'sent' ? 'Verification code sent. Check your inbox.' : inviteMessages[mail.state === 'failed' ? 'mail_failed' : 'mail_unknown'] });
      reply.cookies.set(config.cookie, `${challenge_id}.${browser}`, { httpOnly: true, secure: !config.local, sameSite: 'strict', path: '/', maxAge: 600 });
      return reply;
    }
    const cookie = request.cookies.get(config.cookie)?.value.split('.') || [];
    const challenge_id = required(cookie[0], uuidPattern);
    const browser_hash = digest(required(cookie[1], /^[A-Za-z0-9_-]{43}$/));
    const code = required(body.code, /^\d{8}$/);
    const profile = onboarding(body);
    const reserve = await rpc('reserve', { challenge_id, browser_hash, code_hash: keyed(config, 'code', `${challenge_id}:${code}`),
      profile: { ...profile, credentialHash: keyed(config, 'credential', String(body.password)) } }, actor);
    if (!reserve.accepted) {
      let userId = reserve.user_id;
      if (!userId) {
        const created = await admin.auth.admin.createUser({ email: String(reserve.email), password: String(body.password), email_confirm: true,
          app_metadata: { invite_operation: reserve.operation_id }, user_metadata: { display_name: profile.displayName, first_name: profile.firstName, last_name: profile.lastName, include_first_name_in_display: true } });
        if (created.error || !created.data.user) {
          // Unknown outcome is deliberately left reserved. A retry reconciles
          // auth.users by email + trusted app_metadata before creating again.
          throw new Error('service_error');
        }
        userId = created.data.user.id;
      }
      await rpc('finalize', { challenge_id, browser_hash, user_id: userId }, actor);
    }
    // Keep the short-lived cookie for idempotent response-loss recovery. It has
    // no further authority once the invite is accepted.
    return response({ accepted: true, message: 'Welcome to the league! Your account is ready. Sign in to get started.' });
  } catch (error) {
    const code = error instanceof Error && Object.hasOwn(inviteMessages, error.message) ? error.message : 'service_error';
    return response({ error: code, message: inviteMessages[code] }, code === 'membership_required' ? 403 : code === 'rate_limited' ? 429 : ['disabled', 'service_error'].includes(code) ? 503 : 400);
  }
}
