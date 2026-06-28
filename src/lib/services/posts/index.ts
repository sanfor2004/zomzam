// Public API of the posts service. Route handlers and tests import this barrel
// (`import * as posts from '@/lib/services/posts'`), so the module's surface is
// defined here in one place — grouped by concern to mirror the file layout.
//
// Internal cross-module helpers (reposts.resolveRepostTarget, feed.fetchFeedPostById)
// are deliberately NOT re-exported: they're imported directly by their one sibling
// consumer (crud.ts) and stay off the public surface.

// ── Post create / edit / delete ───────────────────────────────
export { createPost, editPost, deletePost } from './crud';
export type { CreatePostInput, EditPostInput } from './crud';

// ── Reposts (plain pointer toggle) ────────────────────────────
export { toggleRepost } from './reposts';

// ── Feed / saved / seen / audience ────────────────────────────
export { getFeed, getSaved, markPostsSeen, getFeedAudience } from './feed';
export type { FeedTier, GetFeedOptions, GetSavedOptions } from './feed';

// ── Comments (thread + voting) ────────────────────────────────
export { addComment, editComment, deleteComment, toggleCommentVote, getComments, getTopComments } from './comments';

// ── Ask lifecycle ─────────────────────────────────────────────
export { acceptAnswer, findAskNotifyRecipients, resolveAsk, reopenAsk } from './asks';
export type { AcceptAnswerResult } from './asks';

// ── Post engagement (like / bookmark) ─────────────────────────
export { toggleLike, toggleBookmark } from './engagement';

// ── Shared constants ──────────────────────────────────────────
export { MAX_POST_IMAGES } from './shared';
