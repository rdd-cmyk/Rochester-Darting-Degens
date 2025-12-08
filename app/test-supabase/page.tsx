'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function TestSupabasePage() {
  const [status, setStatus] = useState('Checking Supabase connection...');

  useEffect(() => {
    async function check() {
      try {
        // This doesn't call your DB yet; it just checks auth/session API works
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setStatus('Error: ' + error.message);
        } else {
          setStatus('Supabase client initialized successfully ✅');
        }
      } catch (e: any) {
        setStatus('Error: ' + e.message);
      }
    }

    check();
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Supabase Test</h1>
      <p>{status}</p>
    </main>
  );
}
