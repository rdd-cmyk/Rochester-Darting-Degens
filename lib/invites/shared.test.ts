import { describe, expect, it } from 'vitest';
import { isValidInvitePassword, normalizeEmail, onboarding } from './shared';
describe('invitation inputs', () => {
  it('normalizes casing and spaces without changing plus tags or dots', () => {
    expect(normalizeEmail('  First.Last+league@EXAMPLE.test ')).toBe('first.last+league@example.test');
  });
  it.each(['bad', 'a\nb@example.test', 'a@b', '<person>@example.test', '', null])('rejects invalid address %s', value => {
    expect(() => normalizeEmail(value)).toThrow('invalid_request');
  });
  it('enforces the database name limits and password floor', () => {
    const valid = { firstName: ' Test ', lastName: 'Player', displayName: 'Test Player', password: 'synthetic password 123' };
    expect(onboarding(valid)).toEqual({ firstName: 'Test', lastName: 'Player', displayName: 'Test Player' });
    for (const patch of [{ firstName: 'a'.repeat(30) }, { lastName: '' }, { displayName: 'a'.repeat(35) }, { displayName: '<script>' }]) {
      expect(() => onboarding({ ...valid, ...patch })).toThrow('invalid_request');
    }
  });
  it.each(['short', 'a'.repeat(73), 'é'.repeat(37), '😀'.repeat(19), null])('rejects unsupported password length', password => {
    expect(isValidInvitePassword(password)).toBe(false);
    expect(() => onboarding({ firstName: 'Test', lastName: 'Player', displayName: 'Test Player', password })).toThrow('invalid_password');
  });
  it.each(['a'.repeat(72), 'é'.repeat(36), '😀'.repeat(18)])('accepts the 72-byte password boundary', password => {
    expect(isValidInvitePassword(password)).toBe(true);
  });
});
