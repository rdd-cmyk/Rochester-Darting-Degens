'use client';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { authReturnPath } from '@/lib/authReturn';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let current = true;
    // Capture before awaiting: a concurrent sign-in can already navigate away.
    const returnTo=authReturnPath(window.location.search);
    supabase.auth.getUser().then(({ data }) => { if (current && data.user) router.push(returnTo); });
    return () => { current = false; };
  }, [router]);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    const returnTo=authReturnPath(window.location.search);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMessage('Sign in failed. Check your email and password.');
      else router.push(returnTo);
    } catch { setMessage('Could not reach the sign-in service. Please try again.'); }
    finally { setBusy(false); }
  }
  async function recover() {
    if (!email.trim()) { setMessage('Please enter your email above first.'); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL('/reset-password', window.location.origin).toString(),
      });
      setMessage(error ? 'Could not send a reset email. Please try again later.' : 'Password reset email sent. Check your inbox.');
    } catch { setMessage('Could not reach the recovery service. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <main className="rdd-page-shell page-shell account-page account-consistent rdd-form-controls">
      <PageHeader title="Welcome back" eyebrow="League account" description="Sign in to your league account." />
      <form className="rdd-content-panel account-auth-form" onSubmit={signIn} aria-busy={busy}>
        <div className="form-row">
          <label htmlFor="email" className="form-label">Email</label>
          <input id="email" type="email" autoComplete="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-row">
          <label htmlFor="password" className="form-label">Password</label>
          <div className="password-row">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
            <ActionButton type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</ActionButton>
          </div>
        </div>
        <div className="account-recovery-row">
          <ActionButton type="button" variant="quiet" onClick={recover} disabled={busy}>Forgot your password?</ActionButton>
        </div>
        <ActionButton type="submit" variant="primary" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</ActionButton>
      </form>
      {message && <p className="rdd-state" role="status">{message}</p>}
      <aside className="rdd-content-panel"><h2 className="rdd-section-title">New to the league?</h2><p>Joining is by invitation. Ask a league member to invite you, then open the link in your email.</p></aside>
    </main>
  );
}
