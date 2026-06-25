'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { gsap, useGSAP, getScrollParent } from '@/lib/gsap';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import {
  Loader2, Heart, MessageCircle, Trash2,
  UserPlus, Check, Users, ArrowBigUp, Pencil,
  MessageSquarePlus, Search, MessagesSquare,
  HelpCircle, Trophy, CheckCircle2, Hash, Sparkles, ArrowUp,
} from 'lucide-react';
import { Button, Tooltip, ShareButton, useToast, Modal, Input } from '@/components/ui';
import { useMessages, type ChatContact } from '@/context/MessagesContext';
import { PostComposer } from './PostComposer';
import {
  displayName, relativeTime, type CurrentUser, type MentionUser, type Comment, type Post,
} from './shared';

interface SuggestedUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  bio?: string | null;
  matching_tags?: string[];
}

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [friends, setFriends] = useState<MentionUser[]>([]);
  const [peopleSuggestions, setPeopleSuggestions] = useState<SuggestedUser[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set());

  // ── Direct messages ─────────────────────────────────────────
  // Messaging now lives in the global MessagesContext (topbar dropdown, ChatDock,
  // presence rail all share it). The /home panel is just another view: it lists
  // existing conversations and opens a docked chat window on click.
  const { contacts, openChat } = useMessages();
  const [messagesSearch, setMessagesSearch] = useState('');

  // ── New-posts pill ──────────────────────────────────────────
  // Live SSE `zz-new-post` signals from people in the network bump this counter;
  // a soft pill offers to refresh instead of yanking the user's scroll position.
  const [newPostsCount, setNewPostsCount] = useState(0);

  const openContactChat = useCallback((c: ChatContact) => {
    openChat(
      {
        id: c.other_id,
        username: c.username,
        first_name: c.first_name,
        last_name: c.last_name,
        avatar: c.avatar,
        online_label: c.online_label,
        is_online: c.is_online,
      },
      c.conversation_id,
    );
  }, [openChat]);

  // Friends we already share a conversation with (already ordered most-recent
  // first by the API), for the /home Messages panel.
  const messageThreads = contacts.filter((c) => c.conversation_id);

  const containerRef = useRef<HTMLDivElement>(null);

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedFilter, setFeedFilter] = useState<'all' | 'help' | 'help_matches'>('all');
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

  // Patch a post in place after an inline edit (content/image/visibility) — no refetch.
  const handlePostEdited = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
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
      const filterParam = feedFilter !== 'all' ? `&filter=${feedFilter}` : '';
      const res = await fetch(`/api/posts?action=feed&offset=${offset}${filterParam}`);
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
  }, [feedFilter]);

  // Reloading from offset 0 happens automatically: changing feedFilter gives
  // loadFeed a new identity, re-firing this effect.
  useEffect(() => { loadFeed(); }, [loadFeed]);

  // ── New-posts pill ──────────────────────────────────────────
  // SSE delivers `zz-new-post` when someone in the network posts. We only count
  // it (a soft signal) so the user's scroll isn't disturbed; clicking the pill
  // reloads the freshest feed from the top and scrolls up.
  useEffect(() => {
    const onNewPost = () => setNewPostsCount((c) => c + 1);
    window.addEventListener('zz-new-post', onNewPost);
    return () => window.removeEventListener('zz-new-post', onNewPost);
  }, []);

  const refreshFeed = useCallback(() => {
    setNewPostsCount(0);
    loadFeed(0);
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loadFeed]);

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
                onClick={refreshFeed}
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
            Contains: Messages panel, My Friends list, Suggested For You
            ────────────────────────────────────────────────────────── */}
        <aside className="hidden lg:block self-start lg:sticky lg:top-0">
          <div className="space-y-4">

            {/* ──────────────────────────────────────────────────────────
                DEVELOPMENT NAVIGATOR: MESSAGES PANEL
                Contains: header + compose button, search, conversation list
                ────────────────────────────────────────────────────────── */}
            <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-5 shadow-apple">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessagesSquare className="w-4 h-4 text-slate-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Messages
                  </h3>
                  {messageThreads.some((c) => c.unread_count > 0) && (
                    <span className="text-[10px] font-bold bg-primary-500 text-white px-1.5 py-0.5 rounded-full">
                      {messageThreads.reduce((sum, c) => sum + c.unread_count, 0)}
                    </span>
                  )}
                </div>
                <Tooltip content="Open Messenger">
                  <Button
                    variant="unstyled"
                    onClick={() => router.push('/messages')}
                    aria-label="Open Messenger"
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-400 hover:bg-white/[0.04] transition-colors"
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                  </Button>
                </Tooltip>
              </div>

              {messageThreads.length > 0 && (
                <Input
                  size="sm"
                  value={messagesSearch}
                  onChange={(e) => setMessagesSearch(e.target.value)}
                  placeholder="Search messages..."
                  leftIcon={<Search className="w-3.5 h-3.5" />}
                  containerClassName="mb-3"
                />
              )}

              {messageThreads.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">
                  No conversations yet — start one from your friends.
                </p>
              ) : (
                <div className="space-y-1 -mx-1.5">
                  {messageThreads
                    .filter((c) => {
                      const q = messagesSearch.trim().toLowerCase();
                      if (!q) return true;
                      return displayName(c).toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
                    })
                    .map((c) => (
                      <button
                        key={c.other_id}
                        onClick={() => openContactChat(c)}
                        className="w-full flex items-center gap-3 text-left rounded-xl px-1.5 py-1.5 hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="relative flex-shrink-0">
                          <Image
                            src={c.avatar || '/Assets/Img/default-avatar.png'}
                            alt={displayName(c)}
                            width={36}
                            height={36}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-800"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1D24] ${
                              c.is_online ? 'bg-emerald-500' : 'bg-slate-600'
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-xs truncate ${c.unread_count > 0 ? 'font-bold text-white' : 'font-semibold text-slate-300'}`}>
                              {displayName(c)}
                            </p>
                            {c.last_message_at && (
                              <span className="text-[10px] text-slate-600 flex-shrink-0">{relativeTime(c.last_message_at)}</span>
                            )}
                          </div>
                          {c.last_message && (
                            <p className={`text-[11px] truncate ${c.unread_count > 0 ? 'text-slate-300 font-medium' : 'text-slate-600'}`}>
                              {c.last_sender_id === currentUser?.id ? 'You: ' : ''}{c.last_message}
                            </p>
                          )}
                        </div>
                        {c.unread_count > 0 && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {c.unread_count}
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>

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

            {/* ──────────────────────────────────────────────────────────
                DEVELOPMENT NAVIGATOR: SUGGESTED FOR YOU
                Contains: header + see-all link, suggested-user rows
                ────────────────────────────────────────────────────────── */}
            {peopleSuggestions.length > 0 && (
              <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-5 shadow-apple">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Suggested For You
                  </h3>
                  <Link
                    href="/community/discover"
                    className="text-[10px] font-bold uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors"
                  >
                    See all
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
// Relies on `onDelete`/`onEdited` being stable useCallbacks in HomePage.
const PostCard = memo(function PostCard({ post, isOwn, onDelete, onEdited, currentUser, friends }: {
  post: Post;
  isOwn: boolean;
  onDelete: (id: number) => void;
  onEdited: (post: Post) => void;
  currentUser: CurrentUser | null;
  friends: MentionUser[];
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

