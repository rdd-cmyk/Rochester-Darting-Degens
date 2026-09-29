'use client';

import { useEffect, useRef, useState, FormEvent, startTransition } from 'react';
import Link from 'next/link';
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
  const [updating, setUpdating] = useState(false);
  const updateInProgress = useRef(false);
  const recoveryHashChecked = useRef(false);
  const [recoveryTokens, setRecoveryTokens] = useState<
    | { accessToken: string; refreshToken: string }
    | null
  >(null);

  useEffect(() => {
    if (recoveryHashChecked.current) return;
    recoveryHashChecked.current = true;
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
    if (updateInProgress.current) return;
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

    updateInProgress.current = true;
    setUpdating(true);
    try {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: recoveryTokens.accessToken,
        refresh_token: recoveryTokens.refreshToken,
      });

      if (sessionError) {
        const invalidRecovery = sessionError.name === 'AuthSessionMissingError' || [
          'bad_jwt', 'refresh_token_not_found', 'refresh_token_already_used',
          'session_not_found', 'session_expired', 'user_not_found', 'user_banned',
        ].includes(sessionError.code ?? '');
        if (invalidRecovery) {
          setErrorMessage('Could not start password reset session. Please request a new password reset email.');
          setRecoveryTokens(null);
        } else {
          // The hash has already been removed. Keep the only copy of the
          // recovery tokens and the entered passwords after temporary failures.
          setErrorMessage('Could not start password reset session. Please try again.');
        }
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setErrorMessage('Error updating password: ' + error.message);
        return;
      }

      setMessage('Password updated successfully. You can now sign in.');
      setTimeout(() => router.push('/auth'), 2000);
    } catch {
      setErrorMessage('Could not update your password. Please try again.');
    } finally {
      updateInProgress.current = false;
      setUpdating(false);
    }
  }

  if (checkingTokens) {
    return (
      <main className="page-shell account-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">Account recovery</p><h1>Reset Password</h1></header>
        <p className="rdd-state" role="status">Checking reset session…</p>
      </main>
    );
  }

  return (
    <main className="page-shell account-page">
      <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">Account recovery</p><h1>Reset Your Password</h1></header>

      <p className="rdd-muted">
        Your new password must be at least 16 characters long.
      </p>

      {errorMessage && (
        <p className="rdd-state rdd-state--error" role="alert">{errorMessage}</p>
      )}
      {message && (
        <p className="rdd-state rdd-state--success" role="status">{message}</p>
      )}

      {!message && !recoveryTokens && (
        <Link href="/auth" className="rdd-action rdd-action--secondary">Return to sign in</Link>
      )}

      {!message && recoveryTokens && (
        <form
          className="rdd-panel account-auth-form account-reset-form"
          onSubmit={handleSubmit}
        >
          <div className="form-row">
            <label className="form-label" htmlFor="new-password">
              New password:
            </label>
            <div className="password-row">
              <input
                id="new-password"
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
            <label className="form-label" htmlFor="confirm-password">
              Confirm password:
            </label>
            <div className="password-row">
              <input
                id="confirm-password"
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
            className="rdd-action rdd-action--primary"
            disabled={updating}
          >
            {updating ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </main>
  );
}
