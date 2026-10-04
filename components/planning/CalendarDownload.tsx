'use client';
import { useId, useState } from 'react';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActionLink } from '@/components/ui/ActionLink';
import { leagueNightCalendar, leagueNightGoogleCalendar } from '@/lib/planning-calendar';
import type { ScheduledNight } from '@/lib/planning';

export function CalendarDownload({ night }: { night: ScheduledNight }) {
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');
  const [requested, setRequested] = useState(false);
  const panelId = useId();
  function toggle() {
    try {
      setGoogleUrl(leagueNightGoogleCalendar(night, window.location.origin));
      setOpened(!opened); setError('');
    } catch { setError('This calendar entry is unavailable. Please refresh the schedule.'); }
  }
  function download() {
    let url: string | undefined;
    try {
      const calendar = leagueNightCalendar(night, window.location.origin);
      url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `rdd-league-night-${night.night_id}.ics`;
      document.body.append(link); link.click(); link.remove(); setError(''); setRequested(true);
      const exported = url;
      window.setTimeout(() => URL.revokeObjectURL(exported), 1000);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setRequested(false);
      setError('Could not download this calendar entry. Please try again.');
    }
  }
  return <div className="calendar-actions">
    <ActionButton onClick={toggle} aria-expanded={opened} aria-controls={panelId}>Add to calendar</ActionButton>
    {opened && <div id={panelId} className="calendar-options">
      <p>Choose how to add this night.</p>
      <div className="landing-actions">
        <ActionLink variant="primary" href={googleUrl} target="_blank" rel="noopener noreferrer">Open Google Calendar ↗</ActionLink>
        <ActionButton onClick={download}>{requested ? 'Download .ics again' : 'Download .ics file'}</ActionButton>
      </div>
      <p className="rdd-field-help">Google opens a new tab with the event filled in. Review the details, choose an end time, then save.</p>
      <details>
        <summary>Apple Calendar and other apps</summary>
        <p className="rdd-field-help">Download the .ics file. On a Mac, open Calendar and choose File → Import. On iPhone, email the downloaded file to yourself and open the attachment in Apple Mail to import it. Other calendar apps may offer their own import option.</p>
      </details>
      <p className="rdd-field-help">Calendar copies do not update automatically if plans change.</p>
      {requested && <p role="status">Download requested. Check your browser’s downloads for the .ics file, then import it into your calendar. See Apple Calendar and other apps for instructions. If your browser asks for permission, allow the download.</p>}
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
