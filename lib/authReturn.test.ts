import { expect, it } from 'vitest';
import { authReturnPath } from './authReturn';

it('returns members to their board conversation after sign-in', () => {
  expect(authReturnPath('?next=%2Fboard')).toBe('/board');
  expect(authReturnPath('?next=/board/bc000000-0000-4000-8000-000000000001')).toBe('/board/bc000000-0000-4000-8000-000000000001');
});
it.each(['https://evil.test','//evil.test','/\\evil.test','/board?next=evil','/board/../../admin','/board/not-a-post','/board#token',''])('rejects redirect input %s', next => {
  expect(authReturnPath(`?next=${encodeURIComponent(next)}`)).toBe('/matches');
});
