'use client';

import { useEffect, useState, FormEvent, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingTokens, setCheckingTokens] = useState(true);
  const [recoveryTokens, setRecoveryTokens] = useState<
    | { accessToken: string; refreshToken: string }
    | null
  >(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) {
      startTransition(() => {
        setErrorMessage(
          'No active reset session found. Please use the password reset link from your email again.'
        );
        setCheckingTokens(false);
      });
      return;
    }

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (type !== 'recovery' || !accessToken || !refreshToken) {
      startTransition(() => {
        setErrorMessage(
          'No active reset session found. Please use the password reset link from your email again.'
        );
        setCheckingTokens(false);
      });
      return;
    }

    startTransition(() => {
      setRecoveryTokens({ accessToken, refreshToken });
      setCheckingTokens(false);
    });
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Local password validation so we don't even call Supabase
  function validatePassword(pwd: string): string | null {
    if (pwd.length < 16) {
      return 'Password must be at least 16 characters long.';
    }

    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    if (!newPassword || !confirm) {
      setErrorMessage('Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirm) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    // 🔍 Local check before we talk to Supabase
    const policyError = validatePassword(newPassword);
    if (policyError) {
      setErrorMessage(policyError);
      return;
    }

    if (!recoveryTokens) {
      setErrorMessage(
        'Reset link is invalid or has expired. Please request a new password reset email.'
      );
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: recoveryTokens.accessToken,
      refresh_token: recoveryTokens.refreshToken,
    });

    if (sessionError) {
      setErrorMessage(
        'Could not start password reset session. Please request a new password reset email.'
      );
      return;
    }

    // If we get here, we *think* the password meets policy
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      // Fallback: if Supabase still complains, show its message,
      // but the user can keep adjusting and resubmitting.
      setErrorMessage('Error updating password: ' + error.message);
      return;
    }

    setMessage('Password updated successfully. You can now sign in.');
    setTimeout(() => {
      router.push('/auth');
    }, 2000);
  }

  if (checkingTokens) {
    return (
      <main className="page-shell" style={{ maxWidth: '720px' }}>
        <h1>Reset Password</h1>
        <p>Checking reset session…</p>
      </main>
    );
  }

  return (
    <main className="page-shell" style={{ maxWidth: '720px' }}>
      <h1>Reset Your Password</h1>

      <p style={{ marginTop: '0.5rem', color: '#555', maxWidth: '480px' }}>
        Your new password must be at least 16 characters long.
      </p>

      {errorMessage && (
        <p style={{ color: 'red', marginTop: '1rem' }}>{errorMessage}</p>
      )}
      {message && (
        <p style={{ color: 'green', marginTop: '1rem' }}>{message}</p>
      )}

      {!message && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginTop: '1rem',
            maxWidth: '520px',
            width: '100%',
          }}
        >
          <div className="form-row">
            <label className="form-label">
              New password:
            </label>
            <div className="password-row">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-control"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="password-toggle"
              >
                {showNewPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">
              Confirm password:
            </label>
            <div className="password-row">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="form-control"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="password-toggle"
              >
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            style={{
              cursor: 'pointer',
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
              backgroundColor: '#0366d6',
              color: 'white',
              fontWeight: 500,
            }}
          >
            Update Password
          </button>
        </form>
      )}
    </main>
  );
}
