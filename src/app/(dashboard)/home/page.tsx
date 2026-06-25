'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { gsap, useGSAP, getScrollParent } from '@/lib/gsap';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import {
  Loader2, Heart, MessageCircle, Trash2,
  Check, ArrowBigUp, Pencil, MessagesSquare,
  HelpCircle, Trophy, CheckCircle2, Hash, Sparkles, ArrowUp,
} from 'lucide-react';
import { Button, Tooltip, ShareButton, useToast, Modal } from '@/components/ui';
import { PostComposer } from './PostComposer';
import { usePostSeenTracker } from './usePostSeenTracker';
import {
  displayName, relativeTime, type CurrentUser, type MentionUser, type Comment, type Post,
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

// ── Post card ─────────────────────────────────────────────────
// memo'd so composer keystrokes (and other HomePage state churn) don't re-render
// every mounted card — only cards whose own props actually change re-render.
// Relies on `onDelete`/`onEdited` being stable useCallbacks in HomePage.
const PostCard = memo(function PostCard({ post, isOwn, onDelete, onEdited, currentUser, friends, observe }: {
  post: Post;
  isOwn: boolean;
  onDelete: (id: number) => void;
  onEdited: (post: Post) => void;
  currentUser: CurrentUser | null;
  friends: MentionUser[];
  observe: (el: HTMLElement | null, postId: number) => void;
}) {
  const name = displayName(post);
  const { toast } = useToast();

  const router = useRouter();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [postDeleting, setPostDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const heartIconRef = useRef<SVGSVGElement>(null);

  // Register this card's outer node with the feed-wide seen-tracker (read receipt
  // on viewport dwell). Stable per card so memo isn't invalidated each render.
  const seenRef = useCallback((el: HTMLElement | null) => observe(el, post.id), [observe, post.id]);

  const topComments = post.top_comments ?? [];

  // Favor economy: one card, branch on type. Legacy rows have no type → 'status'.
  const postType = post.type ?? 'status';
  const isAsk = postType === 'ask';
  const isWin = postType === 'win';
  const isResolved = isAsk && !!post.resolved_at;
  // Left-edge type accent — muted echo of the type badge colour (sky=help,
  // emerald=resolved, orange=win). Status posts get none, keeping the feed
  // calm: an accent only appears where it carries meaning.
  const typeAccent = isWin
    ? 'bg-primary-500'
    : isAsk
      ? (isResolved ? 'bg-emerald-500' : 'bg-sky-500')
      : null;
  const acceptedId = post.accepted_answer_id ?? null;
  // Pin the accepted answer to the top of the preview when the ask is resolved.
  const orderedTop = acceptedId
    ? [...topComments].sort((a, b) => Number(b.id === acceptedId) - Number(a.id === acceptedId))
    : topComments;

  // Win posts celebrate with a CSS shine sweep on first paint (see `.win-shine`
  // in globals.css) — calmer than the old confetti burst and zero-JS. The sweep
  // honors prefers-reduced-motion via the media query in the stylesheet.

  // Disarm the armed delete wedge on outside-click or Escape — the cross-device
  // replacement for the old pointer-leave disarm (touch never had a "leave").
  // This card's own wedge is excluded so its second click can still confirm.
  useEffect(() => {
    if (!deleteConfirming) return;
    const disarm = () => setDeleteConfirming(false);
    const onPointerDown = (e: PointerEvent) => {
      const wedge = (e.target as Element)?.closest?.('[data-delete-wedge]');
      if (wedge && cardRef.current?.contains(wedge)) return;
      disarm();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') disarm(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [deleteConfirming]);

  // Throws on failure so the caller (handleWedgeDelete) can keep the confirm armed.
  const handleDelete = async () => {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', post_id: post.id }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to delete post');
    onDelete(post.id);
  };

  // Two-step inline confirm for the quarter-circle delete wedge: first click
  // arms it (wedge fills red, trash icon → checkmark), the second runs the
  // delete; pointer-leave/blur disarms. Icon-only — the colour+icon swap is the
  // signifier (never colour alone, per HIG/accessibility).
  const handleWedgeDelete = async () => {
    if (!deleteConfirming) { setDeleteConfirming(true); return; }
    setPostDeleting(true);
    try {
      await handleDelete(); // on success the row unmounts via onDelete
      toast({ variant: 'success', title: 'Post deleted', description: 'Your post has been removed from the feed.' });
    } catch {
      setDeleteConfirming(false);
    } finally {
      setPostDeleting(false);
    }
  };

  const toggleLike = async () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => liked ? prev - 1 : prev + 1);
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', post_id: post.id }),
      });
    } catch { /* non-blocking */ }
  };

  const handleLike = () => {
    toggleLike();
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      if (!heartIconRef.current) return;
      const tl = gsap.timeline();
      tl.to(heartIconRef.current, { scale: 1.5, duration: 0.12, ease: 'power2.out' })
        .to(heartIconRef.current, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    });
  };

  return (
    <div
      ref={seenRef}
      id={`post-${post.id}`}
      data-entrance="card"
      className="post-item relative"
    >
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: POST CARD — MAIN GLASS CARD
          Contains: owner quarter-circle (own posts), header, content
          ────────────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        className="relative z-[3] bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-3xl shadow-apple-lg"
      >
        {/* Win celebration: a one-shot diagonal shine sweep clipped to the card
            (replaces the old confetti burst). CSS-only, reduced-motion-safe. */}
        {isWin && <span aria-hidden className="win-shine" />}

        {/* Left-edge type accent — a thin pill on the card's left edge (ask /
            resolved / win only). Scoped to the card so it never stretches down
            past the comments. Rendered above the card background (positive z)
            so the card's backdrop-blur can't smear its colour inward. The two
            ends fade out via a vertical mask so the layer melts into the card
            rather than terminating in a hard cut. Status posts get none. */}
        {typeAccent && (
          <span
            aria-hidden
            className={`absolute left-[-3px] top-6 bottom-6 z-1 w-[2px] rounded-full pointer-events-none ${typeAccent}`}
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)',
              maskImage: 'linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)',
            }}
          />
        )}

        {/* Top-edge highlight */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
        />

        {/* ─── Owner quarter-circle: Edit (top wedge) + Delete (right wedge) ─── */}
        {isOwn && (
          <OwnerWedge
            deleteConfirming={deleteConfirming}
            postDeleting={postDeleting}
            onEdit={() => setEditOpen(true)}
            onDelete={handleWedgeDelete}
            onDisarm={() => setDeleteConfirming(false)}
          />
        )}

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: EDIT POST MODAL
            Contains: Kit Modal hosting PostComposer in edit mode (text + image
            + visibility); patches the card in place on save via onEdited
            ────────────────────────────────────────────────────────── */}
        {isOwn && editOpen && (
          <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit post">
            <PostComposer
              currentUser={currentUser}
              friends={friends}
              onPosted={() => {}}
              editing={{ post, onSaved: (updated) => { onEdited(updated); setEditOpen(false); } }}
            />
          </Modal>
        )}

        <div className="p-5">
          {/* ── Header + content ── */}
          <div className="flex gap-3">
            <Link href={`/u/${post.username}`} className="flex-shrink-0">
              <Image
                src={post.avatar || '/Assets/Img/default-avatar.png'}
                alt={name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-xl object-cover border border-slate-800 hover:border-primary-500/30 transition-colors"
              />
            </Link>
            {/* On own posts the corner wedge occupies the top-right, so reserve
                space (pr-12) and fold the timestamp inline beside the username. */}
            <div className={`flex-1 min-w-0 ${isOwn ? 'pr-12' : ''}`}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <Link
                  href={`/u/${post.username}`}
                  className="text-sm font-bold text-white hover:text-primary-400 hover:underline transition-colors"
                >
                  {name}
                </Link>
                <Link href={`/u/${post.username}`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  @{post.username}
                </Link>
                {isOwn ? (
                  <span className="text-xs text-slate-600 flex-shrink-0">· {relativeTime(post.created_at)}</span>
                ) : (
                  <span className="text-xs text-slate-600 ml-auto flex-shrink-0">{relativeTime(post.created_at)}</span>
                )}
              </div>

              {/* ─── Type badges (ask / win) — icon + label, never colour alone (HIG) ─── */}
              {(isAsk || isWin) && (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {isAsk && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                        isResolved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {isResolved ? <CheckCircle2 className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
                      {isResolved ? 'Resolved' : 'Help needed'}
                    </span>
                  )}
                  {isAsk && post.skill_tag && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800/60 text-slate-300">
                      <Hash className="w-3 h-3" />{post.skill_tag}
                    </span>
                  )}
                  {isWin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-primary-500/15 text-primary-400">
                      <Trophy className="w-3 h-3" /> Win
                    </span>
                  )}
                </div>
              )}

              <div
                className="mt-2 text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]"
                dangerouslySetInnerHTML={{ __html: post.content_html }}
              />
              {post.image_path && (
                <Image
                  src={post.image_path}
                  alt=""
                  width={1200}
                  height={800}
                  sizes="(max-width: 1024px) 100vw, 600px"
                  className="mt-3 w-full max-h-[28rem] object-cover rounded-2xl border border-white/[0.06]"
                />
              )}
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: POST ACTION BAR — ALWAYS-ON FOOTER
            Contains: Like + Comments (left group), Share (right)
            ──────────────────────────────────────────────────────────
            Full-bleed solid shelf pinned to the card's base. Always
            visible (no hover reveal): a real toolbar, not a floating
            pill. Opaque `surface-dark` fill — no backdrop-blur, since a
            blur behind an opaque layer is invisible work (perf). */}
        <div className="relative flex items-center justify-between rounded-b-3xl border-t border-white/[0.07] bg-surface-dark px-4 py-2.5">
          {/* Top-edge highlight — light from above on the solid shelf */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />

          {/* Left group: Like + Comments */}
          <div className="flex items-center gap-4">
            <Tooltip content={liked ? 'Unlike' : 'Like'}>
              <Button
                variant="unstyled"
                onClick={handleLike}
                aria-label={liked ? 'Unlike post' : 'Like post'}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <Heart ref={heartIconRef} className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </Button>
            </Tooltip>

            <Tooltip content="View comments">
              <Button
                variant="unstyled"
                onClick={() => router.push(`/p/${post.id}`)}
                aria-label="View comments on post"
                className="flex items-center gap-1.5 text-xs font-semibold transition-colors text-slate-400 hover:text-sky-400"
              >
                <MessageCircle className="w-4 h-4" />
                {post.comment_count > 0 && <span>{post.comment_count}</span>}
              </Button>
            </Tooltip>
          </div>

          {/* Right: Share */}
          <ShareButton
            url={`/p/${post.id}`}
            shareTitle={`${name} on Zomzam`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          />
        </div>
      </div>

      {/* ─── Static top-2 comment preview — stepped/inset stack descending from the card. ─── */}
      {topComments.length > 0 && (
        <div className="relative z-[1] overflow-hidden" aria-label="Top comments">
          <div className="pt-2">
            {orderedTop.slice(0, 2).map((c, i, arr) => (
              <ThreadChild key={c.id} isLast={i === arr.length - 1}>
                <CommentCard
                  comment={c}
                  actions={
                    c.id === acceptedId || c.upvote_count > 0 ? (
                      <>
                        {c.id === acceptedId && (
                          <span className="flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Accepted
                          </span>
                        )}
                        {c.upvote_count > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary-500/80">
                            <ArrowBigUp className="w-3 h-3" fill="currentColor" />
                            {c.upvote_count}
                          </span>
                        )}
                      </>
                    ) : null
                  }
                />
              </ThreadChild>
            ))}
          </div>
        </div>
      )}

    </div>
  );
});

// ── Owner quarter-circle control ──────────────────────────────
// A 90° corner wedge pinned to the card's top-right, split by a 45° bisector
// into two icon-only buttons: Edit (upper wedge — placeholder) and Delete
// (right wedge — two-step confirm). Static, no hover reveal. The quarter-disc
// arc is approximated with clip-path polygons whose apex is the top-right
// corner (the disc centre); the container's rounded-tr-3xl + overflow-hidden
// makes the outer corner sit flush with the card.
const WEDGE_EDIT_CLIP = 'polygon(100% 0, 0 0, 3.4% 25.9%, 13.4% 50%, 29.3% 70.7%)';
const WEDGE_DELETE_CLIP = 'polygon(100% 0, 29.3% 70.7%, 50% 86.6%, 74.1% 96.6%, 100% 100%)';

function OwnerWedge({
  deleteConfirming,
  postDeleting,
  onEdit,
  onDelete,
  onDisarm,
}: {
  deleteConfirming: boolean;
  postDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDisarm: () => void;
}) {
  return (
    <div className="absolute top-0 right-0 z-[4] w-[60px] h-[60px] rounded-tr-3xl overflow-hidden pointer-events-none">
      {/* Edit — upper wedge: opens the edit modal */}
      <Button
        variant="unstyled"
        onClick={onEdit}
        title="Edit post"
        aria-label="Edit post"
        className="group absolute inset-0 pointer-events-auto bg-white/[0.04] hover:bg-primary-500/20 transition-colors"
        style={{ clipPath: WEDGE_EDIT_CLIP }}
      >
        <Pencil className="absolute right-[26px] top-[8px] w-3.5 h-3.5 text-slate-400 group-hover:text-primary-400 transition-colors" />
      </Button>

      {/* Delete — right wedge: first click arms (red fill + checkmark), second deletes */}
      <Button
        variant="unstyled"
        data-delete-wedge
        onClick={onDelete}
        onBlur={onDisarm}
        disabled={postDeleting}
        aria-label={deleteConfirming ? 'Confirm delete post' : 'Delete post'}
        title={deleteConfirming ? 'Click again to confirm' : 'Delete post'}
        className={`group absolute inset-0 pointer-events-auto transition-colors disabled:opacity-60 ${
          deleteConfirming ? 'bg-red-600' : 'bg-white/[0.04] hover:bg-red-600/30'
        }`}
        style={{ clipPath: WEDGE_DELETE_CLIP }}
      >
        {postDeleting ? (
          <Loader2 className="absolute right-[10px] top-[26px] w-3.5 h-3.5 text-white animate-spin" />
        ) : deleteConfirming ? (
          <Check className="absolute right-[10px] top-[26px] w-3.5 h-3.5 text-white" />
        ) : (
          <Trash2 className="absolute right-[10px] top-[26px] w-3.5 h-3.5 text-slate-400 group-hover:text-red-300 transition-colors" />
        )}
      </Button>

      {/* 45° bisector hairline — signifies the two distinct halves */}
      <span
        aria-hidden
        className="absolute top-0 right-0 w-px h-[60px] bg-white/10 pointer-events-none"
        style={{ transformOrigin: 'top', transform: 'rotate(45deg)' }}
      />
    </div>
  );
}

// ── Thread connector ──────────────────────────────────────────
// Wraps a comment so a thin rail descends from the parent (post or comment)
// with a short elbow into each child card. The rail runs full height for
// every child except the last, where it stops at the elbow — giving a clean
// branch that links a post to its comments and a comment to its replies.
function ThreadChild({ isLast, children }: { isLast?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative pl-5 pb-2 last:pb-0">
      {/* vertical rail */}
      <span
        aria-hidden
        className={`absolute left-1.5 top-0 w-px bg-slate-800/60 ${isLast ? 'h-[18px]' : 'bottom-0'}`}
      />
      {/* elbow into the card */}
      <span aria-hidden className="absolute left-1.5 top-[18px] h-px w-3 bg-slate-800/60" />
      {children}
    </div>
  );
}

// ── Uniform comment card ──────────────────────────────────────
// One design for every comment in the feed — the static top-2 previews under a
// post AND the rows in the expanded thread. Deliberately distinct from the post
// card (solid dark surface, hairline border, tighter radius, no glass blur or
// drop shadow) so a comment never reads as a post. Callers slot header controls
// via `actions` and may override the body via `children` (e.g. an edit box).
function CommentCard({
  comment,
  actions,
  children,
  className,
}: {
  comment: Comment;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const name = displayName(comment);
  return (
    <div className={`flex gap-2 ${className ?? ''}`}>
      <Image
        src={comment.avatar || '/Assets/Img/default-avatar.png'}
        alt=""
        width={28}
        height={28}
        className="w-7 h-7 rounded-lg object-cover border border-slate-800 flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0 bg-[#111318] rounded-2xl border border-white/[0.05] px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-white truncate">{name}</span>
          <span className="text-[10px] text-slate-600 flex-shrink-0">{relativeTime(comment.created_at)}</span>
          {actions && <div className="ml-auto flex items-center gap-3">{actions}</div>}
        </div>
        {children ?? (
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed break-words [overflow-wrap:anywhere]">
            {comment.content}
          </p>
        )}
      </div>
    </div>
  );
}

