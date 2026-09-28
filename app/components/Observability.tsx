'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { sanitizeTelemetryEvent } from '@/lib/telemetry';
import { usePathname } from 'next/navigation';

export default function Observability() {
  const pathname = usePathname();
  if (pathname && /^\/(join|invites|auth|reset-password)(\/|$)/.test(pathname)) return null;
  return (
    <>
      <Analytics beforeSend={sanitizeTelemetryEvent} />
      {/* Keep the existing provider default sampling; no paid features enabled. */}
      <SpeedInsights beforeSend={sanitizeTelemetryEvent} />
    </>
  );
}
