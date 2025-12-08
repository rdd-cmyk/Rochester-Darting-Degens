'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if we actually have a recovery session
    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setErrorMessage(
          'No active reset session found. Please use the password reset link from your email again.'
        );
      }
      setCheckingSession(false);
    }
    checkSession();
  }, []);

  // Local password validation so we don't even call Supabase
  function validatePassword(pwd: string): string | null {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long.';
    }

    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|<>?,.\/`~]/.test(pwd);

    if (!hasLower || !hasUpper || !hasDigit || !hasSpecial) {
      return 'Password must include at least one lowercase letter, one uppercase letter, one number, and one special character.';
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

  if (checkingSession) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Reset Password</h1>
        <p>Checking reset session…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Reset Your Password</h1>

      <p style={{ marginTop: '0.5rem', color: '#555', maxWidth: '480px' }}>
        Your new password must include at least one lowercase letter, one uppercase letter,
        one number, and one special character.
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
            maxWidth: '320px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
    <label style={{ width: '140px' }}>
      New password:
    </label>
    <input
      type="password"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      style={{ flex: 1 }}
    />
  </div>

  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
    <label style={{ width: '140px' }}>
      Confirm password:
    </label>
    <input
      type="password"
      value={confirm}
      onChange={(e) => setConfirm(e.target.value)}
      style={{ flex: 1 }}
    />
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
