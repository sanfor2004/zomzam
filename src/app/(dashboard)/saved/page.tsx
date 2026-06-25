'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { PostCard } from '../home/PostCard';
import { type CurrentUser, type MentionUser, type Post } from '../home/shared';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: SAVED POSTS PAGE
// Auth-gated by the (dashboard) layout (unauthenticated → /sign). Loads the
// viewer's bookmarked posts newest-saved-first (keyset on bookmark id) and
// renders the SAME shared PostCard as the feed. Un-bookmarking drops the card.
// ──────────────────────────────────────────────────────────
export default function SavedPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [friends, setFriends] = useState<MentionUser[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef<number | null>(null);
  const hasMoreRef = useRef(true);
  usePageEntrance(containerRef, [posts.length]);

  // PostCard requires an `observe` (feed seen-tracker); the saved page doesn't
  // track read receipts, so a stable no-op satisfies the contract.
  const noopObserve = useCallback((_el: HTMLElement | null, _postId: number) => {}, []);

  const handleDelete = useCallback((id: number) => setPosts((prev) => prev.filter((p) => p.id !== id)), []);
  const handleEdited = useCallback((u: Post) => setPosts((prev) => prev.map((p) => (p.id === u.id ? { ...p, ...u } : p))), []);
  // Un-bookmarking removes the card from the saved list (its place is here).
  const handleUnbookmark = useCallback((id: number) => setPosts((prev) => prev.filter((p) => p.id !== id)), []);

  // ── Data bootstrap (viewer + friends for the edit modal's @-autocomplete) ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth?action=check');
        const data = await res.json();
        if (data.success && data.authenticated) setCurrentUser(data.user);
      } catch { /* non-blocking */ }
    })();
    (async () => {
      try {
        const res = await fetch('/api/social?action=friends');
        const data = await res.json();
        if (data.success) setFriends(data.friends || []);
      } catch { /* non-blocking */ }
    })();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'saved' });
      if (cursorRef.current) params.set('cursor', String(cursorRef.current));
      const res = await fetch(`/api/posts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPosts((prev) => {
          const known = new Set(prev.map((p: Post) => p.id));
          return [...prev, ...data.posts.filter((p: Post) => !known.has(p.id))];
        });
        cursorRef.current = data.next_cursor ?? null;
        hasMoreRef.current = !!data.has_more;
        setHasMore(!!data.has_more);
      }
    } catch { /* non-blocking */ }
    setLoading(false);
    loadingRef.current = false;
    setInitialLoading(false);
  }, []);

  useEffect(() => { loadMore(); }, [loadMore]);

  // Infinite-scroll sentinel.
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current && !loadingRef.current) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [posts.length, hasMore, loadMore]);

  return (
    /* ──────────────────────────────────────────────────────────
        DEVELOPMENT NAVIGATOR: SAVED FEED (single column)
        Contains: header, saved post cards, infinite-scroll sentinel, empty state
        ────────────────────────────────────────────────────────── */
    <div ref={containerRef} className="max-w-2xl mx-auto relative animate-in">
      <div className="flex items-center gap-2 mb-4">
        <Bookmark className="w-5 h-5 text-primary-500" />
        <h1 data-entrance="title" className="text-title font-black text-white">Saved</h1>
      </div>

      <div className="space-y-4">
        {initialLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-[#1A1D24] border border-dashed border-slate-800/60 rounded-3xl p-10 text-center">
            <p className="text-sm font-semibold text-slate-400">Nothing saved yet</p>
            <p className="text-xs text-slate-500 mt-1">Tap the bookmark on any post to keep it here.</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isOwn={currentUser?.username === post.username}
                onDelete={handleDelete}
                onEdited={handleEdited}
                onUnbookmark={handleUnbookmark}
                currentUser={currentUser}
                friends={friends}
                observe={noopObserve}
              />
            ))}

            <div ref={bottomRef} className="h-1" />

            {loading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            )}
            {!hasMore && (
              <p className="text-center text-xs text-slate-600 py-4">That&apos;s everything you&apos;ve saved</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
