'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { boardError, getBoardMember, type BoardMember } from '@/lib/board';

type Access = { loading: boolean; user: User | null; member: BoardMember | null; error: string | null };
export function useBoardAccess() {
  const [access, setAccess] = useState<Access>({ loading: true, user: null, member: null, error: null });
  const generation = useRef(0);
  const resolve = useCallback(async (user: User | null) => {
    const current = ++generation.current;
    try {
      const member = user ? await getBoardMember(user.id) : null;
      if (current === generation.current) setAccess({ loading: false, user, member, error: null });
    } catch (error) {
      if (current === generation.current) setAccess({ loading: false, user, member: null, error: boardError(error) });
    }
  }, []);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (current !== generation.current) return;
      if (error && error.name !== 'AuthSessionMissingError') throw error;
      setAccess(previous => previous.user?.id === data.user?.id ? previous : { loading: true, user: data.user, member: null, error: null });
      await resolve(data.user);
    } catch {
      if (current === generation.current) setAccess({ loading: false, user: null, member: null, error: 'Could not check your sign-in. Please retry.' });
    }
  }, [resolve]);
  useEffect(() => {
    const guard = generation;
    // Updates follow the async auth read; identity events clear access separately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      // Clear private content synchronously with an identity change.
      setAccess(previous => previous.user?.id === user?.id ? previous : { loading: !!user, user, member: null, error: null });
      void resolve(user);
    });
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visible, 60000);
    document.addEventListener('visibilitychange', visible);
    return () => { guard.current++; data.subscription.unsubscribe(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh, resolve]);
  return { ...access, refresh };
}
