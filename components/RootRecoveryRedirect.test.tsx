import { render, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RootRecoveryRedirect } from './RootRecoveryRedirect';
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
afterEach(() => { cleanup(); replace.mockClear(); window.history.replaceState({}, '', '/'); });
it('forwards old root recovery fragments without consuming their tokens', () => {
  window.history.replaceState({}, '', '/#type=recovery&access_token=synthetic&refresh_token=synthetic-refresh');
  render(<RootRecoveryRedirect />);
  expect(replace).toHaveBeenCalledWith('/reset-password#type=recovery&access_token=synthetic&refresh_token=synthetic-refresh');
  expect(window.location.hash).toContain('access_token=synthetic');
});
it('leaves normal root links alone', () => {
  render(<RootRecoveryRedirect />);
  expect(replace).not.toHaveBeenCalled();
});
