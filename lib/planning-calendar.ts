import type { ScheduledNight } from './planning';

const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
function timestamp(value: string | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw Error('The scheduled date is unavailable.');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
// Owner-selected calendar default; personal calendar copies remain editable.
function calendarEnd(startsAt: string) {
  return timestamp(new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000));
}
const calendarNote = 'Calendar entries default to two hours; adjust the end time if needed. Calendar copies do not update automatically if plans change.';
function fold(line: string) {
  const lines: string[] = []; let current = ''; let bytes = 0;
  for (const character of line) {
    const length = new TextEncoder().encode(character).length;
    if (bytes + length > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += character; bytes += length;
  }
  lines.push(current);
  return lines.join('\r\n');
}
/** Open Google's event editor; the user reviews and saves the event there. */
export function leagueNightGoogleCalendar(night: ScheduledNight, origin: string) {
  if (night.status !== 'scheduled') throw Error('This league night was cancelled.');
  const start = timestamp(night.starts_at);
  const link = new URL('/league-night/plan', origin).href;
  const url = new URL('https://www.google.com/calendar/render');
  url.search = new URLSearchParams({
    action: 'TEMPLATE', text: night.title, location: night.venue,
    dates: `${start}/${calendarEnd(night.starts_at)}`, stz: 'America/New_York', etz: 'America/New_York',
    details: [night.notes, calendarNote, link].filter(Boolean).join('\n\n'),
  }).toString();
  return url.href;
}
/** RFC 5545: real start, owner-selected two-hour default, no participant data. */
export function leagueNightCalendar(night: ScheduledNight, origin: string, now = new Date()) {
  if (night.status !== 'scheduled') throw Error('This league night was cancelled.');
  const link = new URL('/league-night/plan', origin).href;
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RDD//League Night//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',`UID:${text(night.night_id)}@rdd-league-night`, `DTSTAMP:${timestamp(now)}`,
    `DTSTART:${timestamp(night.starts_at)}`, `DTEND:${calendarEnd(night.starts_at)}`, `SEQUENCE:${night.event_revision}`,
    `SUMMARY:${text(night.title)}`, `LOCATION:${text(night.venue)}`,
    `DESCRIPTION:${text([night.notes, calendarNote, link].filter(Boolean).join('\n\n'))}`,
    `URL:${link}`, 'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}
