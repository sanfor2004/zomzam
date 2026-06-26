'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { gsap } from '@/lib/gsap';
import {
  Loader2, Heart, MessageCircle, Trash2,
  Check, ArrowBigUp, Pencil, Bookmark, BookmarkCheck,
  HelpCircle, Trophy, CheckCircle2, Hash, Repeat2, MessageSquareQuote,
  Globe, Users, Lock,
} from 'lucide-react';
import { Button, Tooltip, ShareButton, useToast, Modal, Dropdown } from '@/components/ui';
import { FollowButton } from '@/components/social/FollowButton';
import { PostComposer } from './PostComposer';
import {
  displayName, relativeTime, type CurrentUser, type MentionUser, type Comment, type Post,
} from './shared';

// ── Post card ─────────────────────────────────────────────────
// Shared between the home feed and the /saved page (and any future feed-style
// list). memo'd so composer keystrokes (and other host-page state churn) don't
// re-render every mounted card — only cards whose own props actually change
// re-render. Relies on `onDelete`/`onEdited` being stable useCallbacks in the host.
export const PostCard = memo(function PostCard({ post, isOwn, onDelete, onEdited, onUnbookmark, onReposted, currentUser, friends, observe }: {
  post: Post;
  isOwn: boolean;
  onDelete: (id: number) => void;
  onEdited: (post: Post) => void;
  /** Called when the viewer un-bookmarks. The /saved page passes this to drop
   *  the card from the list; the feed omits it (the card stays, icon just empties). */
  onUnbookmark?: (id: number) => void;
  /** Called with the freshly-created repost/quote so the host can prepend it to
   *  the feed (optimistic). Omitted on /saved (a new repost isn't saved). */
  onReposted?: (post: Post) => void;
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
  const [bookmarked, setBookmarked] = useState(!!post.bookmarked_by_me);
  const [reposted, setReposted] = useState(!!post.reposted_by_me);
  const [repostCount, setRepostCount] = useState(post.repost_count ?? 0);
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const heartIconRef = useRef<SVGSVGElement>(null);

  // ── Repost shape ──────────────────────────────────────────────
  // repost_of: undefined ⇒ this is an ordinary post; an object ⇒ a repost of a
  // live original; null ⇒ a repost whose original was deleted (tombstone, F2.6).
  const isRepost = post.repost_of !== undefined;
  const original = post.repost_of ?? null;
  // A quote carries the reposter's comment; a plain repost has empty content.
  const quoteText = (post.content_html || '').trim();
  // Repostable only when the effective root is public (F2.4): a normal card uses
  // its own visibility; a repost card targets its (always-public) live original.
  const canRepost = isRepost ? !!original : post.visibility === 'public';
  // Reposting a repost collapses to the root — send the original's id when this
  // card is itself a repost, else the post's own id (the service also collapses).
  const repostTargetId = isRepost && original ? original.id : post.id;

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

  // Optimistic private bookmark toggle. On the /saved page an un-bookmark drops
  // the card via onUnbookmark; in the feed the icon just empties.
  const toggleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bookmark', post_id: post.id }),
      });
      if (!next) onUnbookmark?.(post.id);
    } catch { /* non-blocking */ }
  };

  // Plain repost toggle (optimistic). A plain repost never enters the home feed
  // (it only boosts the original + shows on the reposter's profile), so there's
  // nothing to prepend — just flip the count/active state on this card.
  const togglePlainRepost = async () => {
    setRepostMenuOpen(false);
    const next = !reposted;
    setReposted(next);
    setRepostCount((c) => Math.max(0, next ? c + 1 : c - 1));
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repost', post_id: repostTargetId }),
      });
      const data = await res.json();
      if (!data.success) {
        setReposted(!next);
        setRepostCount((c) => Math.max(0, next ? c - 1 : c + 1));
      }
    } catch {
      setReposted(!next);
      setRepostCount((c) => Math.max(0, next ? c - 1 : c + 1));
    }
  };

  // The quote target is the live original (its own card when this IS a repost,
  // else this post). Tombstoned reposts (no original) can't be quoted.
  const quoteOriginal = isRepost ? original : post;

  return (
    <div
      ref={seenRef}
      id={`post-${post.id}`}
      data-entrance="card"
      // Lift above sibling cards while the repost menu is open so its dropdown
      // panel (which overflows the card's bottom edge) isn't painted over by the
      // next post in the feed.
      className={`post-item relative ${repostMenuOpen ? 'z-30' : ''}`}
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

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: QUOTE REPOST MODAL
            Contains: Kit Modal hosting PostComposer in `quoting` mode — an
            embedded read-only preview of the original above the editor; submits
            a public quote and prepends it via onReposted
            ────────────────────────────────────────────────────────── */}
        {quoteOpen && quoteOriginal && (
          <Modal isOpen={quoteOpen} onClose={() => setQuoteOpen(false)} title="Repost with comment">
            <PostComposer
              currentUser={currentUser}
              friends={friends}
              onPosted={() => {}}
              quoting={{
                original: quoteOriginal,
                onPosted: (created) => { onReposted?.(created); setQuoteOpen(false); },
              }}
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
                <VisibilityBadge visibility={post.visibility} />
                {isOwn ? (
                  <span className="text-xs text-slate-600 flex-shrink-0">· {relativeTime(post.created_at)}</span>
                ) : (
                  <>
                    {/* Follow: shown for non-friends only; reflects/​toggles follow
                        state in place. Friends never see it (they already connect). */}
                    {!post.is_friend && (
                      <span className="ml-auto flex items-center gap-2">
                        <FollowButton
                          targetUserId={post.user_id}
                          initialIsFollowing={!!post.is_following}
                          viewerId={currentUser?.id ?? 0}
                        />
                        <span className="text-xs text-slate-600 flex-shrink-0">{relativeTime(post.created_at)}</span>
                      </span>
                    )}
                    {post.is_friend && (
                      <span className="text-xs text-slate-600 ml-auto flex-shrink-0">{relativeTime(post.created_at)}</span>
                    )}
                  </>
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

              {isRepost ? (
                <>
                  {/* A quote carries the reposter's own comment and/or image above
                      the embedded original (which is shown as text only). */}
                  {quoteText && (
                    <div
                      className="mt-2 text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]"
                      dangerouslySetInnerHTML={{ __html: post.content_html }}
                    />
                  )}
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
                  {original ? <NestedOriginal original={original} /> : <RepostTombstone />}
                </>
              ) : (
                <>
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
                </>
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
                onClick={() => router.push(`/p/${post.public_id}`)}
                aria-label="View comments on post"
                className="flex items-center gap-1.5 text-xs font-semibold transition-colors text-slate-400 hover:text-sky-400"
              >
                <MessageCircle className="w-4 h-4" />
                {post.comment_count > 0 && <span>{post.comment_count}</span>}
              </Button>
            </Tooltip>

            {/* Repost — public-only (hidden on friends/exclusive). Opens a small
                menu: instant plain repost (toggle) / repost with a comment. */}
            {canRepost && (
              <Dropdown
                mode="menu"
                open={repostMenuOpen}
                onClose={() => setRepostMenuOpen(false)}
                align="left"
                dropdownClassName="min-w-[15rem] p-1.5 space-y-0.5"
                trigger={
                  <Tooltip content={reposted ? 'Reposted' : 'Repost'}>
                    <Button
                      variant="unstyled"
                      onClick={() => setRepostMenuOpen((o) => !o)}
                      aria-label="Repost"
                      aria-haspopup="menu"
                      aria-expanded={repostMenuOpen}
                      className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                        reposted ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-400'
                      }`}
                    >
                      <Repeat2 className="w-4 h-4" />
                      {repostCount > 0 && <span>{repostCount}</span>}
                    </Button>
                  </Tooltip>
                }
              >
                <Dropdown.Item
                  leading={<Repeat2 className="w-4 h-4" />}
                  onClick={togglePlainRepost}
                >
                  {reposted ? 'Undo repost' : 'Repost'}
                </Dropdown.Item>
                <Dropdown.Item
                  leading={<MessageSquareQuote className="w-4 h-4" />}
                  onClick={() => { setRepostMenuOpen(false); setQuoteOpen(true); }}
                  disabled={!quoteOriginal}
                >
                  Repost with comment
                </Dropdown.Item>
              </Dropdown>
            )}
          </div>

          {/* Right group: Bookmark + Share (icon-only, no counts) */}
          <div className="flex items-center gap-4">
            <Tooltip content={bookmarked ? 'Saved' : 'Save'}>
              <Button
                variant="unstyled"
                onClick={toggleBookmark}
                aria-label={bookmarked ? 'Remove from saved' : 'Save post'}
                aria-pressed={bookmarked}
                className={`flex items-center transition-colors ${
                  bookmarked ? 'text-primary-500' : 'text-slate-400 hover:text-primary-400'
                }`}
              >
                {bookmarked ? <BookmarkCheck className="w-4 h-4" fill="currentColor" /> : <Bookmark className="w-4 h-4" />}
              </Button>
            </Tooltip>

            <ShareButton
              url={`/p/${post.public_id}`}
              shareTitle={`${name} on Zomzam`}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            />
          </div>
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

// ── Nested repost original ────────────────────────────────────
// The embedded card shown inside a repost: the ORIGINAL author's avatar, name,
// type badges, content and image. Rendered as a single Link to the original's
// permalink — deliberately flat (no inner <a>/<button>) so it never nests
// interactive elements, and so the whole block is one tap-to-open target.
function NestedOriginal({ original }: { original: Post }) {
  const name = displayName(original);
  const type = original.type ?? 'status';
  const isAsk = type === 'ask';
  const isWin = type === 'win';
  const isResolved = isAsk && !!original.resolved_at;
  return (
    <Link
      href={`/p/${original.public_id}`}
      className="mt-2.5 block rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-2">
        <Image
          src={original.avatar || '/Assets/Img/default-avatar.png'}
          alt={name}
          width={28}
          height={28}
          className="w-7 h-7 rounded-lg object-cover border border-slate-800"
        />
        <span className="text-xs font-bold text-white truncate">{name}</span>
        <span className="text-[11px] text-slate-500 truncate">@{original.username}</span>
        <span className="text-[11px] text-slate-600 flex-shrink-0">· {relativeTime(original.created_at)}</span>
      </div>

      {(isAsk || isWin) && (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {isAsk && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
              isResolved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-300'
            }`}>
              {isResolved ? <CheckCircle2 className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
              {isResolved ? 'Resolved' : 'Help needed'}
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
        dangerouslySetInnerHTML={{ __html: original.content_html }}
      />
      {/* The original's image is intentionally not shown inside a repost — the
          "<n> images" cue + tap-through to the full post is the path to media. */}
    </Link>
  );
}

// ── Visibility badge ──────────────────────────────────────────
// A small audience signifier next to the byline: globe (public), people
// (friends), lock (exclusive). Icon + accessible label (never colour alone, HIG).
function VisibilityBadge({ visibility }: { visibility?: string }) {
  const v = visibility ?? 'friends';
  const { Icon, label } =
    v === 'public' ? { Icon: Globe, label: 'Public' }
    : v === 'exclusive' ? { Icon: Lock, label: 'Exclusive' }
    : { Icon: Users, label: 'Friends' };
  return (
    <span className="inline-flex items-center text-slate-600" title={label} aria-label={`Audience: ${label}`}>
      <Icon className="w-3 h-3" />
    </span>
  );
}

// ── Tombstone for a deleted original ──────────────────────────
// A repost whose original was deleted keeps the reposter's words but shows this
// quiet placeholder where the embedded post used to be (F2.6 — reposts survive).
function RepostTombstone() {
  return (
    <div className="mt-2.5 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.01] px-3.5 py-4 text-center text-xs text-slate-500">
      This post is no longer available.
    </div>
  );
}
