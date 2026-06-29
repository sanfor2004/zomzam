'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePostSeenTracker } from './usePostSeenTracker';
import type { Post } from './shared';
import { fetchFeedPage, fetchUnseenPosts, type FeedFilter, type FeedTier } from './page.services';

// ──────────────────────────────────────────────────────────
// Home feed state machine.
//
// Chat-style read model: serves UNSEEN posts first (newest-first, keyset-
// paginated by the smallest delivered id), then backfills SEEN posts. `tier`
// tracks the progression; `cursor` is that id. Drives the infinite-scroll
// sentinel, the desktop "Load older" gate, and the live new-posts pill. All the
// mutable cursor/tier bookkeeping lives in refs so the loader + observer stay
// stable callbacks that always read fresh values without being torn down.
// ──────────────────────────────────────────────────────────
export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [tier, setTier] = useState<FeedTier>('unseen');
  const [hasMore, setHasMore] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Desktop = fine pointer + wide viewport. Unseen always auto-loads; once
  // exhausted, the SEEN tier auto-loads on mobile but waits for a "Load older"
  // click on desktop (less jarring with a mouse).
  const [isDesktop, setIsDesktop] = useState(false);
  // New-posts pill: live SSE `zz-new-post` signals bump this; a soft pill offers
  // a refresh instead of yanking the user's scroll position.
  const [newPostsCount, setNewPostsCount] = useState(0);

  // Seen-tracker: marks cards as read on viewport dwell.
  const { observe } = usePostSeenTracker();

  // Mirror mutable values into refs so the stable observer/loader callbacks read
  // fresh state without re-subscribing each change.
  const loadingFeedRef = useRef(false);
  const tierRef = useRef<FeedTier>('unseen');
  const cursorRef = useRef<number | null>(null);
  const hasMoreRef = useRef(true);
  // Posts actually delivered this session — lets loadMore detect an empty feed
  // without reading async `posts` (the empty unseen tier must auto-pull seen).
  const deliveredRef = useRef(0);
  const feedFilterRef = useRef(feedFilter);
  const isDesktopRef = useRef(isDesktop);
  useEffect(() => { isDesktopRef.current = isDesktop; }, [isDesktop]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Stable mutators so memo(PostCard) isn't invalidated each render.
  const handleDeletePost = useCallback((id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);
  const handlePostCreated = useCallback((post: Post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);
  const handlePostEdited = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }, []);

  // One loader for both tiers. Reads tier/cursor from refs so it can be a single
  // stable callback. When the unseen tier runs dry it advances to the seen tier
  // (without fetching yet) so desktop can gate the first seen page behind a button.
  const loadMore = useCallback(async () => {
    if (loadingFeedRef.current || !hasMoreRef.current) return;
    loadingFeedRef.current = true;
    setLoadingFeed(true);
    // When true, the unseen tier ran dry on a still-empty feed; we chain straight
    // into the seen tier (the sentinel + button that drive it only render once
    // posts exist, so an empty feed would otherwise dead-end).
    let chainSeen = false;
    try {
      const data = await fetchFeedPage({ tier: tierRef.current, cursor: cursorRef.current, filter: feedFilterRef.current });
      const isFirstPage = !cursorRef.current;
      setPosts((prev) => {
        if (isFirstPage && tierRef.current === 'unseen' && prev.length === 0) return data.posts;
        const known = new Set(prev.map((p) => p.id));
        return [...prev, ...data.posts.filter((p) => !known.has(p.id))];
      });
      deliveredRef.current += data.posts.length;
      cursorRef.current = data.next_cursor;

      if (data.has_more) {
        hasMoreRef.current = true;
        setHasMore(true);
      } else if (tierRef.current === 'unseen') {
        // Unseen exhausted → advance to the seen backfill tier.
        tierRef.current = 'seen';
        cursorRef.current = null;
        hasMoreRef.current = true; // provisional; the first seen page confirms
        setTier('seen');
        setHasMore(true);
        // Nothing delivered yet (returning user / your own just-seen posts) → the
        // empty-state renders with no sentinel/button, so pull the first seen page
        // now. Otherwise desktop waits for the button, mobile for the sentinel.
        if (deliveredRef.current === 0) chainSeen = true;
      } else {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch { /* non-blocking */ }
    setLoadingFeed(false);
    loadingFeedRef.current = false;
    if (chainSeen) {
      // Keep the loader up (don't flash the empty state) while the seen page loads.
      loadMore();
    } else {
      setInitialLoading(false);
    }
  }, []);

  // Reset to a fresh unseen feed (mount + whenever the filter changes).
  const resetAndLoad = useCallback(() => {
    tierRef.current = 'unseen';
    cursorRef.current = null;
    hasMoreRef.current = true;
    deliveredRef.current = 0;
    setTier('unseen');
    setHasMore(true);
    setInitialLoading(true);
    setPosts([]);
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    feedFilterRef.current = feedFilter;
    resetAndLoad();
  }, [feedFilter, resetAndLoad]);

  // Desktop vs mobile (pointer + width).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Live new-posts signal (SSE). Only counted — never disturbs scroll.
  useEffect(() => {
    const onNewPost = () => setNewPostsCount((c) => c + 1);
    window.addEventListener('zz-new-post', onNewPost);
    return () => window.removeEventListener('zz-new-post', onNewPost);
  }, []);

  // Clicking the pill merges the freshest unseen page onto the top of the feed
  // (preserving everything already scrolled) rather than wiping and reloading.
  const refreshUnseen = useCallback(async () => {
    setNewPostsCount(0);
    try {
      const fresh = await fetchUnseenPosts(feedFilterRef.current);
      setPosts((prev) => {
        const known = new Set(prev.map((p) => p.id));
        const add = fresh.filter((p) => !known.has(p.id));
        return add.length ? [...add, ...prev] : prev;
      });
    } catch { /* non-blocking */ }
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Infinite-scroll sentinel. Auto-loads unseen always; auto-loads seen only on
  // mobile (desktop pulls older posts via an explicit button). Re-created when
  // length/tier/hasMore/device change so it re-evaluates an in-view sentinel.
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !hasMoreRef.current || loadingFeedRef.current) return;
        if (tierRef.current === 'seen' && isDesktopRef.current) return; // desktop seen = manual
        loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [posts.length, hasMore, tier, isDesktop, loadMore]);

  return {
    posts, feedFilter, setFeedFilter, tier, hasMore, loadingFeed, initialLoading, isDesktop,
    newPostsCount, refreshUnseen, loadMore, observe,
    bottomRef, feedRef,
    handleDeletePost, handlePostCreated, handlePostEdited,
  };
}
