"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

/** Auth changes remount each user's editor; old requests cannot update the new one. */
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const current = revision;
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active && revision === current) {
          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && revision === current) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION" && active) {
        revision++;
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { user, loading };
}
