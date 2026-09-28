'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_PAGE_SIZE, boardError, boardFeed, boardWrite, mergeBoardRows, type BoardPost } from '@/lib/board';
import { useBoardAccess } from './useBoardAccess';
import BoardComposer from './BoardComposer';
import BoardPostCard from './BoardPostCard';
import BoardModeration from './BoardModeration';

function reachedFeedBoundary(cursor: BoardPost, boundary: BoardPost) {
  const milliseconds = Date.parse(cursor.last_activity) - Date.parse(boundary.last_activity);
  if (milliseconds !== 0) return milliseconds < 0;
  // PostgreSQL retains microseconds; Date.parse only compares milliseconds.
  // Keep the full fraction before using the descending UUID tie-break.
  const fraction = (value: string) => (value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0');
  const cursorFraction = fraction(cursor.last_activity);
  const boundaryFraction = fraction(boundary.last_activity);
  return cursorFraction < boundaryFraction || (cursorFraction === boundaryFraction && cursor.id <= boundary.id);
}

function BoardFeed({ userId, organizer, postId }: { userId: string; organizer: boolean; postId?: string }) {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [pinned, setPinned] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [cursor, setCursor] = useState<BoardPost>();
  const [error, setError] = useState('');
  const [manage, setManage] = useState(false);
  const generation = useRef(0);
  const loadedPages = useRef(1);
  const loadedBoundary = useRef<BoardPost | undefined>(undefined);
  const load = useCallback(async (before?: BoardPost) => {
    const current = ++generation.current;
    try {
      const readWindow = async () => {
        let rows: BoardPost[] = [];
        let nextCursor = before;
        let hasMore = false;
        let pages = 0;
        const pageCount = before || postId ? 1 : loadedPages.current;
        const boundary = before || postId ? undefined : loadedBoundary.current;
        let boundaryReached = !boundary;
        // Re-read the loaded feed window: keep open conversations mounted while
        // still removing posts that have been hidden, deleted or pinned.
        do {
          const page = await boardFeed(postId ? { id: postId } : { before: nextCursor, pinned: false });
          if (current !== generation.current) return null;
          rows = mergeBoardRows(rows, page);
          nextCursor = page.at(-1) ?? nextCursor;
          hasMore = !postId && page.length === BOARD_PAGE_SIZE;
          pages++;
          if (boundary && nextCursor) boundaryReached = reachedFeedBoundary(nextCursor, boundary);
          // New activity can push the oldest loaded post onto another page.
          // Continue through its prior cursor rather than dropping its context.
        } while (hasMore && (pages < pageCount || !boundaryReached));
        return { rows, nextCursor, hasMore, pages };
      };
      const [window, pin] = await Promise.all([
        readWindow(),
        !postId && !before ? boardFeed({ pinned: true, limit: 1 }) : Promise.resolve(null),
      ]);
      if(current !== generation.current || !window) return;
      setError('');
      setPosts(previous => before ? mergeBoardRows(previous, window.rows) : window.rows);
      if (before) { if (window.rows.length) loadedPages.current++; }
      else loadedPages.current = window.pages;
      loadedBoundary.current = window.nextCursor;
      if(pin) setPinned(pin);
      setCursor(window.nextCursor); setMore(window.hasMore);
    } catch (cause) {
      if(current === generation.current) { setPosts([]); setPinned([]); setError(boardError(cause)); }
    } finally { if(current === generation.current) setLoading(false); }
  }, [postId]);
  useEffect(() => {
    const guard = generation;
    // Only asynchronous RPC completion updates state; the effect starts the read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => { guard.current++; };
  }, [load]);
  const refresh = useCallback(() => { setLoading(true); void load(); }, [load]);
  return <>
    {postId && <Link className="board-back" href="/board">← All league conversations</Link>}
    {organizer && !postId && <div className="board-actions"><button type="button" aria-expanded={manage} onClick={() => setManage(!manage)}>{manage ? 'Close organizer tools' : 'Organizer tools'}</button></div>}
    {manage && <BoardModeration onChange={refresh} />}
    {pinned.map(post => <BoardPostCard key={post.id} post={post} userId={userId} organizer={organizer} onChange={refresh} />)}
    {!postId && <BoardComposer draftKey={`rdd-board:${userId}:post`} label="Your post" submitLabel="Post to league" starters organizer={organizer} onSubmit={async (body, topic, id) => {
      await boardWrite('create_post', undefined, body, topic, id); refresh();
    }} />}
    <div className="board-section-heading"><h2>{postId ? 'Conversation' : 'League conversations'}</h2><div className="board-actions">{!postId && <span className="board-small board-muted">Latest replies first</span>}<button type="button" disabled={loading} onClick={refresh}>Refresh</button></div></div>
    {error && <p className="board-error" role="alert">{error}</p>}
    {posts.map(post => <BoardPostCard key={post.id} post={post} userId={userId} organizer={organizer} initiallyOpen={!!postId} onChange={refresh} />)}
    {loading && <p role="status" className="board-loading">Loading league conversations…</p>}
    {!loading && !error && !posts.length && <section className="board-empty">
      <h3>{postId ? 'Conversation unavailable' : pinned.length ? 'What’s happening this week?' : 'Who’s throwing this week?'}</h3>
      <p className="board-muted">{postId ? 'It may have been removed or hidden by an organizer.' : 'Start with a time and place. Give someone an easy reason to reply.'}</p>
    </section>}
    {more && !error && <button className="board-load-more" type="button" disabled={loading} onClick={() => {setLoading(true); void load(cursor);}}>Load more conversations</button>}
    <p className="board-guideline">Keep the banter friendly. Keep personal details private. Use Options → Report to flag a concern.</p>
  </>;
}

export default function LeagueBoard({ postId }: { postId?: string }) {
  const access = useBoardAccess();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const destination = postId ? `/board/${postId}` : '/board';
  async function requestAccess() {
    setRequesting(true); setError('');
    try { await boardWrite('request_access'); await access.refresh(); }
    catch(cause) { setError(boardError(cause)); } finally { setRequesting(false); }
  }
  return <main className="board-page"><div className="board-shell">
    <header className="board-heading"><div className="board-eyebrow">Rochester Darting Degens</div><h1>League Board</h1><p>Between rounds. Before next week. Your league, off the board.</p><span className="board-access-label">Members only · Organizer-approved access</span></header>
    {access.loading ? <p role="status">Checking board access…</p> : access.error ? <div className="board-panel"><p role="alert" className="board-error">{access.error}</p><button onClick={access.refresh}>Retry access check</button></div> : !access.user ? <section className="board-panel"><h2>Your league, between nights.</h2><p>Sign in to read and join conversations. An organizer approves board access for league members.</p><Link className="board-button board-primary" href={`/auth?next=${encodeURIComponent(destination)}`}>Sign in to the board</Link></section> : access.member?.status !== 'approved' ? <section className="board-panel">
      <h2>{access.member?.status === 'pending' ? 'Your request is with the organizers.' : access.member?.status === 'revoked' ? 'Your board access is paused.' : 'Join the league conversation.'}</h2>
      <p>{access.member?.status === 'pending' ? 'An organizer will approve your access once they recognize you from the league. Your profile name helps them find you.' : access.member?.status === 'revoked' ? 'Contact a league organizer about restoring your access.' : 'Request access using your player profile. An organizer will approve you before you can read or post.'}</p>
      <div className="board-actions">{!access.member && <button className="board-primary" disabled={requesting} onClick={requestAccess}>{requesting ? 'Requesting…' : 'Request board access'}</button>}<button onClick={access.refresh}>Check access again</button><Link href="/profile">Review my profile</Link></div>
      {error && <p role="alert" className="board-error">{error}</p>}
    </section> : <BoardFeed key={access.user.id} userId={access.user.id} organizer={access.member.role === 'organizer'} postId={postId} />}
  </div></main>;
}
