import { queryOne, execute } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { newPublicId } from './shared';

// Repost logic: resolving a repost's true root (with the public-only guard) and
// the plain-repost toggle. Quote reposts are created via crud.createPost, which
// imports resolveRepostTarget from here to collapse the quote to its root.

/**
 * Resolve the true root original a repost should point at. If the target is
 * itself a repost, collapse to ITS original — `repost_of` never forms a chain
 * (F2.7). Enforces the public-only rule on the ROOT (F2.4): only a
 * `visibility='public'` original can be reposted, so a stranger only ever sees
 * already-public content. Throws 404 if the root is gone, 400 if it's not public.
 * Returns the root id + its author (to notify) — never the intermediate repost.
 */
export async function resolveRepostTarget(targetId: number): Promise<{ rootId: number; rootPublicId: string; authorId: number }> {
  if (!targetId) throw new HttpError(400, 'post_id required');
  const target = await queryOne<{ id: number; repost_of: number | null }>(
    `SELECT id, repost_of FROM posts WHERE id = ?`,
    [targetId]
  );
  if (!target) throw new HttpError(404, 'Post not found');

  const rootId = target.repost_of ? Number(target.repost_of) : Number(target.id);
  const root = await queryOne<{ id: number; public_id: string; user_id: number; visibility: string }>(
    `SELECT id, public_id, user_id, visibility FROM posts WHERE id = ?`,
    [rootId]
  );
  if (!root) throw new HttpError(404, 'Post not found');
  if (root.visibility !== 'public') throw new HttpError(400, 'Only public posts can be reposted');

  return { rootId: Number(root.id), rootPublicId: root.public_id, authorId: Number(root.user_id) };
}

/**
 * Toggle a PLAIN repost (empty-comment pointer row) of a post. Resolves the root
 * first (collapse + public-only guard), then mirrors toggleLike's check-then
 * insert/delete — but on the `posts` table itself, since a repost IS a post.
 * Plain uniqueness (one per (user, root)) is enforced here in app logic because a
 * DB UNIQUE can't express it: quote reposts legitimately share (user, repost_of)
 * (F2.3). Self-repost is allowed. On insert the author's post_views seen=1 row is
 * recorded (mirrors createPost) so the unseen feed never echoes it back. Returns
 * the freshly-normalized repost row (with nested original) so the route can fan
 * out the live pill + notify; on un-repost returns `{ reposted: false }`.
 */
export async function toggleRepost(userId: number, targetId: number): Promise<{ reposted: boolean; originalAuthorId?: number; originalId?: number; originalPublicId?: string }> {
  const { rootId, rootPublicId, authorId } = await resolveRepostTarget(targetId);

  // A PLAIN repost is the empty pointer row: no text AND no image. An image-only
  // quote also has content_html='' but carries an image, so it must NOT match here.
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM posts WHERE repost_of = ? AND user_id = ? AND content_html = '' AND image_path IS NULL`,
    [rootId, userId]
  );
  if (existing) {
    // Un-repost: remove only this user's plain pointer row. No comments/likes/
    // image ever attach to a plain repost, so a direct DELETE is sufficient.
    await execute(`DELETE FROM posts WHERE id = ? AND user_id = ?`, [existing.id, userId]);
    return { reposted: false };
  }

  const result = await execute(
    `INSERT INTO posts (public_id, user_id, content_html, visibility, image_path, type, skill_tag, repost_of)
     VALUES (?, ?, '', 'public', NULL, 'status', NULL, ?)`,
    [newPublicId(), userId, rootId]
  );
  await execute(
    `INSERT INTO post_views (post_id, user_id, seen) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE seen = 1`,
    [result.insertId, userId]
  );

  // The fresh pointer row now surfaces in the feed on the next fetch (recency
  // re-floats the original), so no optimistic row is returned here — the route
  // only needs the ids to notify the original's author (the public_id drives the
  // notification's deep link to the original).
  return { reposted: true, originalAuthorId: authorId, originalId: rootId, originalPublicId: rootPublicId };
}
