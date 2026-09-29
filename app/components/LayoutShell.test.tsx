import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import LayoutShell from './LayoutShell';

const route = vi.hoisted(() => ({ query: 'qaTheme=light' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(route.query),
}));
vi.mock('./Navbar', () => ({ default: () => null }));
vi.mock('./SummerOverlay', () => ({ default: () => null }));

afterEach(() => {
  vi.unstubAllEnvs();
  delete document.documentElement.dataset.qaTheme;
});

it('clears the local light override when client navigation drops its query parameter', () => {
  vi.stubEnv('NEXT_PUBLIC_RDD_VISUAL_FIXTURE', '1');
  route.query = 'qaTheme=light';
  const { rerender, unmount } = render(<LayoutShell><p>Preview</p></LayoutShell>);
  expect(document.documentElement.dataset.qaTheme).toBe('light');

  route.query = 'page=2';
  rerender(<LayoutShell><p>Next page</p></LayoutShell>);
  expect(document.documentElement.dataset.qaTheme).toBeUndefined();

  route.query = 'qaTheme=light&page=2';
  rerender(<LayoutShell><p>Light page</p></LayoutShell>);
  expect(document.documentElement.dataset.qaTheme).toBe('light');
  unmount();
  expect(document.documentElement.dataset.qaTheme).toBeUndefined();
});
