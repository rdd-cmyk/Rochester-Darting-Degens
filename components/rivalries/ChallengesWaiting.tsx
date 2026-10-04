'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionLink } from '@/components/ui/ActionLink';
import { ActionButton } from '@/components/ui/ActionButton';
import { useCurrentUser } from '@/lib/league-night/use-current-user';
import { loadRivalryFeed } from '@/lib/rivalries/api';
import type { Challenge } from '@/lib/rivalries/types';

function WaitingForUser({ userId }: { userId: string }) {
  const [incoming, setIncoming] = useState<Challenge[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    // A slow read must finish before polling or focus can start another one.
    if (inFlight.current !== null) return;
    const current = ++generation.current;
    inFlight.current = current;
    setBusy(true);
    try {
      const feed = await loadRivalryFeed();
      if (current !== generation.current) return;
      setIncoming(feed.challenges.filter(challenge => challenge.recipient === userId && challenge.state === 'pending'));
      setError(false);
    } catch {
      if (current === generation.current) { setIncoming(null); setError(true); }
    } finally {
      if (inFlight.current === current) inFlight.current = null;
      if (current === generation.current) setBusy(false);
    }
  }, [userId]);
  useEffect(() => {
    const guard = generation;
    const flight = inFlight;
    // Read completion supplies the visible state; account identity remounts it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visible, 20000);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => { guard.current++; flight.current = null; window.clearInterval(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  if (!error && incoming?.length === 0) return null;
  return <section className="rdd-content-panel challenges-waiting" aria-label="Challenges waiting">
    {error ? <><h2 className="rdd-section-title">Check your challenges</h2><p role="alert">Your incoming challenges could not be checked.</p><div className="landing-actions"><ActionButton disabled={busy} onClick={() => void refresh()}>Try again</ActionButton><ActionLink href="/rivalries">Open Rivalry Room</ActionLink></div></>
      : incoming ? <><h2 className="rdd-section-title">{incoming.length === 1 ? 'A challenge is waiting for you' : `${incoming.length} challenges are waiting for you`}</h2><p>Someone’s ready to settle it on the board. Review the details and choose whether to accept.</p><ActionLink variant="primary" href={incoming.length === 1 ? `/rivalries/challenges/${incoming[0].id}` : '/rivalries'}>Review {incoming.length === 1 ? 'challenge' : 'challenges'}</ActionLink></>
      : <p role="status">Checking your challenges…</p>}
  </section>;
}
export function ChallengesWaiting() {
  const { user } = useCurrentUser();
  return user ? <WaitingForUser key={user.id} userId={user.id} /> : null;
}
