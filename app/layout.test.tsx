import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import RootLayout from './layout';

vi.mock('@vercel/analytics/next', () => ({ Analytics: () => <span>analytics-fixture</span> }));
vi.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: () => <span>speed-fixture</span> }));
vi.mock('./components/LayoutShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
afterEach(() => vi.unstubAllEnvs());

it('does not mount external telemetry in explicit local preview mode', () => {
  vi.stubEnv('RDD_LOCAL_PREVIEW', '1');
  const html = renderToStaticMarkup(RootLayout({ children: <p>local-content</p> }));
  expect(html).toContain('local-content');
  expect(html).not.toContain('analytics-fixture');
  expect(html).not.toContain('speed-fixture');
});

it('preserves telemetry outside explicit local preview mode', () => {
  vi.stubEnv('RDD_LOCAL_PREVIEW', undefined);
  const html = renderToStaticMarkup(RootLayout({ children: null }));
  expect(html).toContain('analytics-fixture');
  expect(html).toContain('speed-fixture');
});
