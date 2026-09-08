import React, { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Observability from './Observability';

const navigation = vi.hoisted(() => ({ path: '/stats', params: {} as Record<string, string> }));
vi.mock('next/navigation.js', () => ({
  usePathname: () => navigation.path,
  useParams: () => navigation.params,
  useSearchParams: () => new URLSearchParams(),
}));

// Exercise the real SDKs, not mocked components. jsdom does not load remote
// resources here; callbacks are captured without running Vercel's hosted script.
const analytics = vi.fn();
const speed = vi.fn();
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH', '');
  vi.stubEnv('NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG', '');
  navigation.path = '/stats';
  navigation.params = {};
  window.va = analytics;
  window.si = speed;
});
afterEach(() => {
  document.head.querySelectorAll('script[data-sdkn]').forEach(script => script.remove());
  delete window.va;
  delete window.si;
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it('injects one script per real SDK and updates routes without reinjecting', () => {
  const ui = render(<StrictMode><Observability /></StrictMode>);
  const analyticsScript = document.querySelector('script[data-sdkn="@vercel/analytics/next"]');
  const speedScript = document.querySelector('script[data-sdkn="@vercel/speed-insights/next"]');
  expect(analyticsScript).toHaveAttribute('src', '/_vercel/insights/script.js');
  expect(analyticsScript).toHaveAttribute('data-sdkv', '2.0.1');
  expect(analyticsScript).toHaveAttribute('data-disable-auto-track', '1');
  expect(speedScript).toHaveAttribute('src', '/_vercel/speed-insights/script.js');
  expect(speedScript).toHaveAttribute('data-sdkv', '2.0.0');
  expect(speedScript).not.toHaveAttribute('data-sample-rate');
  navigation.path = '/profiles/synthetic-id';
  navigation.params = { id: 'synthetic-id' };
  ui.rerender(<StrictMode><Observability /></StrictMode>);
  expect(document.querySelectorAll('script[data-sdkn]')).toHaveLength(2);
  expect(speedScript).toHaveAttribute('data-route', '/profiles/[id]');
  expect(analytics).toHaveBeenCalledWith('pageview', { path: '/profiles/synthetic-id', route: '/profiles/[id]' });
  for (const sdk of [analytics, speed]) {
    const filter = sdk.mock.calls.find(([action]) => action === 'beforeSend')?.[1];
    expect(filter).toBeTypeOf('function');
    expect(filter({ type: 'vital', url: 'https://example.test/reset-password#fixture' })).toBeNull();
    expect(filter({ type: 'pageview', url: 'https://example.test/stats?email=synthetic@example.test' }).url).toBe('https://example.test/stats');
  }
});

it('retains development SDK mode without forcing production collection', () => {
  vi.stubEnv('NODE_ENV', 'development');
  render(<Observability />);
  expect(document.querySelector('script[data-sdkn="@vercel/analytics/next"]')).toHaveAttribute('src', 'https://va.vercel-scripts.com/v1/script.debug.js');
  expect(document.querySelector('script[data-sdkn="@vercel/speed-insights/next"]')).toHaveAttribute('src', 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js');
});

it('supports provider dynamic endpoints while retaining application privacy hooks', () => {
  vi.stubEnv('NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG', JSON.stringify({
    analytics: { scriptSrc: 'intake/analytics.js', viewEndpoint: 'intake/view' },
    speedInsights: { scriptSrc: 'intake/speed.js', endpoint: 'intake/vitals' },
  }));
  render(<Observability />);
  expect(document.querySelector('script[data-sdkn="@vercel/analytics/next"]')).toHaveAttribute('src', '/intake/analytics.js');
  expect(document.querySelector('script[data-sdkn="@vercel/analytics/next"]')).toHaveAttribute('data-view-endpoint', '/intake/view');
  expect(document.querySelector('script[data-sdkn="@vercel/speed-insights/next"]')).toHaveAttribute('data-endpoint', '/intake/vitals');
  expect(analytics).toHaveBeenCalledWith('beforeSend', expect.any(Function));
  expect(speed).toHaveBeenCalledWith('beforeSend', expect.any(Function));
});
