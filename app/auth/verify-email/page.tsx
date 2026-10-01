'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { ActionLink } from '@/components/ui/ActionLink';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <main className="rdd-page-shell page-shell account-page account-consistent">
      <PageHeader title="Check your email" eyebrow="Account confirmation" description="Follow the confirmation link to finish verifying your account." />

      <div className="rdd-content-panel account-message-panel">
      <h2 className="rdd-section-title">Verify your account</h2>
      <p>
        {email ? (
          <>
            If you received an account confirmation email at <strong>{email}</strong>, open
            its link to verify your email address.
          </>
        ) : (
          'If you received an account confirmation email, open its link to verify your email address.'
        )}
      </p>

      <p>Once confirmed, sign in to your league account. League membership still requires an invitation.</p>
      <p>Joining from an invitation? Return to your invitation email and use its link. The verification code belongs on that registration page.</p>
      <ActionLink href="/auth">Go to sign in</ActionLink>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="rdd-page-shell page-shell account-page account-consistent"><PageHeader title="Check your email" eyebrow="Account confirmation" /><p className="rdd-state" role="status">Loading verification details…</p></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
