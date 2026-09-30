"use client";

import Link from "next/link";
import Image from "next/image";
import { PlayerAvatar } from "@/components/avatars/PlayerAvatar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

type NavbarProps = {
  summerEnabled: boolean;
  onToggleSummer: () => void;
};

const pageGroups = [
  { title: "Play & Results", pages: [["/", "Home"], ["/league-night", "League Night"], ["/matches", "Matches"], ["/stats", "Stats"]] },
  { title: "Around the League", pages: [["/rivalries", "Rivalry Room"], ["/profiles", "Players"], ["/board", "League Board"], ["/solo", "Solo"]] },
];

export default function Navbar({ summerEnabled, onToggleSummer }: NavbarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const attemptedProfiles = useRef<Set<string>>(new Set());
  const menuButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  async function ensureProfileFromMetadata(currentUser: User | null) {
    if (!currentUser) return;

    const userId = currentUser.id as string | undefined;
    if (!userId || attemptedProfiles.current.has(userId)) return;

    const { data: membership } = await supabase.from('league_members').select('status').eq('user_id', userId).maybeSingle();
    if (membership?.status !== 'active') return;

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
      { onConflict: "id", ignoreDuplicates: true }
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
    let live = true;
    if (user) {
      supabase.from('league_members').select('status').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => { if (live) setMemberId(data?.status === 'active' ? user.id : null); });
      void ensureProfileFromMetadata(user);
    }
    return () => { live = false; };
  }, [user]);

  const handleNavSelection = () => {
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <nav className="navbar-shell" aria-label="Primary">
      <div className="navbar-main">
        <Link href="/" className="navbar-brand" aria-label="RDD Home" onClick={handleNavSelection}>
          <Image src="/rdd-navbar-logo.png" alt="" width={64} height={32} priority />
        </Link>
        <button
          ref={menuButton}
          type="button"
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
          {pageGroups.map((group) => (
            <div className="navbar-page-group" key={group.title}>
              <p className="navbar-group-title">{group.title}</p>
              <div className="navbar-page-grid">
                {group.pages.map(([href, label]) => (
                  <Link key={href} href={href}
                    aria-current={pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "page" : undefined}
                    onClick={handleNavSelection}>{label}</Link>
                ))}
              </div>
            </div>
          ))}
          <div className="navbar-utilities">
            {user && <Link className="navbar-mobile-profile" href="/profile" aria-current={pathname === "/profile" ? "page" : undefined} onClick={handleNavSelection}>My Profile</Link>}
            {user && memberId === user.id && <Link href="/invites" aria-current={pathname === "/invites" ? "page" : undefined} onClick={handleNavSelection}>Invites</Link>}
            <Link
              href="/change-log"
              aria-current={pathname === "/change-log" ? "page" : undefined}
              onClick={handleNavSelection}
            >
              Change Log
            </Link>
            <div className="navbar-actions">
              <button
                type="button"
                onClick={onToggleSummer}
                aria-pressed={summerEnabled}
                className="navbar-summer-toggle"
              >
                {summerEnabled ? "Summer: On" : "Summer: Off"}
              </button>
              <div className="navbar-auth">
                {loading ? (
                  <div className="navbar-auth-loading" aria-hidden />
                ) : user ? (
                  <button
                    type="button"
                    onClick={() => { handleNavSelection(); void handleSignOut(); }}
                    className="navbar-auth-action"
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link className="navbar-auth-action" href="/auth" onClick={handleNavSelection}>
                    Sign In
                  </Link>
                )}
                {loading && <span className="sr-only">Loading authentication controls</span>}
              </div>
            </div>
          </div>
          {user && (
            <Link href="/profile" className="navbar-profile-avatar" aria-label="My Profile" title="My Profile"
              aria-current={pathname === "/profile" ? "page" : undefined} onClick={handleNavSelection}>
              <PlayerAvatar playerId={user.id} name={user.user_metadata?.display_name || user.user_metadata?.first_name || "Player"} size={32} />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
