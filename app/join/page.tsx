'use client';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActionLink } from '@/components/ui/ActionLink';

import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react';
import { InviteRequestError, inviteRequest } from '@/lib/invites/client';
import { inviteMessages, isValidInvitePassword } from '@/lib/invites/shared';

type Preview = { inviter: string; email_hint: string; expires_at: string };
export default function JoinPage() {
  const token = useRef('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const pending = useRef<Record<string, unknown> | null>(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    let live = true;
    // Ref survives StrictMode's effect replay; reload requires reopening email.
    token.current ||= new URLSearchParams(window.location.hash.slice(1)).get('invite') || '';
    window.history.replaceState(null, '', '/join');
    if (!token.current) { startTransition(() => { setChecking(false); setMessage('Open the invitation link from your email to join the league.'); }); return; }
    inviteRequest<Preview>({ action: 'preview', token: token.current }).then(value => { if (live) setPreview(value); })
      .catch(error => { if (live) setMessage(error instanceof Error ? error.message : 'Could not load this invitation.'); })
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, []);
  async function requestCode() {
    setBusy(true); setMessage('');
    try {
      const result = await inviteRequest<{ message: string; challenge: boolean }>({ action: 'challenge', token: token.current });
      setChallenge(result.challenge); setMessage(result.message); setCode(''); pending.current = null; setUncertain(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not send a code. Please try again.'); }
    finally { setBusy(false); }
  }
  async function complete(event: FormEvent) {
    event.preventDefault();
    const attempt = pending.current || { action: 'complete', code, firstName, lastName, displayName, password };
    if (!isValidInvitePassword(attempt.password)) { setMessage(inviteMessages.invalid_password); return; }
    setBusy(true); setMessage('');
    pending.current = attempt;
    try {
      const result = await inviteRequest<{ accepted: boolean; message: string }>(attempt);
      setAccepted(result.accepted); setMessage(result.message); pending.current = null; setPassword(''); setCode('');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not confirm your registration. Please retry.';
      setMessage(text);
      if (error instanceof InviteRequestError && ['invalid_code', 'code_locked', 'sign_in_required', 'invalid_request', 'invalid_password', 'password_rejected'].includes(error.code)) {
        pending.current = null;
        setUncertain(false);
      }
      else setUncertain(true);
    } finally { setBusy(false); }
  }
  return <main className="rdd-page-shell page-shell invite-shell account-consistent join-consistent rdd-form-controls">
    <PageHeader title={accepted ? "You’re in. See you at the oche" : "You’re invited to the league"} eyebrow="Rochester Darting Degens" />
    {checking && <p role="status">Checking your invitation…</p>}
    {message && <p role="status" className="invite-panel">{message}</p>}
    {accepted ? <ActionLink variant="primary" href="/auth">Sign in to your account</ActionLink> : preview && <>
      <div className="invite-panel"><h2 className="rdd-section-title">{preview.inviter} invited you</h2><p>This invitation is for <strong>{preview.email_hint}</strong>.</p><p>We’ll send a fresh code to that inbox to confirm it’s you.</p>
        <ActionButton variant="primary" disabled={busy} onClick={() => void requestCode()}>{challenge ? 'Send a new verification code' : 'Send verification code'}</ActionButton>
        {challenge && <p className="invite-detail">Allow 60 seconds before requesting another code. A new code replaces the previous one.</p>}
      </div>
      {challenge && <form className="invite-panel invite-form" onSubmit={complete}>
        <h2 className="rdd-section-title">Make yourself at home</h2>
        <label htmlFor="join-code">Verification code</label><input id="join-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} value={code} onChange={e => setCode(e.target.value)} required disabled={busy || uncertain} />
        <label htmlFor="join-first">First name</label><input id="join-first" autoComplete="given-name" maxLength={29} value={firstName} onChange={e => setFirstName(e.target.value)} required disabled={busy || uncertain} />
        <label htmlFor="join-last">Last name</label><input id="join-last" autoComplete="family-name" maxLength={29} value={lastName} onChange={e => setLastName(e.target.value)} required disabled={busy || uncertain} />
        <label htmlFor="join-display">Display name</label><input id="join-display" maxLength={34} value={displayName} onChange={e => setDisplayName(e.target.value)} required disabled={busy || uncertain} />
        <label htmlFor="join-password">Password</label><div className="invite-password"><input id="join-password" type={show ? 'text' : 'password'} minLength={16} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy || uncertain} /><ActionButton type="button" onClick={() => setShow(v => !v)}>{show ? 'Hide' : 'Show'}</ActionButton></div>
        <p className="invite-detail">Use at least 16 characters, up to 72 bytes. Accented letters and emoji can use more than one byte each.</p><ActionButton type="submit" variant="primary" disabled={busy}>{busy ? 'Joining…' : uncertain ? 'Retry same registration' : 'Join the league'}</ActionButton>
      </form>}
    </>}
    {!accepted && <p>Already have an account? <Link href="/auth" target="_blank" rel="noopener noreferrer">Sign in in a new tab</Link>, then return here. Your existing password stays the same.</p>}
  </main>;
}
