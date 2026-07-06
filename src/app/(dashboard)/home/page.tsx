'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, getScrollParent } from '@/lib/gsap';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { Loader2, MessagesSquare, HelpCircle, ArrowUp } from 'lucide-react';
import { Button, ComposerBanner, PostComposer, PostCard, Modal } from '@/components/ui';
import { useFeed } from './useFeed';
import { fetchCurrentUser, fetchFriends } from './page.services';
import { type CurrentUser, type MentionUser, type Post } from './shared';

export default function HomePage() {
  // Viewer identity — used by the composer (@mentions, edit modal) and cards.
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [friends, setFriends] = useState<MentionUser[]>([]);

  // ── Composer modal ──────────────────────────────────────────
  // The resting banner opens the full composer in a modal.
  // `composerDirty` gates a discard confirm on close.
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDirty, setComposerDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Feed state machine (list, tiers, pagination, sentinel, new-posts pill).
  const {
    posts, feedFilter, setFeedFilter, tier, hasMore, loadingFeed, initialLoading, isDesktop,
    newPostsCount, refreshUnseen, loadMore, observe, bottomRef, feedRef,
    handleDeletePost, handlePostCreated, handlePostEdited,
  } = useFeed();

  // pageRef reuses containerRef (same node, usePageEntrance scope).
  usePageEntrance(containerRef, [posts.length]);

  // ── Data bootstrap ──────────────────────────────────────────
  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser);
    fetchFriends().then(setFriends);
  }, []);

  // ── Composer open/close ─────────────────────────────────────
  const openComposer = useCallback(() => {
    setComposerDirty(false);
    setComposerOpen(true);
  }, []);
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setConfirmDiscard(false);
  }, []);
  // X / Esc / backdrop: confirm first if the draft has unsaved content.
  const requestCloseComposer = useCallback(() => {
    if (composerDirty) setConfirmDiscard(true);
    else setComposerOpen(false);
  }, [composerDirty]);
  // Success: prepend the new post and dismiss the modal.
  const handleComposerPosted = useCallback((post: Post) => {
    handlePostCreated(post);
    setComposerOpen(false);
  }, [handlePostCreated]);

  // ── Bottom-nav "Create" entry points ────────────────────────
  // The mobile bottom bar's center âž• lives in the shell, which can't reach this
  // page's composer state directly. Two signals bridge it: a `?compose=1` param
  // (arriving from another route) read once on mount, and a `zz:open-composer`
  // window event (fired when Create is tapped while already on /home).
  // ponytail: a window CustomEvent is the minimal cross-component signal — no
  // composer state lifted into a context just to open a modal.
  useEffect(() => {
    const open = () => openComposer();
    window.addEventListener('zz:open-composer', open);
    if (new URLSearchParams(window.location.search).get('compose') === '1') {
      openComposer();
      window.history.replaceState({}, '', '/home'); // strip so refresh/back doesn't re-open
    }
    return () => window.removeEventListener('zz:open-composer', open);
  }, [openComposer]);

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
          Contains: Composer banner, post feed with infinite scroll. The social
          right sidebar (Messages / Active Now / Suggested) now lives globally
          in the dashboard shell (RightSidebar), not per-page here.
          ────────────────────────────────────────────────────────── */}
      <div>
        <div ref={feedRef} className="space-y-4">

          <ComposerBanner avatarSrc={currentUser?.avatar} onOpen={openComposer} />

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: FEED FILTER (All · Help requests)
              Contains: segmented feed scope selector (drives ?filter=)
              ────────────────────────────────────────────────────────── */}
          <div role="tablist" aria-label="Feed filter" className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1">
            {([
              { value: 'all', label: 'All', icon: MessagesSquare },
              { value: 'help', label: 'Help requests', icon: HelpCircle },
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
                  <span>{label}</span>
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
            <div className="surface-card border border-dashed border-slate-800/60 rounded-3xl p-10 text-center">
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: COMPOSER MODAL
          Contains: the full PostComposer (bare) hosted in an xl modal —
          full-width content-height card on mobile — opened from the banner;
          soft rise-in motion; no X (backdrop click / Escape dismisses);
          closing a dirty draft routes through the discard confirm
          ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={composerOpen}
        onClose={requestCloseComposer}
        size="xl"
        fullWidthMobile
        entrance="rise"
        surface="glass"
        showClose={false}
      >
        <PostComposer
          bare
          currentUser={currentUser}
          friends={friends}
          onPosted={handleComposerPosted}
          onDirtyChange={setComposerDirty}
        />
      </Modal>

      {/* Discard-draft confirmation — only reached when closing a dirty composer. */}
      <Modal
        isOpen={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        variant="danger"
        title="Discard this post?"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button variant="danger" fullWidth onClick={closeComposer}>Discard</Button>
          </>
        }
      >
        <p>Your draft will be lost. This can&rsquo;t be undone.</p>
      </Modal>
    </div>
  );
}
