'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { boardAdmin, boardError, boardName, boardWrite, type BoardAdmin } from '@/lib/board';

export default function BoardModeration({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<BoardAdmin | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    try { const result = await boardAdmin(page * 50); if(current === generation.current) { setData(result); setError(''); } }
    catch (cause) { if(current === generation.current) { setData(null); setError(boardError(cause)); } }
    finally { if(current === generation.current) setBusy(false); }
  }, [page]);
  useEffect(() => {
    const guard = generation;
    // Only asynchronous RPC completion updates state; the effect starts the read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => { guard.current++; };
  }, [load]);
  async function act(action: string, id: string) {
    setBusy(true); setError(''); setMessage('');
    try { await boardWrite(action, id); await load(); onChange(); setMessage('Organizer change saved.'); }
    catch (cause) { setError(boardError(cause)); } finally { setBusy(false); }
  }
  return <section className="board-panel board-moderation" aria-label="Organizer tools">
    <h2>Organizer tools</h2><p className="board-muted">Approve people you recognize from the league. New accounts cannot read conversations until approved.</p>
    {error && <p role="alert" className="board-error">{error} <button onClick={load}>Retry</button></p>}
    {message && <p role="status">{message}</p>}
    {!data && busy && <p role="status">Loading organizer tools…</p>}
    {data && <>
      <h3>Members and requests</h3>
      {!data.members.length && <p className="board-muted">No members on this page.</p>}
      {data.members.map(member => <div className="board-admin-row" key={member.user_id}>
        <div><strong>{boardName(member.profile)}</strong><span className="board-small board-muted"> · {member.role} · {member.status}</span></div>
        {member.role !== 'organizer' && <div className="board-actions">
          {member.status !== 'approved' && <button disabled={busy} onClick={() => act('approve_member', member.user_id)}>Approve</button>}
          {member.status !== 'revoked' && <button disabled={busy} onClick={() => { if(window.confirm(`Revoke board access for ${boardName(member.profile)}?`)) void act('revoke_member', member.user_id); }}>Revoke access</button>}
        </div>}
      </div>)}
      <h3>Reports</h3>
      {!data.reports.length && <p className="board-muted">No open reports on this page.</p>}
      {data.reports.map(report => <div className="board-admin-row" key={report.id}>
        <p className="board-body">{report.body}</p><p><strong>Reason:</strong> {report.reason}</p>
        <div className="board-actions"><button disabled={busy} onClick={() => act(report.reply_id ? 'hide_reply' : 'hide_post', report.reply_id ?? report.post_id)}>Hide {report.reply_id ? 'reply' : 'post'}</button><button disabled={busy} onClick={() => act('resolve_report', report.id)}>Resolve report</button></div>
      </div>)}
      <h3>Hidden contributions</h3>
      {!data.hidden.length && <p className="board-muted">No hidden contributions on this page.</p>}
      {data.hidden.map(item => <div className="board-admin-row" key={item.id}><p className="board-body">{item.body}</p><button disabled={busy} onClick={() => act(`restore_${item.kind}`, item.id)}>Restore {item.kind}</button></div>)}
      <div className="board-actions"><button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous</button><span className="board-small">Page {page + 1}</span><button disabled={busy || Math.max(data.members.length, data.reports.length, data.hidden.length) < 50} onClick={() => setPage(page + 1)}>Next</button><button disabled={busy} onClick={load}>Refresh tools</button></div>
    </>}
  </section>;
}
