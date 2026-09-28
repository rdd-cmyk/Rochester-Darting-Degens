export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type InviteItem = {
  id: string; email: string; status: InviteStatus; delivery: 'sending' | 'sent' | 'failed' | 'unknown';
  created_at: string; sent_at: string | null; accepted_at: string | null; expires_at: string;
};
export type InviteList = { items: InviteItem[]; total: number; pending: number; accepted: number };
export const inviteMessages: Record<string, string> = {
  membership_required: 'An active league account is required to send and view invitations.',
  sign_in_required: 'This address already has an account. Sign in with that account, then return to this invitation.',
  rate_limited: 'Please wait before trying again. Invitations and verification codes have sending limits.',
  unavailable: 'This invitation is unavailable, expired, or replaced. Ask the sender for a new invitation.',
  invalid_code: 'That verification code is incorrect. Please check the latest email.',
  code_locked: 'Too many incorrect codes. Request a new verification code.',
  retry_conflict: 'This attempt was already saved with different details. Refresh the page before starting a new attempt.',
  invalid_request: 'Please check the information and try again.',
  password_rejected: 'That password does not meet the account policy. Choose a longer, stronger password and try again.',
  disabled: 'Invitations are not available yet. Please try again later.',
  service_error: 'We could not confirm the result. Retry with the same details, or refresh your invitation history.',
  mail_failed: 'The email could not be sent. Wait a minute, then choose Resend.',
  mail_unknown: 'Email delivery could not be confirmed. Check your inbox or invitation history before resending.',
};

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('invalid_request');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('invalid_request');
  return email;
}

export function onboarding(value: Record<string, unknown>) {
  const field = (key: string, max: number) => {
    const text = typeof value[key] === 'string' ? value[key].trim() : '';
    if (!text || text.length > max || /[\u0000-\u001f<>]/.test(text)) throw new Error('invalid_request');
    return text;
  };
  if (typeof value.password !== 'string' || value.password.length < 16 || value.password.length > 128) throw new Error('invalid_request');
  return { firstName: field('firstName', 29), lastName: field('lastName', 29), displayName: field('displayName', 34) };
}
