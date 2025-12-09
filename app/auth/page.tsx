'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

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

    try {
      const redirectBase =
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${redirectBase}/reset-password`,
        }
      );

      if (error) {
        setMessage('Error sending reset email: ' + error.message);
        return;
      }

      setMessage('Password reset email sent. Check your inbox.');
    } finally {
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
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Rochester Darting Degens – Account</h1>
        <p>
          Logged in as <strong>{user.email}</strong>
        </p>

        <button
          onClick={handleSignOut}
          disabled={loading}
          style={{
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            backgroundColor: '#444',
            color: 'white',
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Signing out...' : 'Sign out'}
        </button>

        {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
      </main>
    );
  }

  // Logged-out view
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>
        {isSignUp
          ? 'Create your RDD account'
          : 'Sign in to Rochester Darting Degens'}
      </h1>

      <div style={{ margin: '1rem 0' }}>
        <button
          onClick={() => {
            setMode('signIn');
            setMessage(null);
          }}
          disabled={mode === 'signIn'}
          style={{
            marginRight: '0.5rem',
            cursor: mode === 'signIn' ? 'default' : 'pointer',
            padding: '0.4rem 0.8rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            backgroundColor: mode === 'signIn' ? '#aaa' : '#0366d6',
            color: 'white',
            fontWeight: 500,
            opacity: mode === 'signIn' ? 0.6 : 1,
          }}
        >
          Sign In
        </button>

        <button
          onClick={() => {
            setMode('signUp');
            setMessage(null);
          }}
          disabled={mode === 'signUp'}
          style={{
            cursor: mode === 'signUp' ? 'default' : 'pointer',
            padding: '0.4rem 0.8rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            backgroundColor: mode === 'signUp' ? '#aaa' : '#0366d6',
            color: 'white',
            fontWeight: 500,
            opacity: mode === 'signUp' ? 0.6 : 1,
          }}
        >
          Sign Up
        </button>
      </div>

      {/* Form so Enter key submits */}
      <form
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
            <div style={{ marginBottom: '0.5rem' }}>
              <label>
                First name:{' '}
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </label>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label>
                Last name:{' '}
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </label>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label>
                Display name:{' '}
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Ton-Plus Timbo"
                  required
                />
              </label>
            </div>
          </>
        )}

        <div style={{ marginBottom: '0.5rem' }}>
          <label>
            Email:{' '}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Password:</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #ccc',
                backgroundColor: '#f3f4f6',
                color: '#0366d6',
                cursor: 'pointer',
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </label>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={loading}
            style={{
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
              background: 'none',
              padding: 0,
              color: '#0366d6',
              textDecoration: 'underline',
              fontSize: '0.9rem',
            }}
          >
            Forgot your password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            backgroundColor: '#0366d6',
            color: 'white',
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading
            ? isSignUp
              ? 'Signing up...'
              : 'Signing in...'
            : isSignUp
            ? 'Sign up'
            : 'Sign in'}
        </button>
      </form>

      {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
    </main>
  );
}
