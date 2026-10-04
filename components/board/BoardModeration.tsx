'use client';
import { ActionButton } from '@/components/ui/ActionButton';

import { useCallback, useEffect, useRef, useState } from 'react';
import { boardAdmin, boardAccessCandidates, boardGrantAccess, boardError, boardName, boardWrite, isBoardAccessError, type BoardAdmin, type BoardAccessCandidates } from '@/lib/board';

export default function BoardModeration({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<BoardAdmin | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [candidates, setCandidates] = useState<BoardAccessCandidates | null>(null);
  const [candidatePage, setCandidatePage] = useState(0);
  const [candidateError, setCandidateError] = useState('');
  const [grantTarget, setGrantTarget] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    try {
      const [result, available] = await Promise.all([
        boardAdmin(page * 50),
        boardAccessCandidates(candidatePage * 50).catch(cause => {
          if (isBoardAccessError(cause)) throw cause;
          if ((cause as { code?: string })?.code === 'PGRST202') return { error: 'Granting Board access is not available yet. Existing organizer tools are still available.' };
          return { error: boardError(cause) };
        }),
      ]);
      if(current === generation.current) {
        setData(result); setError(''); setGrantTarget('');
        if ('error' in available) { setCandidates(null); setCandidateError(available.error); }
        else { setCandidates(available); setCandidateError(''); }
      }
    }
    catch (cause) { if(current === generation.current) { setData(null); setCandidates(null); setGrantTarget(''); setError(boardError(cause)); } }
    finally { if(current === generation.current) setBusy(false); }
  }, [page, candidatePage]);
  useEffect(() => {
    const guard = generation;
    // Only asynchronous RPC completion updates state; the effect starts the read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => { guard.current++; };
  }, [load]);
  async function act(action: string, id: string) {
    setBusy(true); setError(''); setMessage('');
    try { if (action === 'grant_access') await boardGrantAccess(id); else await boardWrite(action, id); await load(); onChange(); setMessage(action === 'grant_access' ? 'Board access granted.' : 'Organizer change saved.'); }
    catch (cause) {
      if (isBoardAccessError(cause)) { setData(null); setCandidates(null); setGrantTarget(''); }
      setError(action === 'grant_access' && (cause as { code?: string })?.code === 'P0002'
        ? 'This member is no longer eligible for Board access. Refresh the organizer tools and choose another member.' : boardError(cause));
    } finally { setBusy(false); }
  }
  return <section className="board-panel board-moderation" aria-label="Organizer tools">
    <h2 className="rdd-section-title">Organizer tools</h2><p className="board-muted">Approve people you recognize from the league. New accounts cannot read conversations until approved.</p>
    {error && <p role="alert" className="board-error">{error} <ActionButton onClick={load}>Retry</ActionButton></p>}
    {message && <p role="status">{message}</p>}
    {!data && busy && <p role="status">Loading organizer tools…</p>}
    {data && <>
      <h3>Grant Board access</h3>
      <p className="board-muted">Choose an active league member who does not have Board access. They do not need to request it first.</p>
      {candidateError && <p role="alert" className="board-error">{candidateError}</p>}
      {candidates && <>
        {candidates.total === 0 ? <p className="board-muted">All eligible league members already have Board access.</p> : <>
          <div className="board-actions">
            <label>League member<select value={grantTarget} disabled={busy} onChange={event => setGrantTarget(event.target.value)}>
              <option value="">Choose a member</option>
              {candidates.items.map(member => <option key={member.user_id} value={member.user_id}>{boardName(member.profile)} · {member.status === 'none' ? 'No request' : member.status === 'pending' ? 'Requested access' : 'Access paused'}</option>)}
            </select></label>
            <ActionButton disabled={busy || !candidates.items.some(member => member.user_id === grantTarget)} onClick={() => void act('grant_access', grantTarget)}>Grant access</ActionButton>
          </div>
          {(candidatePage > 0 || candidates.total > 50) && <div className="board-actions">
            <ActionButton disabled={busy || candidatePage === 0} onClick={() => { setCandidates(null); setGrantTarget(''); setBusy(true); setCandidatePage(value => value - 1); }}>Previous members</ActionButton>
            <span className="board-small">Members page {candidatePage + 1}</span>
            <ActionButton disabled={busy || (candidatePage + 1) * 50 >= candidates.total} onClick={() => { setCandidates(null); setGrantTarget(''); setBusy(true); setCandidatePage(value => value + 1); }}>Next members</ActionButton>
          </div>}
        </>}
      </>}
      <h3>Members and requests</h3>
      {!data.members.length && <p className="board-muted">No members on this page.</p>}
      {data.members.map(member => <div className="board-admin-row" key={member.user_id}>
        <div><strong>{boardName(member.profile)}</strong><span className="board-small board-muted"> · {member.role} · {member.status}</span></div>
        {member.role !== 'organizer' && <div className="board-actions">
          {member.status !== 'approved' && <ActionButton disabled={busy} onClick={() => act('approve_member', member.user_id)}>Approve</ActionButton>}
          {member.status !== 'revoked' && <ActionButton variant="danger" disabled={busy} onClick={() => { if(window.confirm(`Revoke board access for ${boardName(member.profile)}?`)) void act('revoke_member', member.user_id); }}>Revoke access</ActionButton>}
        </div>}
      </div>)}
      <h3>Reports</h3>
      {!data.reports.length && <p className="board-muted">No open reports on this page.</p>}
      {data.reports.map(report => <div className="board-admin-row" key={report.id}>
        <p className="board-body">{report.body}</p><p><strong>Reason:</strong> {report.reason}</p>
        <div className="board-actions"><ActionButton disabled={busy} onClick={() => act(report.reply_id ? 'hide_reply' : 'hide_post', report.reply_id ?? report.post_id)}>Hide {report.reply_id ? 'reply' : 'post'}</ActionButton><ActionButton disabled={busy} onClick={() => act('resolve_report', report.id)}>Resolve report</ActionButton></div>
      </div>)}
      <h3>Hidden contributions</h3>
      {!data.hidden.length && <p className="board-muted">No hidden contributions on this page.</p>}
      {data.hidden.map(item => <div className="board-admin-row" key={item.id}><p className="board-body">{item.body}</p><ActionButton disabled={busy} onClick={() => act(`restore_${item.kind}`, item.id)}>Restore {item.kind}</ActionButton></div>)}
      <div className="board-actions"><ActionButton disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous</ActionButton><span className="board-small">Page {page + 1}</span><ActionButton disabled={busy || Math.max(data.members.length, data.reports.length, data.hidden.length) < 50} onClick={() => setPage(page + 1)}>Next</ActionButton><ActionButton disabled={busy} onClick={load}>Refresh tools</ActionButton></div>
    </>}
  </section>;
}
