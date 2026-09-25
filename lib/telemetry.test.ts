import { expect, it } from 'vitest';
import { sanitizeTelemetryEvent } from './telemetry';

it.each(['/', '/matches', '/stats', '/profiles', '/profile', '/change-log'])('keeps %s without query strings or fragments', path => {
  const event = { type: 'pageview', url: `https://example.test${path}?email=synthetic@example.test#access_token=fixture` };
  expect(sanitizeTelemetryEvent(event)).toEqual({ ...event, url: `https://example.test${path}` });
  expect(event.url).toContain('?email=');
});

it('redacts profile identifiers in both the URL and Speed Insights route', () => {
  expect(sanitizeTelemetryEvent({ type: 'vital', url: 'https://example.test/profiles/synthetic-id/?token=fixture', route: '/profiles/synthetic-id' }))
    .toEqual({ type: 'vital', url: 'https://example.test/profiles/[id]', route: '/profiles/[id]' });
});

it.each(['/auth', '/auth/verify-email?email=synthetic@example.test', '/reset-password#access_token=fixture', '/test-supabase', '/unknown/private-value', '/%61uth', '/profiles/a%2Fb'])('drops sensitive or unreviewed route %s', path => {
  expect(sanitizeTelemetryEvent({ type: 'pageview', url: `https://example.test${path}` })).toBeNull();
});

it.each(['invalid', '/stats', 'javascript:alert(1)', 'https://user:password@example.test/stats', 'https://example.test/%zz'])('fails closed for malformed or unsupported URL %s', url => {
  expect(sanitizeTelemetryEvent({ type: 'vital', url })).toBeNull();
});
