'use client';
import { useState } from 'react';
import { ActionButton } from '@/components/ui/ActionButton';
import { leagueNightCalendar } from '@/lib/planning-calendar';
import type { ScheduledNight } from '@/lib/planning';

export function CalendarDownload({ night }: { night: ScheduledNight }) {
  const [error, setError] = useState('');
  function download() {
    let url: string | undefined;
    try {
      const calendar = leagueNightCalendar(night, window.location.origin);
      url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `rdd-league-night-${night.night_id}.ics`;
      document.body.append(link); link.click(); link.remove(); setError('');
      const exported = url;
      window.setTimeout(() => URL.revokeObjectURL(exported), 1000);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setError('Could not download this calendar entry. Please try again.');
    }
  }
  return <><ActionButton onClick={download}>Add to calendar</ActionButton>{error && <p role="alert">{error}</p>}</>;
}
