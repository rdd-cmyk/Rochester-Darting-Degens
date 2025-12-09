'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Check your email to verify your account</h1>

      <p style={{ marginTop: '1rem' }}>
        {email ? (
          <>
            We just sent a confirmation link to <strong>{email}</strong>. Click
            the link in that email to verify your account and start using
            Rochester Darting Degens.
          </>
        ) : (
          'We just sent a confirmation email. Click the link inside to verify your account and start using Rochester Darting Degens.'
        )}
      </p>

      <p style={{ marginTop: '1rem' }}>
        Once your email is confirmed, you can{' '}
        <Link href="/auth" style={{ color: '#0366d6', textDecoration: 'underline' }}>
          sign in
        </Link>{' '}
        to access matches and more.
      </p>
    </main>
  );
}
