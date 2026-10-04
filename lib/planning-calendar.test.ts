import { expect, it } from 'vitest';
import type { ScheduledNight } from './planning';
import { leagueNightCalendar, leagueNightGoogleCalendar } from './planning-calendar';
const night = { night_id: 'night-1', title: 'Darts, friends; fun', venue: 'A\\B hall', notes: 'Hello\r\nBEGIN:BAD', starts_at: '2026-11-01T18:30:00-05:00', status: 'scheduled', event_revision: 3, responses: [{ user_id: 'private-user' }] } as unknown as ScheduledNight;
it('exports the actual UTC instant with a two-hour end, stable identity and no attendee data', () => {
  const value = leagueNightCalendar(night, 'https://league.example.test', new Date('2026-10-04T12:00:00Z'));
  expect(value).toContain('DTSTART:20261101T233000Z\r\n');
  expect(value).toContain('UID:night-1@rdd-league-night\r\n');
  expect(value).toContain('SEQUENCE:3\r\n'); expect(value).toContain('DTEND:20261102T013000Z\r\n');
  expect(value).not.toContain('private-user'); expect(value).toContain('URL:https://league.example.test/league-night/plan\r\n');
});
it('escapes text injection and folds Unicode at 75 UTF-8 octets without splitting characters', () => {
  const value = leagueNightCalendar({ ...night, title: 'é🎯'.repeat(50) }, 'https://league.example.test');
  for (const line of value.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  const unfolded = value.replace(/\r\n /g, '');
  expect(unfolded).toContain(`SUMMARY:${'é🎯'.repeat(50)}`);
  expect(unfolded).toContain('LOCATION:A\\\\B hall');
  expect(unfolded).toContain('DESCRIPTION:Hello\\nBEGIN:BAD');
  expect(value).not.toContain('\r\nBEGIN:BAD');
});
it('rejects cancelled nights and invalid dates', () => {
  expect(() => leagueNightCalendar({ ...night, status: 'cancelled' }, 'https://league.example.test')).toThrow();
  expect(() => leagueNightCalendar({ ...night, starts_at: 'invalid' }, 'https://league.example.test')).toThrow();
});
it('encodes the Google editor link with the real instant, disclosed event fields and no participants', () => {
  const url = new URL(leagueNightGoogleCalendar(night, 'https://league.example.test'));
  expect(url.origin).toBe('https://www.google.com');
  expect(url.pathname).toBe('/calendar/render');
  expect(url.searchParams.get('action')).toBe('TEMPLATE');
  expect(url.searchParams.get('text')).toBe(night.title);
  expect(url.searchParams.get('location')).toBe(night.venue);
  expect(url.searchParams.get('dates')).toBe('20261101T233000Z/20261102T013000Z');
  expect(url.searchParams.get('stz')).toBe('America/New_York');
  expect(url.searchParams.get('details')).toContain('default to two hours');
  expect(url.href).not.toContain('private-user');
  expect(() => leagueNightGoogleCalendar({ ...night, status: 'cancelled' }, 'https://league.example.test')).toThrow();
});
it('keeps the default at two elapsed hours across DST changes in Google and downloaded entries', () => {
  for (const [starts_at, expectedStart, expectedEnd] of [
    ['2026-11-01T01:30:00-04:00', '20261101T053000Z', '20261101T073000Z'],
    ['2026-03-08T01:30:00-05:00', '20260308T063000Z', '20260308T083000Z'],
  ]) {
    const scheduled = { ...night, starts_at };
    expect(new URL(leagueNightGoogleCalendar(scheduled, 'https://league.example.test')).searchParams.get('dates')).toBe(`${expectedStart}/${expectedEnd}`);
    expect(leagueNightCalendar(scheduled, 'https://league.example.test')).toContain(`DTEND:${expectedEnd}\r\n`);
  }
});
