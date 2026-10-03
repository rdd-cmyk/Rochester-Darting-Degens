'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { boardFeed, boardName, type BoardPost } from '@/lib/board';
import { useBoardAccess } from './useBoardAccess';

export default function BoardPreview() {
  const access = useBoardAccess();
  const approved = !access.loading && access.member?.status === 'approved';
  const [content, setContent] = useState<{ userId: string; posts: BoardPost[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if(!approved || !access.user) return;
    let active = true;
    const userId = access.user.id;
    boardFeed({ limit: 2 }).then(posts => { if(active) {setContent({userId, posts}); setError(false);} }).catch(() => {if(active) setError(true);});
    return () => { active = false; };
  }, [approved, access.user]);
  if(!approved || !access.user) return null;
  const posts = content?.userId === access.user.id ? content.posts : null;
  return <section className="board-home board-panel" aria-label="From the League Board"><div className="board-section-heading"><h2>From the League Board</h2><Link href="/board">Open board →</Link></div>
    {error ? <p className="board-muted">Conversations could not be loaded. Open the board to retry.</p> : !posts ? <p role="status">Loading conversations…</p> : posts.length ? posts.map(post => <Link key={post.id} className="board-home-post" href={`/board/${post.id}`}><strong>{boardName(post.profile)}</strong><p>{post.body.slice(0, 180)}{post.body.length > 180 ? '…' : ''}</p><span className="board-small">{post.reply_count ? `${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'} · Join in` : 'Be the first to reply'}</span></Link>) : <p>Who’s throwing this week? <Link href="/board">Arrange a practice game.</Link></p>}
  </section>;
}
