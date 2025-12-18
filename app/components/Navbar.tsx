"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

type NavbarProps = {
  snowEnabled: boolean;
  onToggleSnow: () => void;
};

export default function Navbar({ snowEnabled, onToggleSnow }: NavbarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const attemptedProfiles = useRef<Set<string>>(new Set());
  const router = useRouter();

  async function ensureProfileFromMetadata(currentUser: User | null) {
    if (!currentUser) return;

    const userId = currentUser.id as string | undefined;
    if (!userId || attemptedProfiles.current.has(userId)) return;

    const metadata = currentUser.user_metadata || {};
    const {
      display_name,
      first_name,
      last_name,
      include_first_name_in_display,
    } = metadata;
    if (!display_name && !first_name && !last_name) return;

    const { error } = await supabase.from("profiles").upsert(
      [
        {
          id: userId,
          display_name: display_name ?? null,
          first_name: first_name ?? null,
          last_name: last_name ?? null,
          include_first_name_in_display:
            include_first_name_in_display ?? true,
        },
      ],
      { onConflict: "id" }
    );

    if (!error) {
      attemptedProfiles.current.add(userId);
    }
  }

  useEffect(() => {
    let isMounted = true;

    // Initial load
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    }

    loadUser();

    // Subscribe to auth state changes so navbar stays in sync
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  useEffect(() => {
    ensureProfileFromMetadata(user);
  }, [user]);

  const handleNavSelection = () => {
    setMenuOpen(false);
  };

  const authControlWidth = 120;
  const visuallyHidden: CSSProperties = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  };

  return (
    <nav className="navbar-shell">
      <div className="navbar-main">
        <button
          className="navbar-toggle"
          aria-expanded={menuOpen}
          aria-controls="navbar-links"
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰ Menu
        </button>
        <div
          id="navbar-links"
          className={`navbar-links ${menuOpen ? "open" : ""}`.trim()}
        >
          <Link style={linkStyle} href="/" onClick={handleNavSelection}>
            Home
          </Link>
          <Link style={linkStyle} href="/matches" onClick={handleNavSelection}>
            Matches
          </Link>
          <Link
            style={linkStyle}
            href="/change-log"
            onClick={handleNavSelection}
          >
            Change Log
          </Link>
          <Link style={linkStyle} href="/profiles" onClick={handleNavSelection}>
            All Profiles
          </Link>
          {user && (
            <Link
              style={linkStyle}
              href="/profile"
              onClick={handleNavSelection}
            >
              My Profile
            </Link>
          )}
        </div>
      </div>

      <div className="navbar-actions">
        <button
          onClick={onToggleSnow}
          aria-pressed={snowEnabled}
          style={{
            cursor: "pointer",
            padding: "0.3rem 0.7rem",
            borderRadius: "0.5rem",
            border: "1px solid #5a5a5a",
            backgroundColor: snowEnabled ? "#3b82f6" : "#374151",
            color: "white",
            fontWeight: 600,
          }}
        >
          {snowEnabled ? "Snow: On" : "Snow: Off"}
        </button>
        <div
          style={{
            width: authControlWidth,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {loading ? (
            <div
              aria-hidden
              style={{
                height: "2.2rem",
                width: "100%",
                backgroundColor: "#444", 
                borderRadius: "0.5rem",
              }}
            />
          ) : user ? (
            <button
              onClick={handleSignOut}
              style={{
                cursor: "pointer",
                padding: "0.3rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid #555",
                backgroundColor: "#444",
                color: "white",
                fontWeight: 500,
                width: "100%",
              }}
            >
              Sign Out
            </button>
          ) : (
            <Link
              style={{
                ...linkStyle,
                display: "inline-block",
                padding: "0.3rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid #555",
                backgroundColor: "#444",
                width: "100%",
                textAlign: "center",
              }}
              href="/auth"
            >
              Sign In
            </Link>
          )}
          {loading && <span style={visuallyHidden}>Loading authentication controls</span>}
        </div>
      </div>
    </nav>
  );
}

const linkStyle: CSSProperties = {
  color: "white",
  textDecoration: "none",
  fontWeight: 500,
};
