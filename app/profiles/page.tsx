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
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUser(data.user ?? null);
      setAuthLoading(false);
    }

    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

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

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, first_name, last_name, include_first_name_in_display'
        );

      if (!isMounted) return;

      if (error) {
        console.error('Error loading profiles list:', error);
        setErrorMessage('Could not load profiles. Please try again later.');
        setProfiles([]);
        setLoading(false);
        return;
      }

      setProfiles((data as ProfileListItem[]) || []);
      setLoading(false);
    }

    loadProfiles();

    return () => {
      isMounted = false;
    };
  }, [user]);

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
      <main className="page-shell" style={{ maxWidth: '800px' }}>
        <h1>All Profiles</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell" style={{ maxWidth: '800px' }}>
        <h1>All Profiles</h1>
        <p>You must be signed in to view profiles.</p>
        <p>
          <Link
            href="/auth"
            style={{
              cursor: 'pointer',
              color: 'var(--link-color)',
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
        maxWidth: '800px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--section-gap)',
      }}
    >
      <header>
        <h1>All Profiles</h1>
        <p>
          Browse every profile in the league, including players with and
          without recorded matches.
        </p>
      </header>

      <section
        style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--panel-border)',
          backgroundColor: 'var(--panel-bg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <label htmlFor="profile-search" style={{ fontWeight: 600 }}>
          Search profiles
        </label>
        <input
          id="profile-search"
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Start typing a display name or real name"
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--input-border)',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--input-text)',
          }}
        />
      </section>

      {errorMessage && (
        <div style={{ color: 'red' }}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {loading ? (
        <p>Loading profiles...</p>
      ) : sortedAndFilteredProfiles.length === 0 ? (
        <p>No profiles found.</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
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
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.9rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--panel-border)',
                    backgroundColor: 'var(--panel-bg)',
                    color: 'inherit',
                    textDecoration: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{primaryName}</div>
                    {hasSecondary && (
                      <div style={{ color: 'var(--muted-foreground)' }}>
                        {secondaryName}
                      </div>
                    )}
                  </div>
                  <span aria-hidden style={{ color: 'var(--muted-icon)' }}>
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
