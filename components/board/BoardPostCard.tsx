'use client';
import { PlayerAvatar } from '@/components/avatars/PlayerAvatar';
import { BoardBody } from './BoardBody';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { boardError, boardName, boardReply, boardThread, boardTopics, boardWrite, isBoardReadInvalidation, mergeBoardRows, REPLY_PAGE_SIZE, type BoardPost, type BoardReply } from '@/lib/board';
import BoardComposer from './BoardComposer';

function PostDate({ value }: { value: string }) {
  return <time dateTime={value}>{new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>;
}

function ContributionTools({ item, kind, userId, organizer, locked, onChange }: {
  item: BoardReply | BoardPost; kind: 'post' | 'reply'; userId: string; organizer: boolean; locked: boolean; onChange: () => void;
}) {
  const [mode, setMode] = useState<'edit' | 'report' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function act(action: string, body?: string) {
    setBusy(true); setError(''); setMessage('');
    try { await boardWrite(action, item.id, body); setMode(null); setReason(''); setMessage(action.startsWith('report') ? 'Report sent to the organizers.' : 'Change saved.'); onChange(); }
    catch (cause) { setError(boardError(cause)); } finally { setBusy(false); }
  }
  return <div className="board-tools">
    <details><summary>Options</summary><div className="board-actions">
      {item.author_id === userId && <>
        {!locked && <button type="button" disabled={busy} onClick={() => setMode(mode === 'edit' ? null : 'edit')}>Edit {kind}</button>}
        <button type="button" disabled={busy} onClick={() => { if(window.confirm(kind === 'post' ? 'Delete this conversation and all its replies? This cannot be undone.' : 'Delete this reply? This cannot be undone.')) void act(`delete_${kind}`); }}>Delete {kind}</button>
      </>}
      <button type="button" disabled={busy} onClick={() => setMode(mode === 'report' ? null : 'report')}>Report {kind}</button>
      {organizer && <button type="button" disabled={busy} onClick={() => act(`hide_${kind}`)}>Hide {kind}</button>}
      {organizer && kind === 'post' && <>
        <button type="button" disabled={busy} onClick={() => act((item as BoardPost).pinned ? 'unpin' : 'pin')}>{(item as BoardPost).pinned ? 'Unpin' : 'Pin for the league'}</button>
        <button type="button" disabled={busy} onClick={() => act(locked ? 'unlock' : 'lock')}>{locked ? 'Reopen conversation' : 'Close conversation'}</button>
      </>}
    </div></details>
    {mode === 'edit' && <BoardComposer draftKey={`rdd-board:${userId}:edit:${item.id}`} label={`Edit ${kind}`} submitLabel="Save changes" initialBody={item.body}
      onCancel={() => setMode(null)} onSubmit={async body => { await boardWrite(`edit_${kind}`, item.id, body); }} onSuccess={() => { setMode(null); onChange(); }} />}
    {mode === 'report' && <form className="board-report" onSubmit={event => { event.preventDefault(); void act(`report_${kind}`, reason); }}>
      <label>What should the organizers know?<textarea maxLength={500} required value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></label>
      <div className="board-actions"><button type="submit" disabled={busy || !reason.trim()}>Send report</button><button type="button" disabled={busy} onClick={() => setMode(null)}>Cancel</button></div>
    </form>}
    {error && <p role="alert" className="board-error">{error}</p>}
    {message && <p role="status" className="board-small">{message}</p>}
  </div>;
}

export default function BoardPostCard({ post, userId, organizer, initiallyOpen = false, onChange }: {
  post: BoardPost; userId: string; organizer: boolean; initiallyOpen?: boolean; onChange: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [replies, setReplies] = useState<BoardReply[]>([]);
  const [recentReplies, setRecentReplies] = useState<BoardReply[]>([]);
  const [cursor, setCursor] = useState<BoardReply>();
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(initiallyOpen);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const loadedPages = useRef(1);
  const recentIds = useRef(new Set<string>());
  const load = useCallback(async (after?: BoardReply) => {
    const current = ++generation.current;
    try {
      let rows: BoardReply[] = [];
      let nextCursor = after;
      let hasMore = false;
      let pages = 0;
      const pageCount = after ? 1 : loadedPages.current;
      // Refresh the full loaded window so hidden/deleted rows disappear without
      // collapsing the conversation back to its first page.
      do {
        const page = await boardThread(post.id, nextCursor);
        if (current !== generation.current) return;
        rows = mergeBoardRows(rows, page);
        nextCursor = page.at(-1) ?? nextCursor;
        hasMore = page.length === REPLY_PAGE_SIZE;
        pages++;
      } while (hasMore && pages < pageCount);
      // A newly saved reply may sit beyond an unopened page. Re-read those IDs
      // independently; simply merging cached rows would retain hidden content.
      const recentReads = after ? null : await Promise.allSettled([...recentIds.current].filter(id => !rows.some(row => row.id === id)).map(async id => {
        try { return await boardReply(id); }
        catch (cause) {
          if ((cause as { code?: string })?.code === 'PGRST116') return null;
          throw cause;
        }
      }));
      if (current !== generation.current) return;
      const failedRecent = recentReads?.find(result => result.status === 'rejected' && isBoardReadInvalidation(result.reason))
        ?? recentReads?.find(result => result.status === 'rejected');
      if (failedRecent?.status === 'rejected') throw failedRecent.reason;
      const recent = recentReads?.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []) ?? [];
      setError('');
      setReplies(previous => after ? mergeBoardRows(previous, rows).sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) : rows);
      if (after) {
        if (rows.length) loadedPages.current++;
        setRecentReplies(previous => previous.filter(row => !rows.some(loaded => loaded.id === row.id)));
        rows.forEach(row => recentIds.current.delete(row.id));
      } else {
        loadedPages.current = pages;
        const visibleRecent = recent;
        recentIds.current = new Set(visibleRecent.map(row => row.id));
        setRecentReplies(visibleRecent.sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
      }
      setCursor(nextCursor); setMore(hasMore); setLoaded(true);
    } catch (cause) {
      if(current === generation.current) {
        // Keep confirmed replies through outages, but clear invalidated content.
        if (isBoardReadInvalidation(cause)) { setReplies([]); setRecentReplies([]); }
        setError(boardError(cause));
      }
    }
    finally { if(current === generation.current) setLoading(false); }
  }, [post.id]);
  useEffect(() => {
    const guard = generation;
    // Only asynchronous RPC completion updates state; the effect starts the read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void load();
    return () => { guard.current++; };
  }, [open, post, load]);
  async function react() {
    setBusy(true); setError('');
    try { await boardWrite(post.reacted ? 'unreact' : 'react', post.id); onChange(); }
    catch(cause) { setError(boardError(cause)); } finally { setBusy(false); }
  }
  async function share() {
    try { await navigator.clipboard.writeText(new URL(`/board/${post.id}`, window.location.origin).toString()); setMessage('Conversation link copied. Members must sign in to open it.'); }
    catch { setMessage('Open the conversation using its date to copy the link from your address bar.'); }
  }
  function renderReply(reply: BoardReply) {
    return <div className="board-reply" key={reply.id}>
      <div className="board-reply-header"><PlayerAvatar playerId={reply.author_id??undefined} name={boardName(reply.profile)} size={32}/><strong>{boardName(reply.profile)}</strong><span className="board-meta"><PostDate value={reply.created_at} />{reply.updated_at !== reply.created_at ? ' · Edited' : ''}</span></div>
      <BoardBody body={reply.body}/>
      <ContributionTools item={reply} kind="reply" userId={userId} organizer={organizer} locked={post.locked} onChange={() => { void load(); onChange(); }} />
    </div>;
  }
  return <article className={`board-post${post.pinned ? ' board-pinned' : ''}`} aria-label={`Post by ${boardName(post.profile)}`}>
    {post.pinned && <div className="board-eyebrow">Pinned for the league</div>}
    <header className="board-post-header">
      <PlayerAvatar playerId={post.author_id??undefined} name={boardName(post.profile)}/>
      <div>{post.author_id ? <Link className="board-author" href={`/profiles/${post.author_id}`}>{boardName(post.profile)}</Link> : <strong>{boardName(post.profile)}</strong>}
        <div className="board-meta"><Link href={`/board/${post.id}`}><PostDate value={post.created_at} /></Link><span> · {boardTopics[post.topic] ?? 'Conversation'}{post.updated_at !== post.created_at ? ' · Edited' : ''}</span></div>
      </div>
    </header>
    <BoardBody body={post.body}/>
    {post.locked && <p className="board-small board-muted">This conversation is closed. You can still read it or report a concern.</p>}
    <div className="board-actions board-post-actions">
      <button type="button" disabled={busy || post.locked} aria-pressed={post.reacted} onClick={react}>Cheers{post.reaction_count > 0 ? ` · ${post.reaction_count}` : ''}{post.reacted ? ' · You' : ''}</button>
      <button type="button" aria-expanded={open} aria-controls={`replies-${post.id}`} onClick={() => { setOpen(!open); if(!open) setLoading(true); }}>{post.reply_count ? `${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}` : 'Reply'}</button>
      <button type="button" onClick={share}>Copy link</button>
    </div>
    <ContributionTools item={post} kind="post" userId={userId} organizer={organizer} locked={post.locked} onChange={onChange} />
    {message && <p role="status" className="board-small">{message}</p>}
    {error && <p role="alert" className="board-error">{error} {open && <button type="button" disabled={loading} onClick={() => { setLoading(true); void load(); }}>Retry replies</button>}</p>}
    <section id={`replies-${post.id}`} className="board-replies" hidden={!open} aria-label="Conversation replies">
      <h3>Replies</h3>
      {replies.map(renderReply)}
      {loaded && !replies.length && !recentReplies.length && !loading && !error && <p className="board-muted">Have an answer or a thought? Jump in.</p>}
      {loading && <p role="status">Loading replies…</p>}
      {more && <button type="button" disabled={loading} onClick={() => { setLoading(true); void load(cursor); }}>Load more replies</button>}
      {recentReplies.length > 0 && <div aria-label="Your recent replies"><p className="board-small board-muted">Your recent replies</p>{recentReplies.map(renderReply)}</div>}
      {!post.locked && <BoardComposer draftKey={`rdd-board:${userId}:reply:${post.id}`} conversationId={post.id} label="Your reply" submitLabel="Post reply" onSubmit={async (body, _topic, id) => {
        await boardWrite('create_reply', post.id, body, undefined, id);
        // Invalidate a read started before this save so it cannot erase the
        // recent-reply marker while the parent refresh is still in flight.
        generation.current++;
        recentIds.current.add(id);
        // The write is confirmed. A failed read-back must not mark it unsaved.
        try { const saved = await boardReply(id); setRecentReplies(previous => mergeBoardRows(previous, [saved])); }
        catch { setMessage('Reply saved. Refresh the conversation to see it.'); }
        onChange();
      }} />}
    </section>
  </article>;
}
