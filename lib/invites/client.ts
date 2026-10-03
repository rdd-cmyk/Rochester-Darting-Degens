import { supabase } from '@/lib/supabaseClient';

export class InviteRequestError extends Error {
  constructor(public code: string, message: string, public siteOrigin?: string) { super(message); }
}

export async function inviteRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const result = await fetch('/api/invites', {
    method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
    body: JSON.stringify(body), cache: 'no-store',
  });
  const value = await result.json();
  if (!result.ok) throw new InviteRequestError(value.error || 'service_error', value.message || 'We could not confirm the result. Please retry with the same details.', value.siteOrigin);
  return value as T;
}
