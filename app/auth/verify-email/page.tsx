'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <main className="page-shell account-page">
      <header className="rdd-page-header rdd-page-header--compact"><p className="rdd-eyebrow">One more step</p><h1>Check your email to verify your account</h1></header>

      <div className="rdd-panel account-message-panel">
      <h2 className="rdd-section-title">Verify your account</h2>
      <p>
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

      <p>
        Once your email is confirmed, you can{' '}
        <Link href="/auth">
          sign in
        </Link>{' '}
        to access matches and more.
      </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="page-shell account-page"><p className="rdd-state" role="status">Loading verification details…</p></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
