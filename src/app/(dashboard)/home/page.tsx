'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gsap, useGSAP, getScrollParent } from '@/lib/gsap';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import {
  Loader2, MessagesSquare, HelpCircle, Sparkles, ArrowUp,
} from 'lucide-react';
import { Button, PostComposer, PostCard } from '@/components/ui';
import { usePostSeenTracker } from './usePostSeenTracker';
import {
  type CurrentUser, type MentionUser, type Post,
} from './shared';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  // friends is still needed for the composer's @mention autocomplete + edit modal.
  const [friends, setFriends] = useState<MentionUser[]>([]);

  // ── New-posts pill ──────────────────────────────────────────
  // Live SSE `zz-new-post` signals from people in the network bump this counter;
  // a soft pill offers to refresh instead of yanking the user's scroll position.
  const [newPostsCount, setNewPostsCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Feed state ──────────────────────────────────────────────
  // Chat-style read model: the feed serves UNSEEN posts first (newest-first,
  // keyset-paginated by the smallest post id already delivered), then backfills
  // SEEN posts. `tier` tracks which progression we're in; `cursor` is that id.
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedFilter, setFeedFilter] = useState<'all' | 'help' | 'help_matches'>('all');
  const [tier, setTier] = useState<'unseen' | 'seen'>('unseen');
  const [hasMore, setHasMore] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Desktop = fine pointer + wide viewport. Drives the end-of-feed UX: unseen
  // always auto-loads; once exhausted, the SEEN tier auto-loads on mobile but
  // waits for a "Load older posts" click on desktop (less jarring with a mouse).
  const [isDesktop, setIsDesktop] = useState(false);

  // Seen-tracker: marks cards as read on viewport dwell (see usePostSeenTracker).
  const { observe } = usePostSeenTracker();

  // Mirror mutable values into refs so the stable IntersectionObserver / loader
  // callbacks always read fresh state without being torn down each change.
  const loadingFeedRef = useRef(false);
  const tierRef = useRef<'unseen' | 'seen'>('unseen');
  const cursorRef = useRef<number | null>(null);
  const hasMoreRef = useRef(true);
  // Count of posts actually delivered into the feed this session. Lets loadMore
  // detect an empty feed without reading async `posts` state — see the
  // unseen→seen advance below (empty unseen tier must auto-pull the seen tier).
  const deliveredRef = useRef(0);
  const feedFilterRef = useRef(feedFilter);
  const isDesktopRef = useRef(isDesktop);
  useEffect(() => { isDesktopRef.current = isDesktop; }, [isDesktop]);

  // Stable handlers so memo(PostCard) isn't invalidated every render. setPosts is
  // referentially stable, so these callbacks never need to change.
  const handleDeletePost = useCallback((id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Prepend a freshly-created post (from the composer) to the top of the feed.
  // The author has already been recorded as having seen it server-side.
  const handlePostCreated = useCallback((post: Post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  // Patch a post in place after an inline edit (content/image/visibility) — no refetch.
  const handlePostEdited = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  // pageRef reuses containerRef (same DOM node, usePageEntrance uses it as animation scope)
  usePageEntrance(containerRef, [posts.length]);

  // ── Data bootstrap ──────────────────────────────────────────
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

  // ── Desktop vs mobile (pointer + width) ─────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // ── Feed loading ────────────────────────────────────────────
  // One loader for both tiers. Reads tier/cursor from refs so it can be a single
  // stable callback. When the unseen tier runs dry it advances to the seen tier
  // (without fetching yet) so desktop can gate the first seen page behind a button.
  const loadMore = useCallback(async () => {
    if (loadingFeedRef.current || !hasMoreRef.current) return;
    loadingFeedRef.current = true;
    setLoadingFeed(true);
    // When true, the unseen tier ran dry on a still-empty feed; we chain straight
    // into the seen tier (the sentinel + "Load older" button that normally drive
    // it only render once posts exist, so an empty feed would otherwise dead-end).
    let chainSeen = false;
    try {
      const params = new URLSearchParams({ action: 'feed', tier: tierRef.current });
      if (cursorRef.current) params.set('cursor', String(cursorRef.current));
      if (feedFilterRef.current !== 'all') params.set('filter', feedFilterRef.current);

      const res = await fetch(`/api/posts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const isFirstPage = !cursorRef.current;
        setPosts((prev) => {
          if (isFirstPage && tierRef.current === 'unseen' && prev.length === 0) return data.posts;
          const known = new Set(prev.map((p: Post) => p.id));
          return [...prev, ...data.posts.filter((p: Post) => !known.has(p.id))];
        });
        deliveredRef.current += data.posts.length;
        cursorRef.current = data.next_cursor ?? null;

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
          // If nothing has been delivered yet, the empty-state renders (no
          // sentinel, no button) and the seen tier would never load. This is the
          // common case for a returning user — and always for your own just-posted
          // content, which is recorded as seen on creation. Pull the first seen
          // page right now. Otherwise desktop waits for the button, mobile for the
          // sentinel, exactly as before.
          if (deliveredRef.current === 0) chainSeen = true;
        } else {
          hasMoreRef.current = false;
          setHasMore(false);
        }
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

  // ── New-posts pill + merge-on-refresh ───────────────────────
  // SSE delivers `zz-new-post` when someone in the network posts. We only count
  // it (a soft signal) so the user's scroll isn't disturbed.
  useEffect(() => {
    const onNewPost = () => setNewPostsCount((c) => c + 1);
    window.addEventListener('zz-new-post', onNewPost);
    return () => window.removeEventListener('zz-new-post', onNewPost);
  }, []);

  // Clicking the pill fetches the freshest unseen page and MERGES it onto the top
  // of the feed (preserving everything already scrolled), rather than wiping and
  // reloading from scratch. The merged-in posts are themselves unseen, so they
  // get marked read as the user scrolls back over them.
  const refreshUnseen = useCallback(async () => {
    setNewPostsCount(0);
    try {
      const params = new URLSearchParams({ action: 'feed', tier: 'unseen' });
      if (feedFilterRef.current !== 'all') params.set('filter', feedFilterRef.current);
      const res = await fetch(`/api/posts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPosts((prev) => {
          const known = new Set(prev.map((p: Post) => p.id));
          const fresh = data.posts.filter((p: Post) => !known.has(p.id));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      }
    } catch { /* non-blocking */ }
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Infinite scroll sentinel ────────────────────────────────
  // Auto-loads the unseen tier always; auto-loads the seen tier only on mobile
  // (desktop pulls older posts via an explicit button). Re-created when the feed
  // length / tier / hasMore / device changes so it re-evaluates an in-view sentinel.
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

  useGSAP(() => {
    if (initialLoading || posts.length === 0) return;
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.post-item', {
        y: 20,
        opacity: 0,
        stagger: 0.07,
        ease: 'power2.out',
        duration: 0.4,
        scrollTrigger: {
          trigger: '.post-item',
          start: 'top 88%',
          toggleActions: 'play none none none',
          scroller: getScrollParent(feedRef.current ?? null),
        },
      });
    });
  }, { scope: feedRef, dependencies: [initialLoading] });

  return (
    /* ──────────────────────────────────────────────────────────
        DEVELOPMENT NAVIGATOR: HOME / COMMUNITY FEED
        Contains: Post composer, infinite-scroll feed, right sidebar
        ────────────────────────────────────────────────────────── */
    <div ref={containerRef} className="max-w-2xl mx-auto relative animate-in">
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: MAIN FEED (single column)
          Contains: Composer card, post feed with infinite scroll. The social
          right sidebar (Messages / Active Now / Suggested) now lives globally
          in the dashboard shell (RightSidebar), not per-page here.
          ────────────────────────────────────────────────────────── */}
      <div>
        <div ref={feedRef} className="space-y-4">

          <div id="post-composer">
            <PostComposer currentUser={currentUser} friends={friends} onPosted={handlePostCreated} />
          </div>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: FEED FILTER (All · Help requests · Matching skills)
              Contains: segmented feed scope selector (drives ?filter=)
              ────────────────────────────────────────────────────────── */}
          <div role="tablist" aria-label="Feed filter" className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1">
            {([
              { value: 'all', label: 'All', icon: MessagesSquare },
              { value: 'help', label: 'Help requests', icon: HelpCircle },
              { value: 'help_matches', label: 'Matching my skills', icon: Sparkles },
            ] as const).map(({ value, label, icon: Icon }) => {
              const isActive = feedFilter === value;
              return (
                <Button
                  key={value}
                  variant="unstyled"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFeedFilter(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    isActive ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              );
            })}
          </div>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: NEW POSTS PILL
              Soft, dismissible refresh prompt — appears live when someone in the
              network posts (SSE). Sticky so it stays reachable while scrolling.
              ────────────────────────────────────────────────────────── */}
          {newPostsCount > 0 && (
            <div className="sticky top-2 z-20 flex justify-center pointer-events-none">
              <Button
                variant="unstyled"
                onClick={refreshUnseen}
                className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold shadow-lg shadow-primary-500/30 transition-colors animate-in slide-in-from-top"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}
              </Button>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: FEED
              Contains: Post cards, infinite scroll sentinel, empty state
              ────────────────────────────────────────────────────────── */}
          {initialLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-[#1A1D24] border border-dashed border-slate-800/60 rounded-3xl p-10 text-center">
              <p className="text-sm font-semibold text-slate-400">No posts yet</p>
              <p className="text-xs text-slate-500 mt-1">Be the first to share something with the community.</p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isOwn={currentUser?.username === post.username}
                  onDelete={handleDeletePost}
                  onEdited={handlePostEdited}
                  onReposted={handlePostCreated}
                  currentUser={currentUser}
                  friends={friends}
                  observe={observe}
                />
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={bottomRef} className="h-1" />

              {loadingFeed && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  DEVELOPMENT NAVIGATOR: END OF UNSEEN → SEEN BACKFILL
                  Once unseen posts run out we enter the seen tier. Desktop pulls
                  older posts via this explicit button; mobile auto-loads them.
                  ────────────────────────────────────────────────────────── */}
              {tier === 'seen' && hasMore && isDesktop && !loadingFeed && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadMore}
                    className="rounded-full"
                  >
                    Load older posts
                  </Button>
                </div>
              )}

              {!hasMore && (
                <p className="text-center text-xs text-slate-600 py-4">You're all caught up</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

