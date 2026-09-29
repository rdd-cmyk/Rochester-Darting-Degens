'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';

type ProfileListItem = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  include_first_name_in_display: boolean | null;
};

function buildSortableName(profile: ProfileListItem) {
  const display = profile.display_name?.trim();
  const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`
    .trim()
    .replace(/\s+/g, ' ');

  return display || fullName || 'Unknown player';
}

export default function AllProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [authRetryVersion, setAuthRetryVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profilesRetryVersion, setProfilesRetryVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let authRevision = 0;

    async function loadUser() {
      const revision = authRevision;
      setAuthLoading(true);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error && error.name !== 'AuthSessionMissingError') throw error;
        if (!active || revision !== authRevision) return;
        setLoading(Boolean(data.user));
        setUser(data.user ?? null);
        setAuthError(false);
      } catch {
        if (!active || revision !== authRevision) return;
        setLoading(false);
        setUser(null);
        setAuthError(true);
      } finally {
        if (active && revision === authRevision) setAuthLoading(false);
      }
    }

    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active || event === 'INITIAL_SESSION') return;
        authRevision += 1;
        setLoading(Boolean(session?.user));
        setUser(session?.user ?? null);
        setAuthError(false);
        setAuthLoading(false);
      }
    );

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
    };
  }, [authRetryVersion]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfiles() {
      setLoading(true);
      setErrorMessage(null);

      if (!user) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'id, display_name, first_name, last_name, include_first_name_in_display'
          );
        if (!isMounted) return;
        if (error) throw error;
        setProfiles((data as ProfileListItem[]) || []);
      } catch {
        if (!isMounted) return;
        setErrorMessage('Could not load profiles. Please try again.');
        setProfiles([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfiles();

    return () => {
      isMounted = false;
    };
  }, [user, profilesRetryVersion]);

  const sortedAndFilteredProfiles = useMemo(() => {
    const sorted = [...profiles].sort((a, b) =>
      buildSortableName(a).localeCompare(buildSortableName(b), undefined, {
        sensitivity: 'base',
      })
    );

    const term = searchTerm.trim().toLowerCase();
    if (!term) return sorted;

    return sorted.filter((profile) => {
      const fields = [
        profile.display_name ?? '',
        profile.first_name ?? '',
        profile.last_name ?? '',
      ]
        .map((field) => field.toLowerCase())
        .join(' ');

      return fields.includes(term);
    });
  }, [profiles, searchTerm]);

  if (authLoading || loading) {
    return (
      <main className="page-shell directory-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">League directory</p><h1>All Profiles</h1></header>
        <p className="rdd-state" role="status">Loading profiles…</p>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="page-shell directory-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">League directory</p><h1>All Profiles</h1></header>
        <p className="rdd-state rdd-state--error" role="alert">Could not check your account. Please try again.</p>
        <button type="button" className="rdd-action" onClick={() => setAuthRetryVersion((version) => version + 1)}>Retry</button>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell directory-page">
        <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">League directory</p><h1>All Profiles</h1></header>
        <p className="rdd-state">Sign in to browse player profiles.</p>
        <p>
          <Link href="/auth" className="rdd-action rdd-action--primary">
            Go to sign in / sign up
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page-shell directory-page">
      <header className="rdd-page-header rdd-page-header--compact">
        <p className="rdd-eyebrow">League directory</p>
        <h1>All Profiles</h1>
        <p>
          Browse every profile in the league, including players with and
          without recorded matches.
        </p>
      </header>

      <section className="rdd-panel directory-search">
        <label htmlFor="profile-search">
          Search profiles
        </label>
        <input
          id="profile-search"
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Start typing a display name or real name"
        />
      </section>

      {errorMessage ? (
        <div className="directory-load-error">
          <p className="rdd-state rdd-state--error" role="alert">{errorMessage}</p>
          <button type="button" className="rdd-action" onClick={() => setProfilesRetryVersion((version) => version + 1)}>Retry</button>
        </div>
      ) : sortedAndFilteredProfiles.length === 0 ? (
        <p className="rdd-state">{searchTerm.trim() ? 'No profiles match that search. Try a shorter name.' : 'No profiles are available yet.'}</p>
      ) : (
        <ul className="directory-list">
          {sortedAndFilteredProfiles.map((profile) => {
            const primaryName = formatPlayerName(
              profile.display_name,
              profile.first_name,
              profile.include_first_name_in_display
            );
            const hasSecondary = profile.last_name || profile.first_name;
            const secondaryName = [profile.first_name, profile.last_name]
              .filter(Boolean)
              .join(' ');

            return (
              <li key={profile.id}>
                <Link
                  href={`/profiles/${profile.id}`}
                  className="directory-item"
                >
                  <div>
                    <div className="directory-item-name">{primaryName}</div>
                    {hasSecondary && (
                      <div className="directory-item-secondary">
                        {secondaryName}
                      </div>
                    )}
                  </div>
                  <span aria-hidden className="directory-item-arrow">
                    ➜
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
