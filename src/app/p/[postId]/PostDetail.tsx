'use client';
import { Button } from '@/components/ui';

import React, { useRef, useState } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageCircle, Share2, Send, Loader2, ArrowLeft, Check, HelpCircle, Trophy, CheckCircle2, Hash, RotateCcw } from 'lucide-react';

interface Post {
  id: number;
  user_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content_html: string;
  image_path?: string | null;
  type?: 'status' | 'ask' | 'win';
  skill_tag?: string | null;
  accepted_answer_id?: number | null;
  resolved_at?: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

interface Comment {
  id: number;
  post_id: number;
  parent_id: number | null;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content: string;
  created_at: string;
  replies?: Comment[];
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
  return roots;
}

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayName(u: { first_name: string | null; last_name: string | null; username: string }) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
}

export default function PostDetail({
  post,
  initialComments,
  viewerId,
}: {
  post: Post;
  initialComments: Comment[];
  viewerId: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  usePageEntrance(containerRef);
  const authorName = displayName(post);
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Favor economy: ask resolution state is mutable here (owner accepts/resolves).
  const [acceptedId, setAcceptedId] = useState<number | null>(post.accepted_answer_id ?? null);
  const [resolvedAt, setResolvedAt] = useState<string | null>(post.resolved_at ?? null);
  const isOwner = viewerId != null && viewerId === post.user_id;
  const postType = post.type ?? 'status';
  const isAsk = postType === 'ask';
  const isWin = postType === 'win';
  const isResolved = !!resolvedAt;

  // Owner accepts one answer → resolves the ask + logs the helpful event server-side.
  // Re-markable: accepting a different answer just moves the pointer.
  const acceptAnswer = async (commentId: number) => {
    if (!isOwner || !isAsk) return;
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept_answer', post_id: post.id, comment_id: commentId }),
      });
      const data = await res.json();
      if (data.success) {
        setAcceptedId(commentId);
        setResolvedAt(data.resolvedAt ?? new Date().toISOString());
      }
    } catch { /* non-blocking */ }
  };

  // Owner resolves without accepting ("solved it myself").
  const resolveAsk = async () => {
    if (!isOwner || !isAsk) return;
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_ask', post_id: post.id }),
      });
      const data = await res.json();
      if (data.success) setResolvedAt(data.resolvedAt ?? new Date().toISOString());
    } catch { /* non-blocking */ }
  };

  // Owner reopens a resolved ask → back to "Help needed"; drops the accepted
  // answer and deletes the helpful-event server-side. The reversible undo, so no
  // confirm step (CLAUDE.md: Undo > Confirm).
  const reopenAsk = async () => {
    if (!isOwner || !isAsk) return;
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen_ask', post_id: post.id }),
      });
      const data = await res.json();
      if (data.success) { setAcceptedId(null); setResolvedAt(null); }
    } catch { /* non-blocking */ }
  };

  const toggleLike = async () => {
    if (!viewerId) { window.location.href = '/sign'; return; }
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', post_id: post.id }),
      });
    } catch { /* non-blocking */ }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${authorName} on Zomzam`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch { /* cancelled */ }
  };

  const addComment = async (text: string, parentId?: number): Promise<boolean> => {
    if (!viewerId) { window.location.href = '/sign'; return false; }
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', post_id: post.id, content: text, parent_id: parentId ?? null }),
      });
      const data = await res.json();
      if (data.success) {
        const normalized = { ...data.comment, avatar: data.comment.avatar || '/Assets/Img/default-avatar.png' };
        setComments((prev) => [...prev, normalized]);
        return true;
      }
    } catch { /* non-blocking */ }
    return false;
  };

  const submitTopComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await addComment(commentText);
    if (ok) setCommentText('');
    setSubmitting(false);
  };

  const tree = buildTree(comments);

  return (
    <div ref={containerRef} className="space-y-5">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: BREADCRUMB
          Contains: Back link to author profile
          ────────────────────────────────────────────────────────── */}
      <Link
        href={`/u/${post.username}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        @{post.username}&apos;s profile
      </Link>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: POST CARD
          Contains: Author row, post content, like/comment/share actions
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-7 shadow-apple">

        {/* Author row */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800/40 mb-6">
          <Link href={`/u/${post.username}`} className="flex-shrink-0 group">
            <Image
              src={post.avatar || '/Assets/Img/default-avatar.png'}
              alt={authorName}
              width={48}
              height={48}
              className="w-12 h-12 rounded-2xl object-cover border border-slate-800 group-hover:border-primary-500/40 transition-colors"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              href={`/u/${post.username}`}
              className="text-base font-black text-white hover:text-primary-500 transition-colors block"
            >
              {authorName}
            </Link>
            <p className="text-xs text-primary-500 font-bold">@{post.username}</p>
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
          </div>
          <time className="text-xs text-slate-500 flex-shrink-0 tabular-nums">
            {new Date(post.created_at).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
        </div>

        {/* Post content */}
        <div
          className="text-[15px] text-slate-200 leading-[1.75] post-content break-words [overflow-wrap:anywhere]"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />

        {post.image_path && (
          <Image
            src={post.image_path}
            alt=""
            width={1200}
            height={800}
            priority
            sizes="(max-width: 800px) calc(100vw - 2rem), 736px"
            className="mt-4 w-full max-h-[32rem] object-cover rounded-2xl border border-white/[0.06]"
          />
        )}

        {/* Action bar */}
        <div className="flex items-center gap-6 mt-6 pt-5 border-t border-slate-800/40">
          <Button variant="unstyled"
            onClick={toggleLike}
            className={`flex items-center gap-2 text-sm font-semibold transition-all active:scale-95 ${
              liked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-400'
            }`}
          >
            <Heart className="w-[18px] h-[18px]" fill={liked ? 'currentColor' : 'none'} />
            <span>
              {likeCount > 0 ? likeCount : ''}{' '}
              {likeCount === 1 ? 'Like' : likeCount > 1 ? 'Likes' : 'Like'}
            </span>
          </Button>

          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <MessageCircle className="w-[18px] h-[18px]" />
            <span>
              {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </span>
          </div>

          <Button variant="unstyled"
            onClick={handleShare}
            className={`flex items-center gap-2 text-sm font-semibold transition-colors ml-auto ${
              shareCopied ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'
            }`}
          >
            {shareCopied ? <Check className="w-[18px] h-[18px]" /> : <Share2 className="w-[18px] h-[18px]" />}
            {shareCopied ? 'Copied!' : 'Share'}
          </Button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: COMMENTS SECTION
          Contains: Comment count header, comment input, threaded comment tree
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-7 shadow-apple space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {comments.length === 0
              ? (isAsk ? 'No answers yet' : 'No comments yet')
              : `${comments.length} ${isAsk ? (comments.length === 1 ? 'Answer' : 'Answers') : comments.length === 1 ? 'Comment' : 'Comments'}`}
          </h2>
          {isOwner && isAsk && !isResolved && (
            <Button
              variant="unstyled"
              onClick={resolveAsk}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> I solved it myself
            </Button>
          )}
          {isOwner && isAsk && isResolved && (
            <Button
              variant="unstyled"
              onClick={reopenAsk}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-sky-400 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reopen
            </Button>
          )}
        </div>

        {/* Comment input */}
        <div className="flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTopComment(); }
            }}
            placeholder={viewerId ? 'Write a comment…' : 'Sign in to comment…'}
            disabled={!viewerId}
            maxLength={1000}
            className="flex-1 bg-[#111318] rounded-xl px-4 py-2.5 text-sm text-slate-200 border border-slate-800/60 outline-none focus:border-primary-500/40 transition-colors placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button variant="unstyled"
            onClick={viewerId ? submitTopComment : () => { window.location.href = '/sign'; }}
            disabled={viewerId ? (!commentText.trim() || submitting) : false}
            className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex-shrink-0 flex items-center gap-2 text-sm font-bold text-white"
          >
            {submitting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            {!viewerId && 'Sign in'}
          </Button>
        </div>

        {/* Comment tree */}
        {tree.length > 0 && (
          <div className="space-y-4 pt-1">
            {tree.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                onReply={addComment}
                depth={0}
                viewerId={viewerId}
                canAccept={isOwner && isAsk}
                acceptedId={acceptedId}
                onAccept={acceptAnswer}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Comment row (recursive — supports reply threads) ──────────
function CommentRow({
  comment,
  onReply,
  depth,
  viewerId,
  canAccept = false,
  acceptedId = null,
  onAccept,
}: {
  comment: Comment;
  onReply: (text: string, parentId?: number) => Promise<boolean>;
  depth: number;
  viewerId: number | null;
  canAccept?: boolean;
  acceptedId?: number | null;
  onAccept?: (commentId: number) => void;
}) {
  const name = displayName(comment);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Only root comments (depth 0) are answers an asker can accept.
  const isAnswer = depth === 0;
  const isAccepted = comment.id === acceptedId;

  const submitReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onReply(replyText, comment.id);
    if (ok) { setReplyText(''); setReplyOpen(false); }
    setSubmitting(false);
  };

  return (
    <div data-entrance={depth === 0 ? 'list-item' : undefined} className={depth > 0 ? 'ml-8 border-l border-slate-800/50 pl-4' : ''}>
      <div className="flex gap-3">
        <Link href={`/u/${comment.username}`} className="flex-shrink-0 mt-0.5">
          <Image
            src={comment.avatar || '/Assets/Img/default-avatar.png'}
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-xl object-cover border border-slate-800 hover:border-primary-500/30 transition-colors"
          />
        </Link>
        <div className="flex-1 min-w-0 bg-[#111318] rounded-2xl px-4 py-3">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <Link
              href={`/u/${comment.username}`}
              className="text-xs font-bold text-white hover:text-primary-500 transition-colors"
            >
              {name}
            </Link>
            <span className="text-[10px] text-slate-600">{relativeTime(comment.created_at)}</span>
            {isAccepted && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> Accepted
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              {canAccept && isAnswer && !isAccepted && (
                <Button
                  variant="unstyled"
                  onClick={() => onAccept?.(comment.id)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  <Check className="w-3 h-3" /> Mark helpful
                </Button>
              )}
              {depth < 2 && (
                <Button variant="unstyled"
                  onClick={() =>
                    viewerId ? setReplyOpen((p) => !p) : (window.location.href = '/sign')
                  }
                  className={`text-[10px] font-semibold transition-colors ${
                    replyOpen ? 'text-sky-400' : 'text-slate-500 hover:text-sky-400'
                  }`}
                >
                  Reply
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]">{comment.content}</p>
        </div>
      </div>

      {replyOpen && (
        <div className="flex gap-2 mt-2 ml-11">
          <input
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); }
            }}
            placeholder={`Reply to ${name}…`}
            maxLength={1000}
            className="flex-1 bg-[#111318] rounded-xl px-3 py-2 text-xs text-slate-200 border border-slate-800/60 outline-none focus:border-primary-500/40 transition-colors placeholder:text-slate-600"
          />
          <Button variant="unstyled"
            onClick={submitReply}
            disabled={!replyText.trim() || submitting}
            className="p-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex-shrink-0"
          >
            {submitting
              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              : <Send className="w-3.5 h-3.5 text-white" />}
          </Button>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              onReply={onReply}
              depth={depth + 1}
              viewerId={viewerId}
              canAccept={false}
              acceptedId={acceptedId}
              onAccept={onAccept}
            />
          ))}
        </div>
      )}
    </div>
  );
}
