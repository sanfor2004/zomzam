'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { gsap, useGSAP, ScrollTrigger, getScrollParent } from '@/lib/gsap';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import {
  Send, Loader2, Heart, MessageCircle, Trash2,
  UserPlus, Check, Users, ArrowBigUp, MoreHorizontal, Pencil,
} from 'lucide-react';
import { Button, Tooltip, ConfirmDialog, Dropdown, DropdownItem, ShareButton, ToastProvider, useToast } from '@/components/ui';
import { PostComposer } from './PostComposer';
import { displayName, type CurrentUser, type MentionUser, type Comment, type Post } from './shared';

interface SuggestedUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  bio?: string | null;
  matching_tags?: string[];
}

// Highest-voted first; ties fall back to oldest-first so order stays stable.
function byUpvotes(a: Comment, b: Comment): number {
  return b.upvote_count - a.upvote_count
    || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

// Sort a level and every nested reply level the same way (recursive).
function sortByUpvotes(nodes: Comment[]): Comment[] {
  nodes.sort(byUpvotes);
  for (const n of nodes) if (n.replies?.length) sortByUpvotes(n.replies);
  return nodes;
}

function buildTree(flat: Comment[]): Comment[] {
  const map = new Map<number, Comment>();
  const roots: Comment[] = [];
  for (const c of flat) map.set(c.id, { ...c, replies: [] });
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parent_id != null && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }
  return sortByUpvotes(roots);
}

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// How many top-level comments to reveal before the "Load more" button.
const COMMENTS_PAGE_SIZE = 6;
const REPLIES_PAGE_SIZE = 4;

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [friends, setFriends] = useState<MentionUser[]>([]);
  const [peopleSuggestions, setPeopleSuggestions] = useState<SuggestedUser[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Stable handlers so memo(PostCard) isn't invalidated every render. setPosts is
  // referentially stable, so these callbacks never need to change.
  const handleDeletePost = useCallback((id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Prepend a freshly-created post (from the composer) to the top of the feed.
  const handlePostCreated = useCallback((post: Post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingFeedRef = useRef(false);
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

    (async () => {
      try {
        const res = await fetch('/api/social?action=discover');
        const data = await res.json();
        if (data.success) setPeopleSuggestions((data.users || []).slice(0, 5));
      } catch { /* non-blocking */ }
    })();
  }, []);

  const handleAddFriend = async (userId: number) => {
    setSentRequests((prev) => new Set(prev).add(userId));
    try {
      await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'friend_request', user_id: userId }),
      });
    } catch { /* non-blocking */ }
  };

  // ── Feed loading ────────────────────────────────────────────
  const loadFeed = useCallback(async (offset = 0) => {
    if (loadingFeedRef.current) return;
    loadingFeedRef.current = true;
    setLoadingFeed(true);
    try {
      const res = await fetch(`/api/posts?action=feed&offset=${offset}`);
      const data = await res.json();
      if (data.success) {
        setPosts((prev) => {
          if (!offset) return data.posts;
          // Dedupe in case a locally-prepended post shifts the server offset.
          const seen = new Set(prev.map((p: Post) => p.id));
          return [...prev, ...data.posts.filter((p: Post) => !seen.has(p.id))];
        });
        setHasMore(data.has_more);
      }
    } catch { /* non-blocking */ }
    setLoadingFeed(false);
    setInitialLoading(false);
    loadingFeedRef.current = false;
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // ── Infinite scroll sentinel ────────────────────────────────
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingFeedRef.current) {
          loadFeed(posts.length);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [posts, hasMore, loadFeed]);

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
    <div ref={containerRef} className="max-w-6xl mx-auto relative animate-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: MAIN FEED COLUMN
            Contains: Composer card, post feed with infinite scroll
            ────────────────────────────────────────────────────────── */}
        <div ref={feedRef} className="lg:col-span-2 space-y-4">

          <PostComposer currentUser={currentUser} friends={friends} onPosted={handlePostCreated} />

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
                  viewerUsername={currentUser?.username ?? null}
                  onDelete={handleDeletePost}
                />
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={bottomRef} className="h-1" />

              {loadingFeed && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              )}

              {!hasMore && (
                <p className="text-center text-xs text-slate-600 py-4">You're all caught up</p>
              )}
            </>
          )}
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: RIGHT SIDEBAR
            Contains: My Friends list, People You May Know suggestions
            ────────────────────────────────────────────────────────── */}
        <aside className="hidden lg:block self-start lg:sticky lg:top-0">
          <div className="space-y-4">

            {/* My Friends */}
            <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-5 shadow-apple">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    My Friends
                  </h3>
                  {friends.length > 0 && (
                    <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                      {friends.length}
                    </span>
                  )}
                </div>
                <Link
                  href="/community/friends"
                  className="text-[10px] font-bold uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors"
                >
                  View All
                </Link>
              </div>

              {friends.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">
                  No friends yet — discover people below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 py-1">
                  {friends.slice(0, 7).map((f) => (
                    <Tooltip key={f.id} content={`${displayName(f)} · ${f.online_label || 'Offline'}`}>
                      <Link href={`/u/${f.username}`} className="relative flex-shrink-0">
                        <Image
                          src={f.avatar || '/Assets/Img/default-avatar.png'}
                          alt={displayName(f)}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-800 hover:border-primary-500/40 transition-colors"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111318] ${
                            f.is_online ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                      </Link>
                    </Tooltip>
                  ))}
                  {friends.length > 7 && (
                    <Link
                      href="/community/friends"
                      className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors flex-shrink-0"
                    >
                      +{friends.length - 7}
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* People You May Know */}
            {peopleSuggestions.length > 0 && (
              <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-5 shadow-apple">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    People You May Know
                  </h3>
                  <Link
                    href="/community/discover"
                    className="text-[10px] font-bold uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors"
                  >
                    See More
                  </Link>
                </div>

                <div className="space-y-3">
                  {peopleSuggestions.map((u) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <Link href={`/u/${u.username}`} className="flex-shrink-0">
                        <Image
                          src={u.avatar || '/Assets/Img/default-avatar.png'}
                          alt=""
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-800 hover:border-primary-500/30 transition-colors"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/u/${u.username}`}>
                          <p className="text-xs font-bold text-slate-200 truncate hover:text-white transition-colors">
                            {displayName(u)}
                          </p>
                        </Link>
                        <p className="text-[10px] text-slate-600 truncate">@{u.username}</p>
                      </div>
                      <Button
                        variant="unstyled"
                        onClick={() => handleAddFriend(u.id)}
                        disabled={sentRequests.has(u.id)}
                        title={sentRequests.has(u.id) ? 'Request sent' : 'Add friend'}
                        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all disabled:cursor-default ${
                          sentRequests.has(u.id)
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20'
                        }`}
                      >
                        {sentRequests.has(u.id)
                          ? <><Check className="w-3 h-3" /> Sent</>
                          : <><UserPlus className="w-3 h-3" /> Add</>}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
}

// ── Post card ─────────────────────────────────────────────────
// memo'd so composer keystrokes (and other HomePage state churn) don't re-render
// every mounted card — only cards whose own props actually change re-render.
// Relies on `onDelete` being a stable useCallback in HomePage.
const PostCard = memo(function PostCard({ post, isOwn, viewerUsername, onDelete }: { post: Post; isOwn: boolean; viewerUsername?: string | null; onDelete: (id: number) => void }) {
  const name = displayName(post);
  const { toast } = useToast();

  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [visibleComments, setVisibleComments] = useState(COMMENTS_PAGE_SIZE);

  const cardRef = useRef<HTMLDivElement>(null);
  const heartIconRef = useRef<SVGSVGElement>(null);
  const topStackRef = useRef<HTMLDivElement>(null);
  const commentsWrapRef = useRef<HTMLDivElement>(null);
  const commentsInnerRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [postDeleting, setPostDeleting] = useState(false);
  // Trails `commentsOpen`: stays true through the collapse tween so the close
  // animation can play out before React unmounts the thread.
  const [commentsMounted, setCommentsMounted] = useState(false);

  // Top-2 rated root comments ship inline with the feed payload (api/posts feed
  // action) and render as an always-visible static stack beneath the card — no
  // hover, no per-card fetch. Animated out only while the full thread is open.
  const topComments = post.top_comments ?? [];

  // ── Comment reveal (accordion height + content fade) ──────────
  // Sequenced against the static top-2 stack so the two never co-exist at full
  // height (no mid-transition bulge): opening collapses the stack, then expands
  // the thread; closing reverses. Height is the one layout-bound property we
  // animate — justified because no transform can make sibling content reflow,
  // and it's a one-shot, single-card interaction. `will-change` is scoped to the
  // tween's lifetime, never left on. Reduced-motion users get an instant swap.
  useGSAP(() => {
    const wrap = commentsWrapRef.current;
    if (!wrap) return; // closed + unmounted — nothing to animate
    const stack = topStackRef.current;
    const inner = commentsInnerRef.current;
    // Cancel any in-flight tweens so a fast open→close→open never overlaps.
    gsap.killTweensOf([wrap, inner, stack].filter(Boolean) as Element[]);

    gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
      if (commentsOpen) {
        if (stack) gsap.set(stack, { height: 0, autoAlpha: 0 });
        gsap.set(wrap, { height: 'auto' });
        if (inner) gsap.set(inner, { autoAlpha: 1, y: 0 });
      } else {
        gsap.set(wrap, { height: 0 });
        if (stack) gsap.set(stack, { height: 'auto', autoAlpha: 1 });
        setCommentsMounted(false);
      }
    });

    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      if (commentsOpen) {
        if (stack) tl.to(stack, { height: 0, autoAlpha: 0, duration: 0.18, ease: 'power2.in' });
        tl.set(wrap, { willChange: 'height' })
          .fromTo(wrap, { height: 0 }, { height: 'auto', duration: 0.3 });
        if (inner) tl.fromTo(inner, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.26 }, '<0.04');
        tl.set(wrap, { willChange: 'auto' });
      } else {
        tl.set(wrap, { willChange: 'height' });
        if (inner) tl.to(inner, { autoAlpha: 0, y: 8, duration: 0.16, ease: 'power2.in' });
        tl.to(wrap, { height: 0, duration: 0.24, ease: 'power2.in' }, inner ? '<0.04' : 0)
          .set(wrap, { willChange: 'auto' });
        if (stack) tl.fromTo(stack, { height: 0, autoAlpha: 0 }, { height: 'auto', autoAlpha: 1, duration: 0.22 });
        tl.call(() => setCommentsMounted(false)); // unmount once fully collapsed
      }
    });
  }, { dependencies: [commentsOpen], scope: cardRef });

  // First open fetches comments async, so the thread expands to the loader's
  // height first; when the real comments land we settle from that height to the
  // content's. Subsequent opens already have the data, so this no-ops.
  useGSAP(() => {
    const wrap = commentsWrapRef.current;
    const finishedLoading = wasLoadingRef.current && !loadingComments;
    wasLoadingRef.current = loadingComments;
    if (!wrap || !commentsOpen || !finishedLoading) return;
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.killTweensOf(wrap);
      const fromHeight = wrap.offsetHeight; // loader height
      gsap.set(wrap, { height: 'auto' });
      const toHeight = wrap.offsetHeight;   // settled content height
      gsap.fromTo(wrap, { height: fromHeight }, {
        height: toHeight, duration: 0.28, willChange: 'height',
        onComplete: () => gsap.set(wrap, { height: 'auto', willChange: 'auto' }),
      });
    });
  }, { dependencies: [loadingComments], scope: cardRef });

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

  const toggleComments = async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening) {
      setCommentsMounted(true); // mount the thread so the open tween has a target
      if (comments.length === 0) {
        setLoadingComments(true);
        try {
          const res = await fetch(`/api/posts?action=comments&post_id=${post.id}`);
          const data = await res.json();
          if (data.success) setComments(data.comments);
        } catch { /* non-blocking */ }
        setLoadingComments(false);
      }
    }
  };

  // Shared by PostCard (top-level) and CommentRow (replies)
  const addComment = async (text: string, parentId?: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', post_id: post.id, content: text, parent_id: parentId ?? null }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => [...prev, data.comment]);
        setCommentCount((prev) => prev + 1);
        // Keep a freshly posted top-level comment visible past the page limit.
        if (!parentId) setVisibleComments((v) => v + 1);
        return true;
      }
    } catch { /* non-blocking */ }
    return false;
  };

  // Toggle an upvote on a comment. State lives here (not in CommentRow) so the
  // tree re-sorts by vote count the moment a vote lands — that's the reordering.
  const voteComment = async (commentId: number) => {
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;
    const nextUp = !target.upvoted_by_me;

    const apply = (up: boolean) => setComments((prev) => prev.map((c) =>
      c.id === commentId
        ? { ...c, upvoted_by_me: up, upvote_count: c.upvote_count + (up ? 1 : -1) }
        : c
    ));

    apply(nextUp); // optimistic
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment_vote', comment_id: commentId }),
      });
      const data = await res.json();
      if (!data.success) apply(!nextUp); // revert on server rejection
    } catch {
      apply(!nextUp); // revert on network failure
    }
  };

  // Edit a comment's text in place. Returns false so the row can stay in edit
  // mode (keeping the user's draft) if the save fails.
  const editComment = async (commentId: number, text: string): Promise<boolean> => {
    const content = text.trim().slice(0, 1000);
    if (!content) return false;
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment_edit', comment_id: commentId, content }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: data.content } : c)));
        return true;
      }
    } catch { /* non-blocking */ }
    return false;
  };

  // Delete a comment and its whole reply thread (the server returns every id it
  // removed so the count and list stay in sync).
  const deleteComment = async (commentId: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment_delete', comment_id: commentId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.deleted_ids)) {
        const removed = new Set<number>(data.deleted_ids.map((id: number) => Number(id)));
        setComments((prev) => prev.filter((c) => !removed.has(c.id)));
        setCommentCount((prev) => Math.max(0, prev - removed.size));
        return true;
      }
    } catch { /* non-blocking */ }
    return false;
  };

  const submitTopComment = async () => {
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    const ok = await addComment(commentText);
    if (ok) setCommentText('');
    setSubmittingComment(false);
  };

  const tree = buildTree(comments);

  return (
    <div
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
            onDelete={handleWedgeDelete}
            onDisarm={() => setDeleteConfirming(false)}
          />
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

            <Tooltip content={commentsOpen ? 'Hide comments' : 'View comments'}>
              <Button
                variant="unstyled"
                onClick={toggleComments}
                aria-label={commentsOpen ? 'Hide comments' : 'View comments on post'}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  commentsOpen ? 'text-sky-400' : 'text-slate-400 hover:text-sky-400'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                {commentCount > 0 && <span>{commentCount}</span>}
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

      {/* ─── Static top-2 comment layers — "imported" as a stepped/inset stack
           descending from the card. Always mounted (so GSAP can collapse/expand
           its height); animated out while the full thread is open, which shows
           these same two ranked at its top. overflow-hidden keeps the collapse
           crisp; the pt-2 lives inside so the gap collapses with it. ─── */}
      {topComments.length > 0 && (
        <div ref={topStackRef} className="relative z-[1] overflow-hidden" aria-label="Top comments">
          <div className="pt-2">
            {topComments.slice(0, 2).map((c, i, arr) => (
              <ThreadChild key={c.id} isLast={i === arr.length - 1}>
                <CommentCard
                  comment={c}
                  actions={c.upvote_count > 0 ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary-500/80">
                      <ArrowBigUp className="w-3 h-3" fill="currentColor" />
                      {c.upvote_count}
                    </span>
                  ) : null}
                />
              </ThreadChild>
            ))}
          </div>
        </div>
      )}

      {/* ─── Expanded comments section — accordion wrapper animates height,
           inner fades/slides up. Kept mounted via `commentsMounted` so the
           collapse tween can finish before React unmounts the thread. ─── */}
      {commentsMounted && (
        <div
          ref={commentsWrapRef}
          className="overflow-hidden"
          style={{ height: 0 }}
          aria-hidden={!commentsOpen}
        >
          <div ref={commentsInnerRef} className="mt-3 px-1">
          {loadingComments ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            </div>
          ) : tree.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-2">No comments yet — be the first!</p>
          ) : (
            <>
              {tree.slice(0, visibleComments).map((c, i, arr) => (
                <ThreadChild key={c.id} isLast={i === arr.length - 1}>
                  <CommentRow
                    comment={c}
                    onReply={addComment}
                    onVote={voteComment}
                    onEdit={editComment}
                    onCommentDelete={deleteComment}
                    viewerUsername={viewerUsername}
                    depth={0}
                  />
                </ThreadChild>
              ))}
              {tree.length > visibleComments && (
                <Button
                  variant="unstyled"
                  onClick={() => setVisibleComments((v) => v + COMMENTS_PAGE_SIZE)}
                  className="w-full text-center text-xs font-semibold text-slate-500 hover:text-sky-400 transition-colors py-1.5 mt-1"
                >
                  Show {Math.min(COMMENTS_PAGE_SIZE, tree.length - visibleComments)} more comments
                </Button>
              )}
            </>
          )}

          {/* Comment input */}
          <div className="flex gap-2 mt-3 pt-1">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTopComment(); } }}
              placeholder="Write a comment…"
              maxLength={1000}
              className="flex-1 bg-white/[0.03] rounded-xl px-3 py-2 text-xs text-slate-200 border border-white/[0.06] outline-none focus:border-primary-500/40 transition-colors placeholder:text-slate-600"
            />
            <Button
              variant="primary"
              size="none"
              onClick={submitTopComment}
              disabled={!commentText.trim() || submittingComment}
              className="p-2 disabled:opacity-40 flex-shrink-0"
            >
              {submittingComment
                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                : <Send className="w-3.5 h-3.5 text-white" />}
            </Button>
          </div>
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
  onDelete,
  onDisarm,
}: {
  deleteConfirming: boolean;
  postDeleting: boolean;
  onDelete: () => void;
  onDisarm: () => void;
}) {
  return (
    <div className="absolute top-0 right-0 z-[4] w-[60px] h-[60px] rounded-tr-3xl overflow-hidden pointer-events-none">
      {/* Edit — upper wedge (inline editing ships in a later pass) */}
      <Button
        variant="unstyled"
        onClick={() => { /* placeholder — inline post editing ships in a later pass */ }}
        title="Editing coming soon"
        aria-label="Edit post (coming soon)"
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

// ── Comment row (recursive — supports reply threads) ──────────
function CommentRow({
  comment,
  onReply,
  onVote,
  onEdit,
  onCommentDelete,
  viewerUsername,
  depth,
}: {
  comment: Comment;
  onReply: (text: string, parentId?: number) => Promise<boolean>;
  onVote: (commentId: number) => void;
  onEdit: (commentId: number, text: string) => Promise<boolean>;
  onCommentDelete: (commentId: number) => Promise<boolean>;
  viewerUsername?: string | null;
  depth: number;
}) {
  const name = displayName(comment);
  const isMine = !!viewerUsername && comment.username === viewerUsername;
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Replies mirror the post's comment toggle: one reply shows statically, the
  // rest reveal on a "View replies" button — no hover, no push-down animation.
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [visibleReplies, setVisibleReplies] = useState(REPLIES_PAGE_SIZE);
  const replies = comment.replies ?? [];
  const replyCount = replies.length;
  const shownReplies = repliesExpanded ? replies.slice(0, visibleReplies) : replies.slice(0, 1);

  const submitReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onReply(replyText, comment.id);
    if (ok) { setReplyText(''); setReplyOpen(false); }
    setSubmitting(false);
  };

  const startEdit = () => {
    setEditText(comment.content);
    setEditing(true);
    setMenuOpen(false);
  };

  const saveEdit = async () => {
    if (!editText.trim() || savingEdit) return;
    setSavingEdit(true);
    const ok = await onEdit(comment.id, editText);
    if (ok) setEditing(false);
    setSavingEdit(false);
  };

  const confirmAndDelete = async () => {
    setDeleting(true);
    const ok = await onCommentDelete(comment.id);
    // On success the row unmounts; on failure, drop back out of the dialog.
    if (!ok) { setDeleting(false); setConfirmDelete(false); }
  };

  return (
    <div>

      <CommentCard
        comment={comment}
        actions={
          <>
            <Tooltip content={comment.upvoted_by_me ? 'Remove upvote' : 'Upvote'}>
              <Button
                variant="unstyled"
                onClick={() => onVote(comment.id)}
                aria-label={comment.upvoted_by_me ? 'Remove upvote' : 'Upvote comment'}
                className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${
                  comment.upvoted_by_me ? 'text-primary-500' : 'text-slate-500 hover:text-primary-400'
                }`}
              >
                <ArrowBigUp className="w-3.5 h-3.5" fill={comment.upvoted_by_me ? 'currentColor' : 'none'} />
                {comment.upvote_count > 0 && <span>{comment.upvote_count}</span>}
              </Button>
            </Tooltip>
            {depth < 2 && (
              <Button
                variant="unstyled"
                onClick={() => setReplyOpen((p) => !p)}
                className={`text-[10px] font-semibold transition-colors ${
                  replyOpen ? 'text-sky-400' : 'text-slate-500 hover:text-sky-400'
                }`}
              >
                Reply
              </Button>
            )}
            {isMine && (
              <Dropdown
                mode="menu"
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                align="right"
                dropdownClassName="min-w-[10rem] p-1.5 space-y-0.5"
                trigger={
                  <Button
                    variant="unstyled"
                    onClick={() => setMenuOpen((p) => !p)}
                    aria-label="Comment options"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                }
              >
                <DropdownItem leading={<Pencil className="w-4 h-4" />} onClick={startEdit}>Edit</DropdownItem>
                <DropdownItem
                  leading={<Trash2 className="w-4 h-4" />}
                  onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                  className="text-rose-400 hover:bg-rose-500/10"
                >
                  Delete
                </DropdownItem>
              </Dropdown>
            )}
          </>
        }
      >
        {editing ? (
          <div className="mt-1.5">
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') { setEditing(false); }
              }}
              rows={2}
              maxLength={1000}
              className="w-full bg-[#0E1015] rounded-xl px-3 py-2 text-xs text-slate-200 border border-slate-800/60 outline-none focus:border-primary-500/40 transition-colors resize-none"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <Button variant="primary" size="xs" onClick={saveEdit} loading={savingEdit} disabled={!editText.trim() || editText.trim() === comment.content}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => setEditing(false)} disabled={savingEdit}>Cancel</Button>
            </div>
          </div>
        ) : undefined}
      </CommentCard>

      {/* Reply input */}
      {replyOpen && (
        <div className="flex gap-2 mt-2 ml-9">
          <input
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
            placeholder={`Reply to ${name}…`}
            maxLength={1000}
            className="flex-1 bg-[#111318] rounded-xl px-3 py-1.5 text-xs text-slate-200 border border-slate-800/60 outline-none focus:border-primary-500/40 transition-colors placeholder:text-slate-600"
          />
          <Button variant="primary" size="none" shape="lg" onClick={submitReply} disabled={!replyText.trim() || submitting} className="p-1.5 disabled:opacity-40 flex-shrink-0">
            {submitting ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Send className="w-3 h-3 text-white" />}
          </Button>
        </div>
      )}

      {/* Nested replies — one shows statically; the rest reveal on the toggle,
          mirroring the post's comment button. */}
      {replyCount > 0 && (
        <div className="mt-2">
          {shownReplies.map((reply, i, arr) => (
            <ThreadChild key={reply.id} isLast={i === arr.length - 1}>
              <CommentRow
                comment={reply}
                onReply={onReply}
                onVote={onVote}
                onEdit={onEdit}
                onCommentDelete={onCommentDelete}
                viewerUsername={viewerUsername}
                depth={depth + 1}
              />
            </ThreadChild>
          ))}

          {/* View / hide the remaining replies */}
          {replyCount > 1 && (
            <Button
              variant="unstyled"
              onClick={() => setRepliesExpanded((v) => !v)}
              aria-expanded={repliesExpanded}
              className="ml-5 mt-1 text-[10px] font-semibold text-slate-500 hover:text-sky-400 transition-colors py-1"
            >
              {repliesExpanded
                ? 'Hide replies'
                : `View ${replyCount - 1} ${replyCount - 1 === 1 ? 'reply' : 'replies'}`}
            </Button>
          )}

          {/* Pager within the expanded list, for long reply chains */}
          {repliesExpanded && replyCount > visibleReplies && (
            <Button
              variant="unstyled"
              onClick={() => setVisibleReplies((v) => v + REPLIES_PAGE_SIZE)}
              className="ml-5 text-[10px] font-semibold text-slate-500 hover:text-sky-400 transition-colors py-1"
            >
              Show {Math.min(REPLIES_PAGE_SIZE, replyCount - visibleReplies)} more replies
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={confirmAndDelete}
        loading={deleting}
        title="Delete this comment?"
        description={
          comment.replies && comment.replies.length > 0
            ? 'This also removes all replies underneath it. This can\'t be undone.'
            : 'This permanently removes your comment. This can\'t be undone.'
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
