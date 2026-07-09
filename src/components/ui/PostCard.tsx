'use client';

import React, { useState, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { gsap } from '@/lib/gsap';
import {
  Heart, MessageCircle, Trash2,
  ArrowBigUp, Pencil, Bookmark, BookmarkCheck,
  HelpCircle, Trophy, CheckCircle2, Hash, Repeat2, MessageSquareQuote,
  Globe, Users, Lock, MoreHorizontal, Flag,
} from 'lucide-react';
// Sibling Kit primitives — imported directly (not via the './index' barrel) so
// this component, which the barrel itself re-exports, never imports the barrel.
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { ShareButton } from './ShareButton';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { Dropdown } from './Dropdown';
import { PostComposer } from './PostComposer';
import { PostImageGrid, postImages } from './PostImageGrid';
import { usePostActions } from './usePostActions';
import { reportPostRequest } from './PostCard.services';
// Feature-owned domain types still live with the home feed; the card is a
// data-coupled Kit member (it talks to /api/posts) by design — see README §Kit.
import {
  displayName, relativeTime, type CurrentUser, type MentionUser, type Comment, type Post,
} from '@/app/(dashboard)/home/shared';

// Compact count formatter for the action bar (1.2K / 107K / 3.4M), Instagram-
// style. Defined once at module scope so it isn't rebuilt on every card render.
const compactCount = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// Twitter-style boost label for a plain-reposted original ("<name> reposted" /
// "<a> and <b> reposted" / "<a> and N others reposted").
function repostedByLabel(rb: NonNullable<Post['reposted_by']>): string {
  const names = rb.users.map((u) => displayName(u));
  if (rb.total <= 1) return `${names[0] ?? 'Someone'} reposted`;
  if (rb.total === 2) return `${names[0]} and ${names[1] ?? 'someone'} reposted`;
  return `${names[0]} and ${rb.total - 1} others reposted`;
}

// ── Post card ─────────────────────────────────────────────────
// Shared between the home feed and the /saved page (and any future feed-style
// list). memo'd so composer keystrokes (and other host-page state churn) don't
// re-render every mounted card — only cards whose own props actually change
// re-render. Relies on `onDelete`/`onEdited` being stable useCallbacks in the host.
export const PostCard = memo(function PostCard({ post, isOwn, onDelete, onEdited, onUnbookmark, onReposted, currentUser, friends, observe, demo }: {
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
  observe: (el: HTMLElement | null, postId: number, alsoMark?: number[]) => void;
  /** Showcase mode (the /ui-kit page). Keeps every interaction optimistic but
   *  skips the /api/posts mutations (like/bookmark/repost/delete) so the
   *  data-free reference page can render a fully live-feeling card. */
  demo?: boolean;
}) {
  const name = displayName(post);
  const { toast } = useToast();

  const router = useRouter();
  // Purely-visual interaction state stays here; the data mutations + optimistic
  // counters live in usePostActions (wired up after repostTargetId below).
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [postDeleting, setPostDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const heartIconRef = useRef<SVGSVGElement>(null);

  // ── Repost shape ──────────────────────────────────────────────
  // repost_of: undefined ⇒ this is an ordinary post; an object ⇒ a repost of a
  // live original; null ⇒ a repost whose original was deleted (tombstone, F2.6).
  const isRepost = post.repost_of !== undefined;
  const original = post.repost_of ?? null;
  // A quote carries the reposter's comment; a plain repost has empty content.
  const quoteText = (post.content_html || '').trim();
  // Whether a normal post has any caption text (image-only posts skip the text
  // block so the full-bleed image sits flush under the header, IG-style).
  const hasBody = quoteText.length > 0;
  // Repostable only when the effective root is public (F2.4): a normal card uses
  // its own visibility; a repost card targets its (always-public) live original.
  const canRepost = isRepost ? !!original : post.visibility === 'public';
  // Reposting a repost collapses to the root — send the original's id when this
  // card is itself a repost, else the post's own id (the service also collapses).
  const repostTargetId = isRepost && original ? original.id : post.id;

  // Optimistic like / bookmark / repost state + network mutations.
  const {
    liked, likeCount, bookmarked, reposted, repostCount,
    toggleLike, toggleBookmark, togglePlainRepost, deletePost,
  } = usePostActions({ post, demo, repostTargetId, onUnbookmark });

  // Register this card's outer node with the feed-wide seen-tracker (read receipt
  // on viewport dwell). Stable per card so memo isn't invalidated each render.
  const seenRef = useCallback((el: HTMLElement | null) => observe(el, post.id, post.repost_seen_ids), [observe, post.id, post.repost_seen_ids]);

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

  // Delete — reached through the 3-dot menu, confirmed in a ConfirmDialog
  // (destructive + irreversible, so a real confirm rather than one-click).
  const handleConfirmedDelete = async () => {
    setPostDeleting(true);
    try {
      await deletePost();   // network (no-op in demo); throws on failure
      setConfirmDeleteOpen(false);
      onDelete(post.id);    // unmount the row
      toast({ variant: 'success', title: 'Post deleted', description: 'Your post has been removed from the feed.' });
    } catch {
      toast({ variant: 'error', title: "Couldn't delete", description: 'Something went wrong. Please try again.' });
    } finally {
      setPostDeleting(false);
    }
  };

  // Report — the 3-dot action on someone else's post. Fire-and-acknowledge;
  // the server dedupes repeat reports silently.
  const handleReport = async () => {
    if (demo) {
      toast({ variant: 'success', title: 'Report received', description: 'Thanks — our team will take a look. (Demo: nothing was sent.)' });
      return;
    }
    try {
      await reportPostRequest(post.id);
      toast({ variant: 'success', title: 'Report received', description: 'Thanks — our team will take a look.' });
    } catch (err) {
      toast({ variant: 'error', title: "Couldn't report", description: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
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

  // The quote target is the live original (its own card when this IS a repost,
  // else this post). Tombstoned reposts (no original) can't be quoted.
  const quoteOriginal = isRepost ? original : post;

  return (
    <div
      ref={seenRef}
      id={`post-${post.id}`}
      data-entrance="card"
      // Lift above sibling cards while the repost or 3-dot menu is open so its
      // dropdown panel (which overflows the card's edge) isn't painted over by
      // the next post in the feed.
      className={`post-item relative ${repostMenuOpen || menuOpen ? 'z-30' : ''}`}
    >
      {/* ─── Twitter-style boost label: this original was plain-reposted by one or
          more users (the plain repost itself never renders as a card). ─── */}
      {post.reposted_by && (
        <div className="flex items-center gap-1.5 px-4 pb-1.5 text-[11px] font-semibold text-slate-500">
          <Repeat2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{repostedByLabel(post.reposted_by)}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: POST CARD — MAIN GLASS CARD
          Contains: header (author + 3-dot menu), content, action bar
          ────────────────────────────────────────────────────────── */}
      <div className="relative z-[3] bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-3xl shadow-apple-lg">
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

        {/* ─── Delete confirmation (own posts, via the 3-dot menu) ─── */}
        {isOwn && (
          <ConfirmDialog
            isOpen={confirmDeleteOpen}
            loading={postDeleting}
            onClose={() => setConfirmDeleteOpen(false)}
            onConfirm={handleConfirmedDelete}
            title="Delete this post?"
            description="It will be removed from the feed for everyone. This can't be undone."
            confirmLabel="Delete"
          />
        )}

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: EDIT POST MODAL
            Contains: Kit Modal hosting PostComposer in edit mode (text + image
            + visibility); patches the card in place on save via onEdited
            ────────────────────────────────────────────────────────── */}
        {isOwn && editOpen && (
          <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit post" size="xl" fullWidthMobile entrance="rise" surface="glass">
            <PostComposer
              bare
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
          <Modal isOpen={quoteOpen} onClose={() => setQuoteOpen(false)} title="Repost with comment" size="xl" fullWidthMobile entrance="rise" surface="glass">
            <PostComposer
              bare
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

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: POST HEADER (Instagram-style)
            Contains: story-ring avatar, name + verified check, secondary line
            (@user · audience · time), 3-dot menu (own → Edit/Delete, other → Report)
            ────────────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 pb-3">
          <div className="flex items-center gap-3">
            {/* Borderless avatar — plain circular photo, subtle hover scale. */}
            <Link href={`/u/${post.username}`} className="flex-shrink-0 group">
              <Image
                src={post.avatar || '/Assets/Img/default-avatar.png'}
                alt={name}
                width={44}
                height={44}
                className="w-11 h-11 rounded-full object-cover transition-transform group-hover:scale-[1.03]"
              />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/u/${post.username}`}
                  className="text-sm font-bold text-white hover:text-primary-400 hover:underline transition-colors truncate"
                >
                  {name}
                </Link>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                <Link href={`/u/${post.username}`} className="hover:text-slate-300 transition-colors truncate">
                  @{post.username}
                </Link>
                <span className="text-slate-700">·</span>
                <VisibilityBadge visibility={post.visibility} />
                <span className="text-slate-700">·</span>
                <span className="text-slate-600 flex-shrink-0">{relativeTime(post.created_at)}</span>
              </div>
            </div>

            {/* 3-dot actions — every viewer gets the same affordance: the owner
                manages the post (Edit / Delete), everyone else can Report it. */}
            <Dropdown
              mode="menu"
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              align="right"
              dropdownClassName="min-w-[11rem] p-1.5 space-y-0.5"
              trigger={
                <Button
                  variant="unstyled"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Post options"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex-shrink-0 p-2 -mr-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 active:scale-90 transition-all"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              }
            >
              {isOwn ? (
                <>
                  <Dropdown.Item
                    leading={<Pencil className="w-4 h-4" />}
                    onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                  >
                    Edit post
                  </Dropdown.Item>
                  <Dropdown.Item
                    leading={<Trash2 className="w-4 h-4" />}
                    onClick={() => { setMenuOpen(false); setConfirmDeleteOpen(true); }}
                    className="text-rose-400 hover:bg-rose-500/10"
                  >
                    Delete post
                  </Dropdown.Item>
                </>
              ) : (
                <Dropdown.Item
                  leading={<Flag className="w-4 h-4" />}
                  onClick={() => { setMenuOpen(false); handleReport(); }}
                >
                  Report post
                </Dropdown.Item>
              )}
            </Dropdown>
          </div>
        </div>

        {/* ─── Type badges (ask / win) — icon + label, never colour alone (HIG) ─── */}
        {(isAsk || isWin) && (
          <div className="px-4 sm:px-5 pb-2.5 flex items-center gap-1.5 flex-wrap">
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

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: POST BODY + MEDIA (full-width)
            Contains: caption text (px-padded), full-bleed image, repost embed
            ──────────────────────────────────────────────────────────
            IG-style: the caption spans the full card width (not indented under
            the avatar) and the image is full-bleed edge-to-edge, sitting flush
            above the action bar. */}
        {isRepost ? (
          <>
            {/* A quote carries the reposter's own comment and/or image above the
                embedded original (which is shown as text only). */}
            {quoteText && (
              <div
                className="px-4 sm:px-5 pb-3 text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]"
                dangerouslySetInnerHTML={{ __html: post.content_html }}
              />
            )}
            <CardMedia images={postImages(post)} />
            <div className="px-4 sm:px-5 pt-3 pb-4">
              {original ? <NestedOriginal original={original} /> : <RepostTombstone />}
            </div>
          </>
        ) : (
          <>
            {hasBody && (
              <div
                className="px-4 sm:px-5 pb-3 text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]"
                dangerouslySetInnerHTML={{ __html: post.content_html }}
              />
            )}
            <CardMedia images={postImages(post)} />
          </>
        )}

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: POST ACTION BAR — ALWAYS-ON FOOTER
            Contains: Like + Comments (left group), Share (right)
            ──────────────────────────────────────────────────────────
            Full-bleed solid shelf pinned to the card's base. Always
            visible (no hover reveal): a real toolbar, not a floating
            pill. Opaque `surface-dark` fill — no backdrop-blur, since a
            blur behind an opaque layer is invisible work (perf). */}
        <div className="relative flex items-center justify-between rounded-b-3xl border-t border-white/[0.07] bg-surface-dark px-3 sm:px-4 py-2.5">
          {/* Top-edge highlight — light from above on the solid shelf */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />

          {/* Left group: Like + Comments */}
          <div className="flex items-center gap-4 sm:gap-5">
            <Tooltip content={liked ? 'Unlike' : 'Like'}>
              <Button
                variant="unstyled"
                onClick={handleLike}
                aria-label={liked ? 'Unlike post' : 'Like post'}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <Heart ref={heartIconRef} className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} />
                {likeCount > 0 && <span>{compactCount.format(likeCount)}</span>}
              </Button>
            </Tooltip>

            <Tooltip content="View comments">
              <Button
                variant="unstyled"
                onClick={() => router.push(`/p/${post.public_id}`)}
                aria-label="View comments on post"
                className="flex items-center gap-1.5 text-xs font-semibold transition-colors text-slate-400 hover:text-sky-400"
              >
                <MessageCircle className="w-5 h-5" />
                {post.comment_count > 0 && <span>{compactCount.format(post.comment_count)}</span>}
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
                      <Repeat2 className="w-5 h-5" />
                      {repostCount > 0 && <span>{compactCount.format(repostCount)}</span>}
                    </Button>
                  </Tooltip>
                }
              >
                <Dropdown.Item
                  leading={<Repeat2 className="w-4 h-4" />}
                  onClick={() => { setRepostMenuOpen(false); togglePlainRepost(); }}
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
          <div className="flex items-center gap-4 sm:gap-5">
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
                {bookmarked ? <BookmarkCheck className="w-5 h-5" fill="currentColor" /> : <Bookmark className="w-5 h-5" />}
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

// ── Card media ────────────────────────────────────────────────
// A post's attached image(s) under the header, flush above the action bar. A
// lone image stays full-bleed edge-to-edge (Instagram-style); two or three sit
// in a padded, rounded strip (so the gallery reads as a deliberate group, not a
// broken full-bleed crop). Renders nothing for an image-less post.
function CardMedia({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  if (images.length === 1) return <PostImageGrid images={images} single="bleed" />;
  return (
    <div className="px-4 sm:px-5 pb-1">
      <PostImageGrid images={images} />
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
        className="w-7 h-7 rounded-lg object-cover flex-shrink-0 mt-0.5"
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
          className="w-7 h-7 rounded-lg object-cover"
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
