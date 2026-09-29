'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { boardError, isBoardRetryConflict } from '@/lib/board';

type Draft = { body: string; id: string; topic: string };
export default function BoardComposer({ draftKey, label, submitLabel, initialBody = '', initialTopic = 'conversation', starters = false, organizer = false, conversationId, onSubmit, onCancel, onSuccess }:
  { draftKey: string; label: string; submitLabel: string; initialBody?: string; initialTopic?: string; starters?: boolean; organizer?: boolean; conversationId?: string;
    onSubmit: (body: string, topic: string, id: string) => Promise<void>; onCancel?: () => void; onSuccess?: () => void }) {
  const fieldId = useId();
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
      if (saved && typeof saved.body === 'string' && typeof saved.id === 'string' && typeof saved.topic === 'string') return saved;
    } catch { /* Draft storage is optional on shared/private browsers. */ }
    return { body: initialBody, id: crypto.randomUUID(), topic: initialTopic };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryConflict, setRetryConflict] = useState(false);
  const [message, setMessage] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const [expanded, setExpanded] = useState(!starters || !!draft.body);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  function update(next: Draft) {
    setDraft(next);
    try { sessionStorage.setItem(draftKey, JSON.stringify(next)); } catch { setStorageWarning(true); }
  }
  function start(topic: string, body: string) {
    // Keep anything already written; starter chips never overwrite a draft.
    update({ ...draft, topic: draft.body.trim() ? draft.topic : topic, body: draft.body.trim() ? draft.body : body });
    setExpanded(true);
    setTimeout(() => document.getElementById(fieldId)?.focus(), 0);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.body.trim() || busy) return;
    setBusy(true); setError(''); setMessage(''); setRetryConflict(false);
    try {
      await onSubmit(draft.body.trim(), draft.topic, draft.id);
      // Navigation/auth changes can replace this draft while a save is pending.
      // Clear only the confirmed version, even if its composer has unmounted.
      try {
        const stored = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
        if (stored?.id === draft.id && stored.body === draft.body && stored.topic === draft.topic) sessionStorage.removeItem(draftKey);
      } catch { /* The confirmed post is already safe. */ }
      onSuccess?.();
      if (!mounted.current) return;
      setDraft({ body: '', topic: initialTopic, id: crypto.randomUUID() });
      setMessage('Saved to the league.');
      if (starters) setExpanded(false);
    } catch (cause) { if (mounted.current) { setError(boardError(cause)); setRetryConflict(isBoardRetryConflict(cause)); } }
    finally { if (mounted.current) setBusy(false); }
  }
  return <form className="board-composer" onSubmit={submit}>
    {starters && <>
      {!expanded && <button type="button" className="board-composer-prompt" onClick={() => start('conversation', '')}>What’s happening, Degens?</button>}
      <div className="board-actions board-starters">
        <button type="button" disabled={busy} onClick={() => start('sub', 'Anyone available to sub?\nWhen: \nWhere: ')}>Find a sub</button>
        <button type="button" disabled={busy} onClick={() => start('practice', 'Anyone up for a practice game?\nWhen: \nWhere: ')}>Who’s throwing?</button>
        <button type="button" disabled={busy} onClick={() => start('highlight', 'My highlight from league night: ')}>Share a highlight</button>
      </div>
    </>}
    {expanded && <>
      {starters && <label className="board-topic">Post type<select value={draft.topic} disabled={busy} onChange={e => update({ ...draft, topic: e.target.value })}>
        <option value="conversation">Conversation</option><option value="sub">Sub needed</option><option value="practice">Practice</option><option value="highlight">Highlight</option>
        {organizer && <option value="announcement">Announcement</option>}
      </select></label>}
      <label htmlFor={fieldId}>{label}</label>
      <textarea id={fieldId} maxLength={2000} rows={4} value={draft.body} disabled={busy} required onChange={e => update({ ...draft, body: e.target.value })} aria-describedby={`${fieldId}-length`} />
      <div id={`${fieldId}-length`} className="board-muted board-small">{draft.body.length.toLocaleString()} / 2,000 · Visible to approved league members</div>
      <div className="board-actions"><button className="board-primary" type="submit" disabled={busy || !draft.body.trim()}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>}
        {starters && <button type="button" disabled={busy} onClick={() => setExpanded(false)}>Keep draft for later</button>}
      </div>
    </>}
    {storageWarning && <p className="board-small">This browser cannot save drafts. Keep this page open until you post.</p>}
    {error && <p className="board-error" role="alert">{error}</p>}
    {retryConflict && <div className="board-actions">
      <Link href={`/board/${conversationId ?? draft.id}`}>Open saved conversation</Link>
      <button type="button" disabled={busy} onClick={() => {
        update({ ...draft, id: crypto.randomUUID() }); setRetryConflict(false); setError('');
        setMessage('Your draft is ready as a separate contribution. Review it before posting.');
      }}>Use draft for a separate contribution</button>
    </div>}
    {message && <p className="board-small" role="status">{message}</p>}
  </form>;
}
