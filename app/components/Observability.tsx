'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { sanitizeTelemetryEvent } from '@/lib/telemetry';

export default function Observability() {
  return (
    <>
      <Analytics beforeSend={sanitizeTelemetryEvent} />
      {/* Keep the existing provider default sampling; no paid features enabled. */}
      <SpeedInsights beforeSend={sanitizeTelemetryEvent} />
    </>
  );
}
