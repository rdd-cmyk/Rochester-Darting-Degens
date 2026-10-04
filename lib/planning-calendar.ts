import type { ScheduledNight } from './planning';

const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
function timestamp(value: string | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw Error('The scheduled date is unavailable.');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
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
export function leagueNightGoogleCalendar(night: ScheduledNight, origin: string, userAgent = '') {
  if (night.status !== 'scheduled') throw Error('This league night was cancelled.');
  const start = timestamp(night.starts_at);
  const link = new URL('/league-night/plan', origin).href;
  const url = new URL('https://calendar.google.com/calendar/r/eventedit');
  url.search = new URLSearchParams({
    action: 'TEMPLATE', text: night.title, location: night.venue,
    dates: `${start}/${start}`, stz: 'America/New_York', etz: 'America/New_York',
    details: [night.notes, 'No end time is recorded. Choose an end time before saving. Calendar copies do not update automatically if plans change.', link].filter(Boolean).join('\n\n'),
  }).toString();
  // Android can route HTTPS Calendar links to the app, which drops template fields.
  // A user-clicked Chrome intent keeps the web editor in Chrome; other browsers use HTTPS.
  if (/Android/i.test(userAgent) && /Chrome\//.test(userAgent) && !/EdgA\/|OPR\/|SamsungBrowser\//.test(userAgent)) {
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
  }
  return url.href;
}
/** RFC 5545: export the real instant; no guessed duration or participant data. */
export function leagueNightCalendar(night: ScheduledNight, origin: string, now = new Date()) {
  if (night.status !== 'scheduled') throw Error('This league night was cancelled.');
  const link = new URL('/league-night/plan', origin).href;
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RDD//League Night//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',`UID:${text(night.night_id)}@rdd-league-night`, `DTSTAMP:${timestamp(now)}`,
    `DTSTART:${timestamp(night.starts_at)}`, `SEQUENCE:${night.event_revision}`,
    `SUMMARY:${text(night.title)}`, `LOCATION:${text(night.venue)}`,
    `DESCRIPTION:${text([night.notes, 'Check the league plan for updates. Downloaded calendar entries do not update automatically.', link].filter(Boolean).join('\n\n'))}`,
    `URL:${link}`, 'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}
