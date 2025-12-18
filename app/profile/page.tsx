'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';
import type { User } from '@supabase/supabase-js';

type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  sex: string | null;
  include_first_name_in_display: boolean | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
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
  const [includeFirstNameInDisplay, setIncludeFirstNameInDisplay] =
    useState(true);
  const [sex, setSex] = useState(''); // "Yes" | "No" | ""

  // Edit mode
  const [editMode, setEditMode] = useState(false);

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
        .select(
          'id, display_name, first_name, last_name, sex, include_first_name_in_display'
        )
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
          include_first_name_in_display: true,
        };
        setProfile(emptyProfile);
        setFirstName('');
        setLastName('');
        setDisplayName('');
        setIncludeFirstNameInDisplay(true);
        setSex('');
      } else {
        const includeFirstNamePref =
          profileData.include_first_name_in_display ?? true;
        setProfile({
          ...(profileData as Profile),
          include_first_name_in_display: includeFirstNamePref,
        });
        setFirstName(profileData.first_name ?? '');
        setLastName(profileData.last_name ?? '');
        setDisplayName(profileData.display_name ?? '');
        setIncludeFirstNameInDisplay(includeFirstNamePref);
        setSex(profileData.sex ?? '');
      }

      setLoadingProfile(false);
    }

    loadUserAndProfile();
  }, []);

  function formattedLeagueName() {
    const formatted = formatPlayerName(
      displayName,
      firstName,
      includeFirstNameInDisplay
    );
    if (formatted === 'Unknown player') {
      return 'Your name as it will appear here';
    }
    return formatted;
  }

  function resetFormFromProfile() {
    if (!profile) return;
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setDisplayName(profile.display_name ?? '');
    setIncludeFirstNameInDisplay(profile.include_first_name_in_display ?? true);
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
            include_first_name_in_display: includeFirstNameInDisplay,
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
        include_first_name_in_display: includeFirstNameInDisplay,
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
          This is shown on matches, leaderboards, and stats. Use the setting
          below to choose whether your first name is shown with your display
          name.
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
            <label htmlFor="includeFirstName" style={labelTextStyle}>
              Show first name with display name
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--muted-foreground)',
              }}
            >
              <input
                id="includeFirstName"
                type="checkbox"
                checked={includeFirstNameInDisplay}
                onChange={(e) =>
                  setIncludeFirstNameInDisplay(e.target.checked)
                }
                disabled={!editMode}
                aria-describedby="include-first-name-helptext"
                style={{ width: '1rem', height: '1rem' }}
              />
              <span id="include-first-name-helptext">
                Add your first name in parentheses after your display name
              </span>
            </div>
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
    </main>
  );
}
