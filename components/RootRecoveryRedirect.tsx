'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Preserve old email links aimed at the root; Auth never consumes this hash. */
export function RootRecoveryRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    if (params.get('type') === 'recovery' || params.has('error')) {
      router.replace(`/reset-password${hash}`);
    }
  }, [router]);
  return null;
}
