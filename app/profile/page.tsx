'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);
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

  useEffect(() => {
    let active = true;
    async function loadUserAndProfile() {
      setLoadingUser(true);
      setLoadingProfile(true);
      setLoadError(null);
      setErrorMessage(null);
      setMessage(null);

      try {
        // 1) Get logged-in user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!active) return;
        if (userError && userError.name !== 'AuthSessionMissingError') throw userError;
        if (!userData.user) {
          setUser(null);
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
        if (!active) return;
        if (profileError) throw profileError;

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
      } catch {
        if (active) setLoadError('Could not load your account or profile. Please try again.');
      } finally {
        if (active) {
          setLoadingUser(false);
          setLoadingProfile(false);
        }
      }
    }

    loadUserAndProfile();
    return () => { active = false; };
  }, [loadAttempt]);

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
    if (saveInProgress.current) return;
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

    saveInProgress.current = true;
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
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  if (loadingUser || loadingProfile) {
    return (
      <main className="page-shell account-profile-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">Account settings</p><h1>My Profile</h1></header>
        <p className="rdd-state" role="status">Loading your profile…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="page-shell account-profile-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">Account settings</p><h1>My Profile</h1></header>
        <div className="rdd-state rdd-state--error" role="alert">{loadError}</div>
        <button type="button" className="rdd-action" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</button>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell account-profile-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">Account settings</p><h1>My Profile</h1></header>
        <p className="rdd-state">Sign in to view or edit your profile.</p>
        <p>
          <Link href="/auth" className="rdd-action rdd-action--primary">
            Go to sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page-shell account-profile-page">
      <header className="rdd-page-header rdd-page-header--compact">
        <p className="rdd-eyebrow">Account settings</p>
        <h1>My Profile</h1>
        <p>
          Signed in as <strong>{user.email}</strong>
        </p>
      </header>

      {/* How your name will appear */}
      <section className="rdd-panel account-name-preview">
        <h2 className="rdd-section-title">How your name will appear</h2>
        <p className="account-name-preview-value">
          {formattedLeagueName()}
        </p>
        <p className="account-name-preview-help">
          This is shown on matches, leaderboards, and stats. Use the setting
          below to choose whether your first name is shown with your display
          name.
        </p>
      </section>

      {errorMessage && (
        <div className="rdd-state rdd-state--error" role="alert">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
      {message && (
        <div className="rdd-state rdd-state--success" role="status">
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
          className="rdd-action rdd-action--primary account-edit-action"
        >
          Edit Profile
        </button>
      )}

      <section className="rdd-panel account-profile-form">
        <h2 className="rdd-section-title">
          Profile Details
        </h2>

        <form
          onSubmit={handleSave}
          aria-busy={saving}
        >
          <div className="form-row">
            <label htmlFor="firstName" className="form-label">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={!editMode || saving}
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
              disabled={!editMode || saving}
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
              disabled={!editMode || saving}
              required
              className="form-control"
            />
          </div>

          <div className="form-row">
            <label htmlFor="includeFirstName" className="form-label account-checkbox-label">
              Show first name with display name
            </label>
            <div className="account-checkbox-help">
              <input
                id="includeFirstName"
                type="checkbox"
                checked={includeFirstNameInDisplay}
                onChange={(e) =>
                  setIncludeFirstNameInDisplay(e.target.checked)
                }
                disabled={!editMode || saving}
                aria-describedby="include-first-name-helptext"
              />
              <span id="include-first-name-helptext">
                Add your first name in parentheses after your display name
              </span>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="sex" className="form-label">
              Sex
            </label>
            <select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              disabled={!editMode || saving}
              className="form-control"
            >
              <option value="">-- select --</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          {editMode && (
            <div className="button-row account-profile-actions">
              <button
                type="submit"
                disabled={saving}
                className="rdd-action rdd-action--primary"
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  resetFormFromProfile();
                  setEditMode(false);
                  setMessage(null);
                  setErrorMessage(null);
                }}
                className="rdd-action"
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
