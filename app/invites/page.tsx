'use client';
import Link from 'next/link';
import { startTransition, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { inviteRequest } from '@/lib/invites/client';
import type { InviteList, InviteStatus } from '@/lib/invites/shared';
import { supabase } from '@/lib/supabaseClient';

const date = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const deliveryLabel = { sending: 'Sending', sent: 'Sent', failed: 'Send failed', unknown: 'Delivery unconfirmed' };
export default function InvitesPage() {
  const [email, setEmail] = useState('');
  const [data, setData] = useState<InviteList | null>(null);
  const [filter, setFilter] = useState<InviteStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  // Ambiguous retries retain the exact payload, even if a draft changes.
  const pending = useRef<Record<string, unknown> | null>(null);
  const [retrying, setRetrying] = useState(false);
  const generation = useRef(0);
  const principalGeneration = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setLoadError('');
    try {
      const next = await inviteRequest<InviteList>({ action: 'list', filter, page });
      if (generation.current === current) setData(next);
    } catch (error) { if (generation.current === current) { setData(null); setLoadError(error instanceof Error ? error.message : 'Could not load invitations.'); } }
    finally { if (generation.current === current) setLoading(false); }
  }, [filter, page]);
  useEffect(() => { startTransition(() => { void refresh(); }); }, [refresh]);
  useEffect(() => {
    let reload: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' && event !== 'SIGNED_IN') return;
      // History and pending mutations belong to the previous principal.
      ++generation.current;
      ++principalGeneration.current;
      pending.current = null;
      setData(null); setBusy(false); setRetrying(false); setMessage(''); setConfirmRevoke(null);
      setLoading(false); setLoadError(event === 'SIGNED_OUT' ? 'Sign in to view invitations.' : '');
      if (reload) clearTimeout(reload);
      // Supabase advises against awaiting another auth call inside its callback.
      if (event === 'SIGNED_IN') reload = setTimeout(() => { void refresh(); }, 0);
    });
    return () => { if (reload) clearTimeout(reload); subscription.unsubscribe(); };
  }, [refresh]);
  async function mutate(payload: Record<string, unknown>) {
    const principal = principalGeneration.current;
    setBusy(true); setMessage('');
    const request = pending.current || { ...payload, requestId: crypto.randomUUID() };
    pending.current = request;
    try {
      const result = await inviteRequest<{ message: string }>(request);
      if (principalGeneration.current !== principal) return;
      pending.current = null; setRetrying(false); setMessage(result.message); setConfirmRevoke(null);
      if (request.action === 'create') setEmail('');
      await refresh();
    } catch (error) { if (principalGeneration.current === principal) { setRetrying(true); setMessage(error instanceof Error ? error.message : 'Could not confirm the request. Retry the same request.'); } }
    finally { if (principalGeneration.current === principal) setBusy(false); }
  }
  function send(event: FormEvent) { event.preventDefault(); void mutate({ action: 'create', email }); }
  return <main className="page-shell invite-shell">
    <div className="invite-heading"><div><p className="invite-eyebrow">BRING SOMEONE TO THE OCHE</p><h1>League invitations</h1><p>Invite a friend. Keep track of who’s joining your next league night.</p></div><button onClick={() => void refresh()} disabled={loading || busy}>Refresh</button></div>
    <form className="invite-panel invite-send" onSubmit={send}>
      <div><label htmlFor="invite-email">Their email address</label><input id="invite-email" type="email" autoComplete="off" maxLength={254} required placeholder="friend@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={busy || retrying} /></div>
      <button className="invite-primary" disabled={busy || retrying || !data}>{busy ? 'Please wait…' : 'Send invitation'}</button><p>Each invitation is for one email address and lasts 7 days. They’ll verify their inbox before joining.</p>
    </form>
    {message && <div className="invite-panel" role="status"><p>{message}</p>{retrying && <div className="invite-actions"><button disabled={busy} onClick={() => void mutate({})}>Retry same request</button><button disabled={busy} onClick={() => { pending.current = null; setRetrying(false); void refresh(); }}>Check history and start a new request</button></div>}</div>}
    {loadError && <div role="alert" className="invite-panel"><p>{loadError}</p><Link href="/auth">Sign in</Link></div>}
    {data && <>
      <div className="invite-counts"><div><strong>{data.pending}</strong><span>Pending</span></div><div><strong>{data.accepted}</strong><span>Accepted</span></div></div>
      <section className="invite-panel" aria-label="Your invitations">
        <div className="invite-heading"><h2>Your invitations</h2><label>Status <select value={filter} disabled={busy} onChange={e => { setFilter(e.target.value as typeof filter); setPage(0); }}>{['all', 'pending', 'accepted', 'expired', 'revoked'].map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label></div>
        {loading ? <p role="status">Loading invitations…</p> : data.items.length === 0 ? <p>{filter === 'all' && page === 0 ? 'Invite someone to join your next league night.' : 'No invitations in this view.'}</p> : <ul className="invite-list">
          {data.items.map(item => <li key={item.id}><div className="invite-row-main"><strong className="invite-email">{item.email}</strong><span className={`invite-badge invite-${item.status}`}>{item.status}</span></div>
            <p className="invite-detail">Created {date(item.created_at)} · {deliveryLabel[item.delivery]}{item.sent_at ? ` ${date(item.sent_at)}` : ''}{item.accepted_at ? ` · Joined ${date(item.accepted_at)}` : ` · Expires ${date(item.expires_at)}`}</p>
            {['pending', 'expired'].includes(item.status) && <div className="invite-actions"><button disabled={busy || retrying} onClick={() => void mutate({ action: 'resend', id: item.id })}>Resend</button>
              {confirmRevoke === item.id ? <><span>Cancel this invitation?</span><button disabled={busy || retrying} onClick={() => void mutate({ action: 'revoke', id: item.id })}>Confirm revoke</button><button onClick={() => setConfirmRevoke(null)}>Keep invitation</button></> : <button disabled={busy || retrying} onClick={() => setConfirmRevoke(item.id)}>Revoke</button>}</div>}
          </li>)}
        </ul>}
        <div className="invite-actions"><button disabled={page === 0 || busy || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={(page + 1) * 20 >= data.total || busy || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
      </section>
    </>}
    {loading && !data && <p role="status">Loading invitations…</p>}
  </main>;
}
