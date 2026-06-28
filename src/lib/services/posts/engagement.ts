import { queryOne, execute } from '@/lib/db';
import { HttpError } from '@/lib/http-error';

// Post-level engagement toggles: like and private bookmark. Each is a single row
// per (user, post) whose presence IS the state — mirror check-then insert/delete.
// (The comment-vote toggle lives in comments.ts alongside the rest of the thread.)

export async function toggleLike(userId: number, postId: number): Promise<{ liked: boolean }> {
  if (!postId) throw new HttpError(400, 'post_id required');
  const existing = await queryOne(`SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId]);
  if (existing) {
    await execute(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId]);
    return { liked: false };
  }
  await execute(`INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)`, [postId, userId]);
  return { liked: true };
}

/**
 * Toggle a private bookmark on a post. One row per (user, post) — its presence
 * means saved. Id-scoped to the session user (a viewer can only ever toggle their
 * own bookmark). No visibility check here: a saved row for a now-hidden post is
 * harmless because getSaved re-applies the feed visibility rule at read time.
 */
export async function toggleBookmark(userId: number, postId: number): Promise<{ bookmarked: boolean }> {
  if (!postId) throw new HttpError(400, 'post_id required');
  const existing = await queryOne(`SELECT id FROM post_bookmarks WHERE post_id = ? AND user_id = ?`, [postId, userId]);
  if (existing) {
    await execute(`DELETE FROM post_bookmarks WHERE post_id = ? AND user_id = ?`, [postId, userId]);
    return { bookmarked: false };
  }
  await execute(`INSERT INTO post_bookmarks (post_id, user_id) VALUES (?, ?)`, [postId, userId]);
  return { bookmarked: true };
}
