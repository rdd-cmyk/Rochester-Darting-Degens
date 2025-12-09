"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const attemptedProfiles = useRef<Set<string>>(new Set());
  const router = useRouter();

  async function ensureProfileFromMetadata(currentUser: any) {
    if (!currentUser) return;

    const userId = currentUser.id as string | undefined;
    if (!userId || attemptedProfiles.current.has(userId)) return;

    const metadata = currentUser.user_metadata || {};
    const { display_name, first_name, last_name } = metadata;
    if (!display_name && !first_name && !last_name) return;

    const { error } = await supabase.from("profiles").upsert(
      [
        {
          id: userId,
          display_name: display_name ?? null,
          first_name: first_name ?? null,
          last_name: last_name ?? null,
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

  return (
    <nav
      style={{
        display: "flex",
        padding: "1rem",
        backgroundColor: "#222",
        color: "white",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <Link style={linkStyle} href="/">
        Home
      </Link>
      <Link style={linkStyle} href="/matches">
        Matches
      </Link>
      {user && (
        <Link style={linkStyle} href="/profile">
          My Profile
        </Link>
	  )}

      <div style={{ marginLeft: "auto" }}>
        {loading ? null : user ? (
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
            }}
          >
            Sign Out
          </button>
        ) : (
          <Link style={linkStyle} href="/auth">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}

const linkStyle: React.CSSProperties = {
  color: "white",
  textDecoration: "none",
  fontWeight: 500,
};
