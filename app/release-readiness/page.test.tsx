// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const mocks = vi.hoisted(() => ({ check: vi.fn(), notFound: vi.fn(() => { throw new Error('not_found'); }) }));
vi.mock('../api/release-readiness/route', () => ({ GET: mocks.check }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
import Page from './page';

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'release/next');
  mocks.check.mockResolvedValue(Response.json({ supabaseProjectRef: 'synthetic-ref' }));
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it('does not run the diagnostic on production', async () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  await expect(Page()).rejects.toThrow('not_found');
  expect(mocks.check).not.toHaveBeenCalled();
});
it('does not run the diagnostic on another preview branch', async () => {
  vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'other-branch');
  await expect(Page()).rejects.toThrow('not_found');
  expect(mocks.check).not.toHaveBeenCalled();
});
it('renders sanitized results as escaped text with an acceptance boundary', async () => {
  mocks.check.mockResolvedValue(Response.json({ supabaseProjectRef: 'synthetic-ref',
    commit: '<script>untrusted</script>' }));
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('Client and server credentials verified');
  expect(html).toContain('synthetic-ref');
  expect(html).not.toContain('<script>');
  expect(html).toContain('connection isolation only');
});
it('does not claim success for a failed credential check', async () => {
  mocks.check.mockResolvedValue(Response.json({ message: 'Verification failed.' }, { status: 503 }));
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('The isolation check has not passed');
  expect(html).not.toContain('credentials verified');
});
