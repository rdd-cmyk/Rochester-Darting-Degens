'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type AuthMode = 'signIn' | 'signUp';

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const currentUser = data.user ?? null;
      setUser(currentUser);

      // If already logged in, send them to /matches immediately
      if (currentUser) {
        router.push('/matches');
      }
    }
    loadUser();
  }, [router]);

  async function ensureProfile(userId: string) {
    const { error } = await supabase.from('profiles').upsert(
      [
        {
          id: userId,
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          include_first_name_in_display: true,
        },
      ],
      { onConflict: 'id' }
    );

    if (error) {
      console.error('Error upserting profile:', error);
      setMessage('Logged in, but failed to update profile: ' + error.message);
    }
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage(null);

    // Require first name, last name, and display name
    if (!firstName.trim() || !lastName.trim() || !displayName.trim()) {
      setMessage(
        'First name, last name, and display name are all required for sign up.'
      );
      setLoading(false);
      return;
    }

    try {
      const trimmedEmail = email.trim();

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            include_first_name_in_display: true,
          },
        },
      });

      if (error) {
        setMessage('Sign up error: ' + error.message);
        return;
      }

      const userId = data.user?.id;
      if (userId) {
        await ensureProfile(userId);
      }

      router.push(`/auth/verify-email?email=${encodeURIComponent(trimmedEmail)}`);
      return;
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage('Sign in error: ' + error.message);
        return;
      }

      const userId = data.user?.id;
      if (userId) {
        // Do NOT call ensureProfile here; we don’t want to overwrite names on login
        setUser(data.user);
        router.push('/matches');
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    setLoading(true);
    setMessage(null);

    if (!email.trim()) {
      setMessage('Please enter your email above first.');
      setLoading(false);
      return;
    }

    setRecovering(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          // A preview must return to the deployment that requested recovery.
          redirectTo: new URL('/reset-password', window.location.origin).toString(),
        }
      );

      if (error) {
        setMessage('Error sending reset email: ' + error.message);
        return;
      }

      setMessage('Password reset email sent. Check your inbox.');
    } finally {
      setRecovering(false);
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setMessage('Sign out error: ' + error.message);
        return;
      }
      setUser(null);
      setDisplayName('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setMessage('Signed out.');
    } finally {
      setLoading(false);
    }
  }

  const isSignUp = mode === 'signUp';

  // Logged-in view (brief because we redirect, but kept as fallback)
  if (user) {
    return (
      <main className="page-shell account-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">League account</p><h1>Rochester Darting Degens – Account</h1></header>
        <p>
          Logged in as <strong>{user.email}</strong>
        </p>

        <button
          onClick={handleSignOut}
          disabled={loading}
          className="rdd-action rdd-action--secondary"
        >
          {loading ? 'Signing out...' : 'Sign out'}
        </button>

        {message && <p className="account-signout-message" role="status">{message}</p>}
      </main>
    );
  }

  // Logged-out view
  return (
    <main className="page-shell account-page">
      <header className="rdd-page-header rdd-page-header--compact">
        <p className="rdd-eyebrow">League account</p>
        <h1>{isSignUp ? 'Create your RDD account' : 'Sign in to Rochester Darting Degens'}</h1>
        <p>{isSignUp ? 'Join the league to record matches and follow player stats.' : 'Access match entry, player profiles, and league statistics.'}</p>
      </header>

      <div className="account-mode-tabs" role="group" aria-label="Account mode">
        <button
          onClick={() => {
            setMode('signIn');
            setMessage(null);
          }}
          aria-pressed={mode === 'signIn'}
          className="rdd-action"
        >
          Sign In
        </button>

        <button
          onClick={() => {
            setMode('signUp');
            setMessage(null);
          }}
          aria-pressed={mode === 'signUp'}
          className="rdd-action"
        >
          Sign Up
        </button>
      </div>

      {/* Form so Enter key submits */}
      <form
        className="rdd-panel account-auth-form"
        aria-busy={loading}
        onSubmit={(e) => {
          e.preventDefault();
          if (isSignUp) {
            handleSignUp();
          } else {
            handleSignIn();
          }
        }}
      >
        {isSignUp && (
          <>
            <div className="form-row">
              <label htmlFor="firstName" className="form-label">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="form-control"
              />
            </div>

            <div className="form-row">
              <label htmlFor="lastName" className="form-label">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="form-control"
              />
            </div>

            <div className="form-row">
              <label htmlFor="displayName" className="form-label">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Ton-Plus Timbo"
                required
                className="form-control"
              />
            </div>
          </>
        )}

        <div className="form-row">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="form-control"
          />
        </div>

        <div className="form-row">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <div className="password-row">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              className="form-control"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="rdd-action"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="account-recovery-row">
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={loading}
            className="account-recovery-link"
          >
            {recovering ? 'Sending reset email…' : 'Forgot your password?'}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rdd-action rdd-action--primary"
        >
          {recovering
            ? 'Sending reset email…'
            : loading
            ? isSignUp
              ? 'Signing up...'
              : 'Signing in...'
            : isSignUp
            ? 'Sign up'
            : 'Sign in'}
        </button>
      </form>

      {message && <p className="rdd-state" role="status">{message}</p>}
    </main>
  );
}
