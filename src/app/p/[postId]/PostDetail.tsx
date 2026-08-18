'use client';
import { Button, Dropdown, ConfirmDialog, Modal, Tooltip, ToastProvider, useToast, PostImageGrid, postImages } from '@/components/ui';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import Link from 'next/link';
import Image from 'next/image';
import {
  Heart, MessageCircle, Send, Loader2, ArrowLeft, Check, HelpCircle, Trophy,
  CheckCircle2, Hash, RotateCcw, Bookmark, BookmarkCheck, Repeat2, Globe, Users, Lock,
  MoreHorizontal, Pencil, Trash2, Flag, ArrowBigUp, ArrowUpDown, MessageSquareQuote,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { SignInPrompt } from '@/components/social/SignInPrompt';
// Shared feed helpers/types — reuse the ONE source of truth instead of
// re-implementing displayName/relativeTime/Post here (they used to drift).
import { displayName, relativeTime, type CurrentUser, type Post as FeedPost } from '@/app/(dashboard)/home/shared';
import {
  acceptAnswerRequest, resolveAskRequest, reopenAskRequest,
  likeRequest, bookmarkRequest, repostRequest, commentRequest,
  commentVoteRequest, editCommentRequest, deleteCommentRequest,
  reportPostRequest, deletePostRequest,
} from './PostDetail.services';

// The composer is the only heavy dependency here and is used ONLY by an owner
// Edit or a signed-in Quote-repost — both deliberate, rare actions. Lazy-load it
// (ssr:false) so anonymous readers and plain scrollers never download its chunk,
// keeping the public permalink light (the reason the feed card owned edit/quote
// before this redesign).
const PostComposer = dynamic(
  () => import('@/components/ui/PostComposer').then((m) => m.PostComposer),
  { ssr: false },
);

interface Post {
  id: number;
  public_id: string;
  user_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content_html: string;
  image_path?: string | null;
  image_paths?: string[] | null;
  visibility?: string;
  type?: 'status' | 'ask' | 'win';
  skill_tag?: string | null;
  accepted_answer_id?: number | null;
  resolved_at?: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  bookmarked_by_me?: boolean;
  is_following?: boolean;
  is_friend?: boolean;
  repost_count?: number;
  reposted_by_me?: boolean;
}

interface Comment {
  id: number;
  post_id: number;
  parent_id: number | null;
  user_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content: string;
  created_at: string;
  upvote_count: number;
  upvoted_by_me: boolean;
  replies?: Comment[];
}

interface ViewerUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
}

type SortMode = 'top' | 'new';

// Build a parent→children tree from the flat list, sorting roots by the chosen
// mode (replies always stay chronological — a thread reads top-to-bottom).
function buildTree(flat: Comment[], sort: SortMode): Comment[] {
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
  roots.sort((a, b) =>
    sort === 'top'
      ? b.upvote_count - a.upvote_count || +new Date(a.created_at) - +new Date(b.created_at)
      : +new Date(b.created_at) - +new Date(a.created_at),
  );
  return roots;
}

// Ids of a comment and its whole reply subtree (for optimistic delete pruning).
function descendantIds(flat: Comment[], rootId: number): number[] {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length) {
    const next = flat.filter((c) => c.parent_id != null && frontier.includes(c.parent_id)).map((c) => c.id);
    if (!next.length) break;
    ids.push(...next);
    frontier = next;
  }
  return ids;
}

export default function PostDetail(props: {
  post: Post;
  initialComments: Comment[];
  viewerId: number | null;
  viewerUser: ViewerUser | null;
}) {
  // Self-contained toasts for delete/report/edit feedback — the public permalink
  // route has no global ToastProvider, so mount one around the inner view.
  return (
    <ToastProvider>
      <PostDetailInner {...props} />
    </ToastProvider>
  );
}

function PostDetailInner({
  post,
  initialComments,
  viewerId,
  viewerUser,
}: {
  post: Post;
  initialComments: Comment[];
  viewerId: number | null;
  viewerUser: ViewerUser | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  usePageEntrance(containerRef);
  const router = useRouter();
  const { toast } = useToast();

  const authorName = displayName(post);

  // ── Hero engagement state ────────────────────────────────────
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [bookmarked, setBookmarked] = useState(!!post.bookmarked_by_me);
  const [reposted, setReposted] = useState(!!post.reposted_by_me);
  const [repostCount, setRepostCount] = useState(post.repost_count ?? 0);
  const [shareCopied, setShareCopied] = useState(false);

  // Editable post surface — content + images + visibility can change in place
  // when the owner edits, without a reload.
  const [contentHtml, setContentHtml] = useState(post.content_html);
  const [imagePaths, setImagePaths] = useState<string[]>(postImages(post));
  const [visibility, setVisibility] = useState<string>(post.visibility ?? 'friends');

  // ── Comments ─────────────────────────────────────────────────
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState<SortMode>('top');
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // ── Modals / prompts ─────────────────────────────────────────
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [postDeleting, setPostDeleting] = useState(false);

  // ── Ask resolution ───────────────────────────────────────────
  const [acceptedId, setAcceptedId] = useState<number | null>(post.accepted_answer_id ?? null);
  const [resolvedAt, setResolvedAt] = useState<string | null>(post.resolved_at ?? null);

  const isOwner = viewerId != null && viewerId === post.user_id;
  const postType = post.type ?? 'status';
  const isAsk = postType === 'ask';
  const isWin = postType === 'win';
  const isResolved = !!resolvedAt;
  const canRepost = visibility === 'public';

  const currentUser: CurrentUser | null = viewerUser
    ? { id: viewerUser.id, username: viewerUser.username, first_name: viewerUser.first_name, last_name: viewerUser.last_name, avatar: viewerUser.avatar }
    : null;

  // Adapt the local post to the feed Post shape the composer expects (edit/quote).
  const asFeedPost = useCallback((): FeedPost => ({
    id: post.id,
    public_id: post.public_id,
    user_id: post.user_id,
    username: post.username,
    first_name: post.first_name,
    last_name: post.last_name,
    avatar: post.avatar,
    content_html: contentHtml,
    image_path: post.image_path ?? null,
    image_paths: imagePaths,
    visibility: visibility as FeedPost['visibility'],
    type: post.type,
    skill_tag: post.skill_tag ?? null,
    accepted_answer_id: acceptedId,
    resolved_at: resolvedAt,
    created_at: post.created_at,
    like_count: likeCount,
    comment_count: comments.length,
    liked_by_me: liked,
    bookmarked_by_me: bookmarked,
    repost_count: repostCount,
    reposted_by_me: reposted,
  }), [post, contentHtml, imagePaths, visibility, acceptedId, resolvedAt, likeCount, comments.length, liked, bookmarked, repostCount, reposted]);

  // Deep-link: #comment-<id> scrolls to + briefly highlights that comment;
  // #respond (or ?compose=1) focuses the composer. Runs once on mount.
  useEffect(() => {
    const hash = window.location.hash;
    const compose = new URLSearchParams(window.location.search).get('compose');
    if (hash.startsWith('#comment-')) {
      const id = Number(hash.replace('#comment-', ''));
      const el = document.getElementById(`comment-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightId(id);
        const t = setTimeout(() => setHighlightId(null), 2600);
        return () => clearTimeout(t);
      }
    } else if (hash === '#respond' || compose) {
      composerRef.current?.focus();
    }
  }, []);

  // ── Ask owner controls (accept / resolve / reopen) ───────────
  const acceptAnswer = async (commentId: number) => {
    if (!isOwner || !isAsk) return;
    try {
      const r = await acceptAnswerRequest(post.id, commentId);
      if (r.success) { setAcceptedId(commentId); setResolvedAt(r.resolvedAt ?? new Date().toISOString()); }
    } catch { /* non-blocking */ }
  };
  const resolveAsk = async () => {
    if (!isOwner || !isAsk) return;
    try {
      const r = await resolveAskRequest(post.id);
      if (r.success) setResolvedAt(r.resolvedAt ?? new Date().toISOString());
    } catch { /* non-blocking */ }
  };
  const reopenAsk = async () => {
    if (!isOwner || !isAsk) return;
    try {
      if (await reopenAskRequest(post.id)) { setAcceptedId(null); setResolvedAt(null); }
    } catch { /* non-blocking */ }
  };

  // ── Hero actions ─────────────────────────────────────────────
  const toggleLike = async () => {
    if (!viewerId) { window.location.href = '/sign'; return; }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => (next ? c + 1 : c - 1));
    try { await likeRequest(post.id); } catch { /* non-blocking */ }
  };
  const toggleBookmark = async () => {
    if (!viewerId) { setSignInOpen(true); return; }
    const next = !bookmarked;
    setBookmarked(next);
    try { await bookmarkRequest(post.id); } catch { setBookmarked(!next); }
  };
  const togglePlainRepost = async () => {
    if (!viewerId) { setSignInOpen(true); return; }
    const next = !reposted;
    setReposted(next);
    setRepostCount((c) => Math.max(0, next ? c + 1 : c - 1));
    let ok = false;
    try { ok = await repostRequest(post.id); } catch { ok = false; }
    if (!ok) { setReposted(!next); setRepostCount((c) => Math.max(0, next ? c - 1 : c + 1)); }
  };
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${authorName} on Zomzam`, url });
      else { await navigator.clipboard.writeText(url); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }
    } catch { /* cancelled */ }
  };
  const handleReport = async () => {
    try {
      await reportPostRequest(post.id);
      toast({ variant: 'success', title: 'Report received', description: 'Thanks — our team will take a look.' });
    } catch {
      toast({ variant: 'error', title: "Couldn't report", description: 'Something went wrong. Please try again.' });
    }
  };
  const handleConfirmedDelete = async () => {
    setPostDeleting(true);
    try {
      const ok = await deletePostRequest(post.id);
      if (!ok) throw new Error('rejected');
      toast({ variant: 'success', title: 'Post deleted', description: 'Redirecting home…' });
      router.push('/home');
    } catch {
      setPostDeleting(false);
      setConfirmDeleteOpen(false);
      toast({ variant: 'error', title: "Couldn't delete", description: 'Something went wrong. Please try again.' });
    }
  };

  // ── Comment mutations (optimistic, roll back on failure) ─────
  const addComment = async (text: string, parentId?: number): Promise<boolean> => {
    if (!viewerId) { window.location.href = '/sign'; return false; }
    try {
      const comment = await commentRequest(post.id, text, parentId);
      if (comment) {
        // The API's create response omits user_id — stamp it from the viewer (the
        // author) so the fresh comment is immediately editable/deletable by them
        // without a reload (the server read path includes user_id on refresh).
        setComments((prev) => [...prev, { ...comment, user_id: viewerId, avatar: comment.avatar || '/Assets/Img/default-avatar.png', upvote_count: 0, upvoted_by_me: false }]);
        return true;
      }
    } catch { /* non-blocking */ }
    return false;
  };
  const submitTopComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await addComment(commentText.trim());
    if (ok) setCommentText('');
    setSubmitting(false);
  };
  const voteComment = async (id: number) => {
    if (!viewerId) { setSignInOpen(true); return; }
    let rollback = false;
    setComments((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const up = !c.upvoted_by_me;
      return { ...c, upvoted_by_me: up, upvote_count: Math.max(0, c.upvote_count + (up ? 1 : -1)) };
    }));
    try { rollback = !(await commentVoteRequest(id)); } catch { rollback = true; }
    if (rollback) {
      setComments((prev) => prev.map((c) => {
        if (c.id !== id) return c;
        const up = !c.upvoted_by_me;
        return { ...c, upvoted_by_me: up, upvote_count: Math.max(0, c.upvote_count + (up ? 1 : -1)) };
      }));
    }
  };
  const editCommentLocal = async (id: number, content: string): Promise<boolean> => {
    const prev = comments;
    setComments((cs) => cs.map((c) => (c.id === id ? { ...c, content } : c)));
    const saved = await editCommentRequest(id, content).catch(() => null);
    if (saved == null) { setComments(prev); toast({ variant: 'error', description: "Couldn't save your edit." }); return false; }
    return true;
  };
  const deleteCommentLocal = async (id: number) => {
    const prev = comments;
    const ids = descendantIds(comments, id);
    setComments((cs) => cs.filter((c) => !ids.includes(c.id)));
    const res = await deleteCommentRequest(id).catch(() => null);
    if (res == null) { setComments(prev); toast({ variant: 'error', description: "Couldn't delete the comment." }); }
  };

  const tree = useMemo(() => buildTree(comments, sort), [comments, sort]);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer && (() => { try { return new URL(document.referrer).origin === window.location.origin; } catch { return false; } })()) {
      router.back();
    } else {
      router.push('/home');
    }
  };

  return (
    <div ref={containerRef} className="space-y-4">

      <SignInPrompt open={signInOpen} onClose={() => setSignInOpen(false)} action="connect with people, save & repost" />

      {/* ── Owner: delete confirm + edit modal, and everyone: quote modal ── */}
      {isOwner && (
        <ConfirmDialog
          isOpen={confirmDeleteOpen}
          loading={postDeleting}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={handleConfirmedDelete}
          title="Delete this post?"
          description="It will be removed for everyone. This can't be undone."
          confirmLabel="Delete"
        />
      )}
      {isOwner && editOpen && (
        <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit post" size="xl" fullWidthMobile entrance="rise" surface="glass">
          <PostComposer
            bare
            currentUser={currentUser}
            friends={[]}
            onPosted={() => {}}
            editing={{
              post: asFeedPost(),
              onSaved: (updated) => {
                setContentHtml(updated.content_html);
                setImagePaths(postImages(updated));
                if (updated.visibility) setVisibility(updated.visibility);
                setEditOpen(false);
                toast({ variant: 'success', description: 'Post updated.' });
              },
            }}
          />
        </Modal>
      )}
      {quoteOpen && (
        <Modal isOpen={quoteOpen} onClose={() => setQuoteOpen(false)} title="Repost with comment" size="xl" fullWidthMobile entrance="rise" surface="glass">
          <PostComposer
            bare
            currentUser={currentUser}
            friends={[]}
            onPosted={() => {}}
            quoting={{
              original: asFeedPost(),
              onPosted: (created) => {
                setQuoteOpen(false);
                toast({ variant: 'success', description: 'Reposted with your comment.' });
                if (created?.public_id) router.push(`/p/${created.public_id}`);
              },
            }}
          />
        </Modal>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: BACK CONTROL (referrer-aware)
          Contains: Back button — returns to the prior in-app page, else /home
          ────────────────────────────────────────────────────────── */}
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-200 active:scale-95 transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: POST HERO (feed glass-card language)
          Contains: author row + ••• menu, type badges, content, media, action bar
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-3xl shadow-apple-lg overflow-hidden">
        {isWin && <span aria-hidden className="win-shine" />}
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Author row */}
        <div className="p-4 sm:p-6 pb-3">
          <div className="flex items-center gap-3">
            <Link href={`/u/${post.username}`} className="flex-shrink-0 group">
              <Image
                src={post.avatar || '/Assets/Img/default-avatar.png'}
                alt={authorName}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover transition-transform group-hover:scale-[1.03]"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/u/${post.username}`} className="text-[15px] font-bold text-white hover:text-primary-400 hover:underline transition-colors truncate block">
                {authorName}
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                <Link href={`/u/${post.username}`} className="hover:text-slate-300 transition-colors truncate">@{post.username}</Link>
                <span className="text-slate-700">·</span>
                <VisibilityBadge visibility={visibility} />
                <span className="text-slate-700">·</span>
                <time className="text-slate-600 flex-shrink-0" dateTime={post.created_at}>{relativeTime(post.created_at)}</time>
              </div>
            </div>

            {/* ••• menu — owner: Edit/Delete; everyone else: Report */}
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
              {isOwner ? (
                <>
                  <Dropdown.Item leading={<Pencil className="w-4 h-4" />} onClick={() => { setMenuOpen(false); setEditOpen(true); }}>
                    Edit post
                  </Dropdown.Item>
                  <Dropdown.Item leading={<Trash2 className="w-4 h-4" />} onClick={() => { setMenuOpen(false); setConfirmDeleteOpen(true); }} className="text-rose-400 hover:bg-rose-500/10">
                    Delete post
                  </Dropdown.Item>
                </>
              ) : (
                <Dropdown.Item leading={<Flag className="w-4 h-4" />} onClick={() => { setMenuOpen(false); handleReport(); }}>
                  Report post
                </Dropdown.Item>
              )}
            </Dropdown>
          </div>
        </div>

        {/* Type badges */}
        {(isAsk || isWin) && (
          <div className="px-4 sm:px-6 pb-2.5 flex items-center gap-1.5 flex-wrap">
            {isAsk && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${isResolved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-300'}`}>
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

        {/* Content */}
        {contentHtml.trim() && (
          <div
            className="px-4 sm:px-6 pb-3 text-[15px] text-slate-200 leading-[1.7] post-content break-words [overflow-wrap:anywhere]"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        )}

        {/* Media — full-bleed single, padded strip for multi (feed language) */}
        {imagePaths.length === 1 ? (
          <PostImageGrid images={imagePaths} single="bleed" alt={`Photo by ${authorName}`} />
        ) : imagePaths.length > 1 ? (
          <div className="px-4 sm:px-6 pb-1"><PostImageGrid images={imagePaths} alt={`Photo by ${authorName}`} /></div>
        ) : null}

        {/* Action bar */}
        <div className="relative mt-1 flex items-center justify-between border-t border-white/[0.07] bg-surface-dark px-3 sm:px-4 py-2.5">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-center gap-4 sm:gap-5">
            <Tooltip content={liked ? 'Unlike' : 'Like'}>
              <Button variant="unstyled" onClick={toggleLike} aria-label={liked ? 'Unlike post' : 'Like post'} className={`flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-95 ${liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'}`}>
                <Heart className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </Button>
            </Tooltip>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <MessageCircle className="w-5 h-5" />
              {comments.length > 0 && <span>{comments.length}</span>}
            </div>

            {canRepost && (
              <Dropdown
                mode="menu"
                open={repostMenuOpen}
                onClose={() => setRepostMenuOpen(false)}
                align="left"
                dropdownClassName="min-w-[15rem] p-1.5 space-y-0.5"
                trigger={
                  <Tooltip content={reposted ? 'Reposted' : 'Repost'}>
                    <Button variant="unstyled" onClick={() => setRepostMenuOpen((o) => !o)} aria-label="Repost" aria-haspopup="menu" aria-expanded={repostMenuOpen} className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${reposted ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-400'}`}>
                      <Repeat2 className="w-5 h-5" />
                      {repostCount > 0 && <span>{repostCount}</span>}
                    </Button>
                  </Tooltip>
                }
              >
                <Dropdown.Item leading={<Repeat2 className="w-4 h-4" />} onClick={() => { setRepostMenuOpen(false); togglePlainRepost(); }}>
                  {reposted ? 'Undo repost' : 'Repost'}
                </Dropdown.Item>
                <Dropdown.Item leading={<MessageSquareQuote className="w-4 h-4" />} onClick={() => { setRepostMenuOpen(false); if (!viewerId) { setSignInOpen(true); return; } setQuoteOpen(true); }}>
                  Repost with comment
                </Dropdown.Item>
              </Dropdown>
            )}
          </div>

          <div className="flex items-center gap-4 sm:gap-5">
            <Tooltip content={bookmarked ? 'Saved' : 'Save'}>
              <Button variant="unstyled" onClick={toggleBookmark} aria-label={bookmarked ? 'Remove from saved' : 'Save post'} aria-pressed={bookmarked} className={`flex items-center transition-colors ${bookmarked ? 'text-primary-500' : 'text-slate-400 hover:text-primary-400'}`}>
                {bookmarked ? <BookmarkCheck className="w-5 h-5" fill="currentColor" /> : <Bookmark className="w-5 h-5" />}
              </Button>
            </Tooltip>
            <Tooltip content={shareCopied ? 'Copied!' : 'Share'}>
              <Button variant="unstyled" onClick={handleShare} aria-label="Share post" className={`flex items-center transition-colors ${shareCopied ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>
                {shareCopied ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: COMMENTS
          Contains: count + sort header, ask owner controls, threaded tree, sticky composer
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-4 sm:p-6 shadow-apple">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold text-white">
            {comments.length === 0
              ? (isAsk ? 'Answers' : 'Comments')
              : `${comments.length} ${isAsk ? (comments.length === 1 ? 'Answer' : 'Answers') : comments.length === 1 ? 'Comment' : 'Comments'}`}
          </h2>

          <div className="flex items-center gap-2">
            {isOwner && isAsk && !isResolved && (
              <Button variant="unstyled" onClick={resolveAsk} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-emerald-400 active:scale-95 transition-all">
                <CheckCircle2 className="w-3.5 h-3.5" /> Solved it myself
              </Button>
            )}
            {isOwner && isAsk && isResolved && (
              <Button variant="unstyled" onClick={reopenAsk} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-sky-400 active:scale-95 transition-all">
                <RotateCcw className="w-3.5 h-3.5" /> Reopen
              </Button>
            )}
            {comments.length > 1 && (
              <Button
                variant="unstyled"
                onClick={() => setSort((s) => (s === 'top' ? 'new' : 'top'))}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white active:scale-95 transition-all bg-white/[0.04] hover:bg-white/[0.08] rounded-full px-2.5 py-1"
                title="Change comment order"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sort === 'top' ? 'Top' : 'Newest'}
              </Button>
            )}
          </div>
        </div>

        {/* Comment tree / empty state */}
        {tree.length > 0 ? (
          <div className="space-y-4">
            {tree.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                depth={0}
                viewerId={viewerId}
                ownUserId={viewerId}
                highlightId={highlightId}
                canAccept={isOwner && isAsk}
                acceptedId={acceptedId}
                onAccept={acceptAnswer}
                onReply={addComment}
                onVote={voteComment}
                onEdit={editCommentLocal}
                onDelete={deleteCommentLocal}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <MessageCircle className="w-8 h-8 mx-auto mb-2.5 text-slate-700" />
            <p className="text-sm font-semibold text-slate-300">{isAsk ? 'No answers yet' : 'No comments yet'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{viewerId ? 'Be the first to reply.' : 'Sign in to join the conversation.'}</p>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: STICKY COMPOSER
          Contains: viewer avatar, auto-grow textarea (Enter=send), send button
          ────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 -mx-4 px-4 pt-3 pb-4 bg-gradient-to-t from-[#111318] via-[#111318]/95 to-transparent">
        <div className="flex items-end gap-2.5 surface-card border border-slate-800/60 rounded-2xl p-2 shadow-apple">
          <Image
            src={viewerUser?.avatar || '/Assets/Img/default-avatar.png'}
            alt=""
            width={36}
            height={36}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0 mb-0.5"
          />
          <textarea
            ref={composerRef}
            value={commentText}
            onChange={(e) => {
              setCommentText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (viewerId) submitTopComment(); else { window.location.href = '/sign'; } }
            }}
            placeholder={viewerId ? (isAsk ? 'Write an answer…' : 'Write a comment…') : 'Sign in to comment…'}
            disabled={!viewerId}
            rows={1}
            maxLength={1000}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 disabled:cursor-not-allowed max-h-[140px]"
          />
          <Button
            variant="unstyled"
            onClick={viewerId ? submitTopComment : () => { window.location.href = '/sign'; }}
            disabled={viewerId ? (!commentText.trim() || submitting) : false}
            aria-label={viewerId ? 'Post comment' : 'Sign in to comment'}
            className="flex-shrink-0 w-9 h-9 mb-0.5 flex items-center justify-center bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white active:scale-90 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Comment row (recursive: upvote, accept, reply, edit, delete, collapse) ──
function CommentRow({
  comment, depth, viewerId, ownUserId, highlightId,
  canAccept = false, acceptedId = null, onAccept,
  onReply, onVote, onEdit, onDelete,
}: {
  comment: Comment;
  depth: number;
  viewerId: number | null;
  ownUserId: number | null;
  highlightId: number | null;
  canAccept?: boolean;
  acceptedId?: number | null;
  onAccept?: (commentId: number) => void;
  onReply: (text: string, parentId?: number) => Promise<boolean>;
  onVote: (commentId: number) => void;
  onEdit: (commentId: number, content: string) => Promise<boolean>;
  onDelete: (commentId: number) => void;
}) {
  const name = displayName(comment);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAnswer = depth === 0;
  const isAccepted = comment.id === acceptedId;
  const isMine = ownUserId != null && ownUserId === comment.user_id;
  const replies = comment.replies ?? [];
  const REPLY_PREVIEW = 3;
  const visibleReplies = showAllReplies ? replies : replies.slice(0, REPLY_PREVIEW);

  const submitReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onReply(replyText.trim(), comment.id);
    if (ok) { setReplyText(''); setReplyOpen(false); }
    setSubmitting(false);
  };
  const saveEdit = async () => {
    if (!editText.trim() || savingEdit) return;
    setSavingEdit(true);
    const ok = await onEdit(comment.id, editText.trim());
    if (ok) setEditing(false);
    setSavingEdit(false);
  };

  return (
    <div
      id={`comment-${comment.id}`}
      data-entrance={depth === 0 ? 'list-item' : undefined}
      className={`scroll-mt-28 ${depth > 0 ? 'ml-5 sm:ml-8 border-l border-slate-800/50 pl-3 sm:pl-4' : ''}`}
    >
      <div className={`flex gap-3 rounded-2xl transition-colors ${highlightId === comment.id ? 'ring-2 ring-primary-500/60 bg-primary-500/[0.06]' : ''}`}>
        <Link href={`/u/${comment.username}`} className="flex-shrink-0 mt-0.5">
          <Image
            src={comment.avatar || '/Assets/Img/default-avatar.png'}
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover hover:opacity-90 transition-opacity"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="bg-[#111318] rounded-2xl border border-white/[0.05] px-3.5 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/u/${comment.username}`} className="text-xs font-bold text-white hover:text-primary-400 transition-colors truncate">{name}</Link>
              <span className="text-[10px] text-slate-600">{relativeTime(comment.created_at)}</span>
              {isAccepted && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Accepted
                </span>
              )}
            </div>

            {editing ? (
              <div className="mt-2">
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  className="w-full resize-none bg-surface-dark rounded-xl px-3 py-2 text-sm text-slate-200 border border-slate-800/60 outline-none focus:border-primary-500/40 transition-colors"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <Button variant="unstyled" onClick={saveEdit} disabled={!editText.trim() || savingEdit} className="px-3 py-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 rounded-lg text-[11px] font-bold text-white active:scale-95 transition-all">
                    {savingEdit ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="unstyled" onClick={() => { setEditing(false); setEditText(comment.content); }} className="text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-300 mt-0.5 leading-relaxed break-words [overflow-wrap:anywhere]">{comment.content}</p>
            )}
          </div>

          {/* Row actions: upvote · reply · (accept) · edit/delete */}
          {!editing && (
            <div className="flex items-center gap-3.5 mt-1.5 px-1">
              <button
                onClick={() => onVote(comment.id)}
                aria-pressed={comment.upvoted_by_me}
                aria-label={comment.upvoted_by_me ? 'Remove upvote' : 'Upvote'}
                className={`inline-flex items-center gap-1 text-[11px] font-bold active:scale-90 transition-all ${comment.upvoted_by_me ? 'text-primary-500' : 'text-slate-500 hover:text-primary-400'}`}
              >
                <ArrowBigUp className="w-4 h-4" fill={comment.upvoted_by_me ? 'currentColor' : 'none'} />
                {comment.upvote_count > 0 && <span className="tabular-nums">{comment.upvote_count}</span>}
              </button>

              {depth < 2 && (
                <button
                  onClick={() => (viewerId ? setReplyOpen((p) => !p) : (window.location.href = '/sign'))}
                  className={`text-[11px] font-semibold transition-colors ${replyOpen ? 'text-sky-400' : 'text-slate-500 hover:text-sky-400'}`}
                >
                  Reply
                </button>
              )}

              {canAccept && isAnswer && !isAccepted && (
                <button onClick={() => onAccept?.(comment.id)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-400 transition-colors">
                  <Check className="w-3 h-3" /> Mark helpful
                </button>
              )}

              {isMine && (
                <>
                  <button onClick={() => { setEditing(true); setEditText(comment.content); }} className="text-[11px] font-semibold text-slate-500 hover:text-slate-200 transition-colors">Edit</button>
                  <button onClick={() => setConfirmDelete(true)} className="text-[11px] font-semibold text-slate-500 hover:text-rose-400 transition-colors">Delete</button>
                </>
              )}

              {replies.length > 0 && (
                <button
                  onClick={() => setCollapsed((c) => !c)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors ml-auto"
                >
                  {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>
          )}

          {/* Inline reply box */}
          {replyOpen && (
            <div className="flex gap-2 mt-2.5">
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
                placeholder={`Reply to ${name}…`}
                maxLength={1000}
                className="flex-1 bg-surface-dark rounded-xl px-3 py-2 text-xs text-slate-200 border border-slate-800/60 outline-none focus:border-primary-500/40 transition-colors placeholder:text-slate-600"
              />
              <Button variant="unstyled" onClick={submitReply} disabled={!replyText.trim() || submitting} aria-label="Post reply" className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-primary-500 hover:bg-primary-600 disabled:opacity-40 rounded-lg text-white active:scale-90 transition-all">
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete for this comment */}
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(comment.id); }}
        title="Delete comment?"
        description={replies.length > 0 ? 'This also removes its replies. This can’t be undone.' : 'This can’t be undone.'}
        confirmLabel="Delete"
      />

      {/* Replies */}
      {!collapsed && replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {visibleReplies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              viewerId={viewerId}
              ownUserId={ownUserId}
              highlightId={highlightId}
              canAccept={false}
              acceptedId={acceptedId}
              onAccept={onAccept}
              onReply={onReply}
              onVote={onVote}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {replies.length > REPLY_PREVIEW && !showAllReplies && (
            <button onClick={() => setShowAllReplies(true)} className="ml-5 sm:ml-8 pl-3 sm:pl-4 text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition-colors">
              Show {replies.length - REPLY_PREVIEW} more {replies.length - REPLY_PREVIEW === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Visibility badge (icon + accessible label, never colour alone) ──
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
