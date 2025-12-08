'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  sex: string | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sex, setSex] = useState(''); // "Yes" | "No" | ""

  // Edit mode
  const [editMode, setEditMode] = useState(false);

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
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMessage('Error saving profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser || loadingProfile) {
    return (
      <main
        style={{
          padding: '2rem',
          fontFamily: 'sans-serif',
        }}
      >
        <h1>My Profile</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        style={{
          padding: '2rem',
          fontFamily: 'sans-serif',
        }}
      >
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
      style={{
        padding: '2rem',
        fontFamily: 'sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
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
      {message && (
        <div style={{ color: 'green' }}>
          <strong>{message}</strong>
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
        <h2>Profile Details</h2>

        <form
          onSubmit={handleSave}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div>
            <label>
              First name:{' '}
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!editMode}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Last name:{' '}
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!editMode}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Display name:{' '}
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Ton-Plus Timbo"
                disabled={!editMode}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Sex:{' '}
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                disabled={!editMode}
              >
                <option value="">-- select --</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </label>
          </div>

          {editMode && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.5rem',
              }}
            >
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
    </main>
  );
}
