'use client';

import { useCallback, useState } from 'react';
import type { Post } from '@/app/(dashboard)/home/shared';
import { deletePostRequest, likePostRequest, bookmarkPostRequest, repostRequest } from './PostCard.services';

// ──────────────────────────────────────────────────────────
// Post action bar — optimistic mutation state.
//
// Owns the like / bookmark / repost counters + active flags and their
// optimistic toggles (repost rolls back on a rejected write; like/bookmark are
// fire-and-forget). `demo` keeps every flip optimistic but skips the network so
// the data-free /ui-kit showcase renders a live-feeling card. The card itself
// keeps the purely-visual interaction state (confirm armed, menus, modals).
// ──────────────────────────────────────────────────────────
export function usePostActions({ post, demo, repostTargetId, onUnbookmark }: {
  post: Post;
  demo?: boolean;
  repostTargetId: number;
  onUnbookmark?: (id: number) => void;
}) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [bookmarked, setBookmarked] = useState(!!post.bookmarked_by_me);
  const [reposted, setReposted] = useState(!!post.reposted_by_me);
  const [repostCount, setRepostCount] = useState(post.repost_count ?? 0);

  const toggleLike = useCallback(async () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    if (demo) return; // showcase: keep the optimistic flip, skip the write
    try { await likePostRequest(post.id); } catch { /* non-blocking */ }
  }, [liked, demo, post.id]);

  // On the /saved page an un-bookmark drops the card via onUnbookmark; in the
  // feed the icon just empties.
  const toggleBookmark = useCallback(async () => {
    const next = !bookmarked;
    setBookmarked(next);
    if (demo) return;
    try {
      await bookmarkPostRequest(post.id);
      if (!next) onUnbookmark?.(post.id);
    } catch { /* non-blocking */ }
  }, [bookmarked, demo, post.id, onUnbookmark]);

  // Plain repost toggle. The pointer row re-floats the original on the next feed
  // fetch (the reach boost); nothing is prepended here — just flip count/active,
  // rolling back if the server rejects.
  const togglePlainRepost = useCallback(async () => {
    const next = !reposted;
    setReposted(next);
    setRepostCount((c) => Math.max(0, next ? c + 1 : c - 1));
    if (demo) return;
    let ok = false;
    try { ok = await repostRequest(repostTargetId); } catch { ok = false; }
    if (!ok) {
      setReposted(!next);
      setRepostCount((c) => Math.max(0, next ? c - 1 : c + 1));
    }
  }, [reposted, demo, repostTargetId]);

  // Network only — the card owns the two-step confirm UI and the unmount. In
  // demo mode this is a no-op (the card unmounts directly). Throws on failure.
  const deletePost = useCallback(async () => {
    if (demo) return;
    await deletePostRequest(post.id);
  }, [demo, post.id]);

  return { liked, likeCount, bookmarked, reposted, repostCount, toggleLike, toggleBookmark, togglePlainRepost, deletePost };
}
