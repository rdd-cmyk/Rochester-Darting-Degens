'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  sex: string | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Local form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sex, setSex] = useState(''); // "Yes" | "No" | ""

  // Edit mode
  const [editMode, setEditMode] = useState(false);

  const router = useRouter();

  const formStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    maxWidth: '520px',
    width: '100%',
  };

  const fieldRowStyle = {
    display: 'grid',
    gridTemplateColumns: 'var(--form-grid-columns)',
    alignItems: 'center',
    columnGap: '0.75rem',
    rowGap: '0.35rem',
    width: '100%',
  } as const;

  const labelTextStyle = {
    minWidth: '150px',
    fontWeight: 600,
  };

  const controlStyle = {
    width: '100%',
    maxWidth: 'var(--form-control-max)',
  } as const;

  useEffect(() => {
    async function loadUserAndProfile() {
      setLoadingUser(true);
      setLoadingProfile(true);
      setErrorMessage(null);
      setMessage(null);

      // 1) Get logged-in user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setUser(null);
        setLoadingUser(false);
        setLoadingProfile(false);
        return;
      }

      const currentUser = userData.user;
      setUser(currentUser);
      setLoadingUser(false);

      // 2) Load profile row (including sex)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, last_name, sex')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileError) {
        setErrorMessage('Error loading profile: ' + profileError.message);
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      if (!profileData) {
        // No profile row yet – set empty
        const emptyProfile: Profile = {
          id: currentUser.id,
          display_name: null,
          first_name: null,
          last_name: null,
          sex: null,
        };
        setProfile(emptyProfile);
        setFirstName('');
        setLastName('');
        setDisplayName('');
        setSex('');
      } else {
        setProfile(profileData as Profile);
        setFirstName(profileData.first_name ?? '');
        setLastName(profileData.last_name ?? '');
        setDisplayName(profileData.display_name ?? '');
        setSex(profileData.sex ?? '');
      }

      setLoadingProfile(false);
    }

    loadUserAndProfile();
  }, []);

  function formattedLeagueName() {
    const d = displayName.trim();
    const f = firstName.trim();
    if (d && f) return `${d} (${f})`;
    if (d) return d;
    if (f) return f;
    return 'Your name as it will appear here';
  }

  function resetFormFromProfile() {
    if (!profile) return;
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setDisplayName(profile.display_name ?? '');
    setSex(profile.sex ?? '');
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setDeleteMessage(null);
    setDeleteError(null);
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('You must be signed in to edit your profile.');
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !displayName.trim()) {
      setErrorMessage(
        'First name, last name, and display name are all required.'
      );
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert(
        [
          {
            id: user.id,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            display_name: displayName.trim(),
            sex: sex || null, // store null if not selected
          },
        ],
        { onConflict: 'id' }
      );

      if (error) {
        setErrorMessage('Error saving profile: ' + error.message);
        return;
      }

      setMessage('Profile saved successfully.');
      setProfile({
        id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: displayName.trim(),
        sex: sex || null,
      });
      setEditMode(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : String(err);

      console.error('Error saving profile:', err);
      setErrorMessage('Error saving profile: ' + message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleteMessage(null);
    setMessage(null);

    if (deleteConfirm.trim() !== 'CONFIRM') {
      setDeleteError('Type CONFIRM in the box to enable account deletion.');
      return;
    }

    setDeleting(true);
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        setDeleteError('You must be signed in to delete your account.');
        return;
      }

      const token = sessionData.session.access_token;
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = result?.error || response.statusText;
        setDeleteError('Error deleting account: ' + detail);
        return;
      }

      setDeleteMessage('Account deleted. Signing you out...');
      await supabase.auth.signOut();
      router.push('/');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : String(err);

      console.error('Error deleting account:', err);
      setDeleteError('Error deleting account: ' + message);
    } finally {
      setDeleting(false);
      setDeleteConfirm('');
    }
  }

  if (loadingUser || loadingProfile) {
    return (
      <main className="page-shell" style={{ maxWidth: '680px' }}>
        <h1>My Profile</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell" style={{ maxWidth: '680px' }}>
        <h1>My Profile</h1>
        <p>You must be signed in to view or edit your profile.</p>
        <p>
          <Link
            href="/auth"
            style={{
              cursor: 'pointer',
              color: '#0366d6',
              textDecoration: 'underline',
              fontWeight: 500,
            }}
          >
            Go to sign in / sign up
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main
      className="page-shell"
      style={{
        maxWidth: '680px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--section-gap)',
      }}
    >
      <header>
        <h1>My Profile</h1>
        <p>
          Signed in as <strong>{user.email}</strong>
        </p>
      </header>

      {/* How your name will appear */}
      <section
        style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid #ddd',
          backgroundColor: '#f9f9f9',
          color: '#000', // make ALL text in this area black
        }}
      >
        <h2>How your name will appear</h2>
        <p
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            marginTop: '0.5rem',
          }}
        >
          {formattedLeagueName()}
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          This is shown on matches, leaderboards, and stats. Format:
          <code> Display Name (First Name)</code>
        </p>
      </section>

      {errorMessage && (
        <div style={{ color: 'red' }}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
      {deleteError && (
        <div style={{ color: 'red' }}>
          <strong>Error:</strong> {deleteError}
        </div>
      )}
      {message && (
        <div style={{ color: 'green' }}>
          <strong>{message}</strong>
        </div>
      )}
      {deleteMessage && (
        <div style={{ color: 'green' }}>
          <strong>{deleteMessage}</strong>
        </div>
      )}

      {/* Edit toggle button */}
      {!editMode && (
        <button
          type="button"
          onClick={() => {
            setEditMode(true);
            setMessage(null);
            setErrorMessage(null);
          }}
          style={{
            cursor: 'pointer',
            alignSelf: 'flex-start',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            backgroundColor: '#0366d6',
            color: 'white',
            fontWeight: 500,
          }}
        >
          Edit Profile
        </button>
      )}

      <section>
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            marginBottom: '0.25rem',
            color: 'var(--foreground)',
          }}
        >
          Profile Details
        </h2>

        <form
          onSubmit={handleSave}
          style={formStyle}
        >
          <div style={fieldRowStyle}>
            <label htmlFor="firstName" style={labelTextStyle}>
              First name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={!editMode}
              required
              style={controlStyle}
            />
          </div>

          <div style={fieldRowStyle}>
            <label htmlFor="lastName" style={labelTextStyle}>
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={!editMode}
              required
              style={controlStyle}
            />
          </div>

          <div style={fieldRowStyle}>
            <label htmlFor="displayName" style={labelTextStyle}>
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Ton-Plus Timbo"
              disabled={!editMode}
              required
              style={controlStyle}
            />
          </div>

          <div style={fieldRowStyle}>
            <label htmlFor="sex" style={labelTextStyle}>
              Sex
            </label>
            <select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              disabled={!editMode}
              style={controlStyle}
            >
              <option value="">-- select --</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          {editMode && (
            <div className="button-row" style={{ marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  cursor: saving ? 'not-allowed' : 'pointer',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #ccc',
                  backgroundColor: '#0366d6',
                  color: 'white',
                  fontWeight: 500,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetFormFromProfile();
                  setEditMode(false);
                  setMessage(null);
                  setErrorMessage(null);
                }}
                style={{
                  cursor: 'pointer',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #ccc',
                  backgroundColor: '#eee',
                  color: '#333',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </section>

      <section
        style={{
          border: '1px solid #f0c2c2',
          borderRadius: '0.75rem',
          padding: '1rem',
          backgroundColor: '#fff6f6',
          color: '#5c0000',
        }}
      >
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
            color: '#5c0000',
          }}
        >
          Delete Account
        </h2>
        <p style={{ marginBottom: '0.5rem' }}>
          This will permanently delete your account and profile information. This
          action cannot be undone.
        </p>

        <label
          htmlFor="delete-confirm"
          style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}
        >
          Type <code>CONFIRM</code> to enable deletion:
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            id="delete-confirm"
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="CONFIRM"
            style={{
              flex: 1,
              maxWidth: '240px',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #e0b4b4',
            }}
          />
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleteConfirm.trim() !== 'CONFIRM' || deleting}
            style={{
              cursor:
                deleteConfirm.trim() !== 'CONFIRM' || deleting
                  ? 'not-allowed'
                  : 'pointer',
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #d9534f',
              backgroundColor:
                deleteConfirm.trim() !== 'CONFIRM' || deleting
                  ? '#f2dede'
                  : '#d9534f',
              color: '#fff',
              fontWeight: 600,
              opacity: deleteConfirm.trim() !== 'CONFIRM' || deleting ? 0.7 : 1,
            }}
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </section>
    </main>
  );
}
