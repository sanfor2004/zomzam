import { query, queryOne, execute } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { normalizeAvatar, shapeComment } from './shared';

// Comment CRUD + voting for a post's discussion thread: add/edit/delete (with
// reply-tree cascade), the upvote toggle, and the two read paths (full thread,
// top-2). The batched feed-preview embed lives in feed.ts (it shares shapeComment).

// The per-comment column list + author join shared by getComments and
// getTopComments. One `?` (the viewer id) feeds the upvoted_by_me check.
const COMMENT_SELECT = `SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
            u.username, u.first_name, u.last_name, u.avatar,
            (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id) AS upvote_count,
            (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND user_id = ?) AS upvoted_by_me
     FROM post_comments c
     JOIN users u ON u.id = c.user_id`;

export async function toggleCommentVote(userId: number, commentId: number): Promise<{ upvoted: boolean }> {
  if (!commentId) throw new HttpError(400, 'comment_id required');
  const existing = await queryOne(`SELECT id FROM comment_votes WHERE comment_id = ? AND user_id = ?`, [commentId, userId]);
  if (existing) {
    await execute(`DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?`, [commentId, userId]);
    return { upvoted: false };
  }
  await execute(`INSERT INTO comment_votes (comment_id, user_id) VALUES (?, ?)`, [commentId, userId]);
  return { upvoted: true };
}

export async function editComment(userId: number, commentId: number, rawContent: string): Promise<{ content: string }> {
  const content = (rawContent || '').trim().slice(0, 1000);
  if (!commentId || !content) throw new HttpError(400, 'comment_id and content required');

  const owned = await queryOne(`SELECT id FROM post_comments WHERE id = ? AND user_id = ?`, [commentId, userId]);
  if (!owned) throw new HttpError(403, 'Not found or not yours');

  await execute(`UPDATE post_comments SET content = ? WHERE id = ? AND user_id = ?`, [content, commentId, userId]);
  return { content };
}

export async function deleteComment(userId: number, commentId: number): Promise<{ deleted_ids: number[] }> {
  if (!commentId) throw new HttpError(400, 'comment_id required');

  const owned = await queryOne(`SELECT id FROM post_comments WHERE id = ? AND user_id = ?`, [commentId, userId]);
  if (!owned) throw new HttpError(403, 'Not found or not yours');

  // Walk the reply tree so deleting a parent also removes its thread.
  const ids: number[] = [commentId];
  let frontier: number[] = [commentId];
  while (frontier.length) {
    const placeholders = frontier.map(() => '?').join(',');
    const children = await query(`SELECT id FROM post_comments WHERE parent_id IN (${placeholders})`, frontier);
    const childIds = children.map((c: any) => Number(c.id));
    if (!childIds.length) break;
    ids.push(...childIds);
    frontier = childIds;
  }

  const idPlaceholders = ids.map(() => '?').join(',');
  await execute(`DELETE FROM comment_votes WHERE comment_id IN (${idPlaceholders})`, ids);
  await execute(`DELETE FROM post_comments WHERE id IN (${idPlaceholders})`, ids);

  return { deleted_ids: ids };
}

export async function addComment(userId: number, postId: number, rawContent: string, parentId: number | null) {
  const content = (rawContent || '').trim().slice(0, 1000);
  if (!postId || !content) throw new HttpError(400, 'post_id and content required');

  if (parentId) {
    const parent = await queryOne(`SELECT id FROM post_comments WHERE id = ? AND post_id = ?`, [parentId, postId]);
    if (!parent) throw new HttpError(404, 'Parent comment not found');
  }

  const result = await execute(
    `INSERT INTO post_comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)`,
    [postId, userId, content, parentId]
  );

  const comment = await queryOne(
    `SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
            u.username, u.first_name, u.last_name, u.avatar
     FROM post_comments c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [result.insertId]
  );

  return { ...normalizeAvatar(comment), upvote_count: 0, upvoted_by_me: false };
}

export async function getComments(userId: number, postId: number) {
  if (!postId) throw new HttpError(400, 'post_id required');
  const comments = await query(
    `${COMMENT_SELECT} WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT 100`,
    [userId, postId]
  );
  return comments.map(shapeComment);
}

export async function getTopComments(userId: number, postId: number) {
  if (!postId) throw new HttpError(400, 'post_id required');
  const comments = await query(
    `${COMMENT_SELECT} WHERE c.post_id = ? AND c.parent_id IS NULL
     ORDER BY upvote_count DESC, c.created_at ASC LIMIT 2`,
    [userId, postId]
  );
  return comments.map(shapeComment);
}
