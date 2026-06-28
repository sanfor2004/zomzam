import { query, queryOne, execute, transaction } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { slugifyTag, parseTagList, CONNECTED_USERS_JOIN } from './shared';

// Ask lifecycle: accepting an answer (logs the append-only helpful_event credit
// trigger), the asker's own "solved it" resolve, reopening, and resolving the
// skill-matched recipients to notify about a fresh ask (throttled per-day).

export interface AcceptAnswerResult {
  postId: number;
  postPublicId: string;
  commentId: number;
  resolvedAt: string;
}

/**
 * Asker accepts one answer: resolves the ask and logs an append-only
 * helpful_event (the future credit trigger — NO balance touched). Idempotent /
 * re-markable: changing the accepted answer overwrites the pointer and logs a
 * fresh event. Guards: caller owns the post, post is an ask, comment belongs to
 * the post. Notifies the answer's author. Returns the helper id so the route can
 * fire the notification outside the transaction.
 */
export async function acceptAnswer(userId: number, postId: number, commentId: number): Promise<{ result: AcceptAnswerResult; helperUserId: number }> {
  if (!postId || !commentId) throw new HttpError(400, 'post_id and comment_id required');

  const post = await queryOne<{ id: number; public_id: string; type: string }>(
    `SELECT id, public_id, type FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!post) throw new HttpError(403, 'Not found or not yours');
  if (post.type !== 'ask') throw new HttpError(400, 'Only ask posts can accept an answer');

  const answer = await queryOne<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM post_comments WHERE id = ? AND post_id = ?`,
    [commentId, postId]
  );
  if (!answer) throw new HttpError(404, 'Answer not found on this post');

  const resolvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await transaction(async (connection) => {
    await connection.execute(
      `UPDATE posts SET accepted_answer_id = ?, resolved_at = ? WHERE id = ? AND user_id = ?`,
      [commentId, resolvedAt, postId, userId]
    );
    await connection.execute(
      `INSERT INTO helpful_events (post_id, comment_id, helper_user_id, asker_user_id) VALUES (?, ?, ?, ?)`,
      [postId, commentId, answer.user_id, userId]
    );
  });

  return { result: { postId, postPublicId: post.public_id, commentId, resolvedAt }, helperUserId: answer.user_id };
}

/**
 * Resolve who to notify about a new ask: the asker's friends + followers whose
 * profile tags include the ask's skill_tag, minus anyone already at the per-day
 * notification cap (anti-nag). Returns recipient user ids; the route fires the
 * actual notifications. Tag matching is done in JS (slugified) to stay
 * consistent with the feed ranking — users.tags stores raw labels.
 */
export async function findAskNotifyRecipients(askerId: number, skillTag: string, dailyCap = 3): Promise<number[]> {
  if (!skillTag) return [];

  const connected = await query<{ id: number; tags: any }>(
    `SELECT DISTINCT u.id, u.tags
     FROM users u${CONNECTED_USERS_JOIN}
     WHERE u.id <> ?`,
    [askerId, askerId, askerId, askerId]
  );

  const skill = slugifyTag(skillTag);
  const matched = connected.filter((u) => parseTagList(u.tags).includes(skill)).map((u) => Number(u.id));
  if (matched.length === 0) return [];

  // Drop anyone who already hit today's cap of new_help_request notifications.
  const placeholders = matched.map(() => '?').join(',');
  const counts = await query<{ user_id: number; c: number }>(
    `SELECT user_id, COUNT(*) AS c FROM notifications
     WHERE type = 'new_help_request' AND created_at >= CURDATE() AND user_id IN (${placeholders})
     GROUP BY user_id`,
    matched
  );
  const overCap = new Set(counts.filter((r) => Number(r.c) >= dailyCap).map((r) => Number(r.user_id)));
  return matched.filter((id) => !overCap.has(id));
}

/** Asker resolves their own ask without accepting an answer ("solved it myself"):
 *  no helpful_event, no notification. */
export async function resolveAsk(userId: number, postId: number): Promise<{ resolvedAt: string }> {
  if (!postId) throw new HttpError(400, 'post_id required');
  const post = await queryOne<{ id: number; type: string }>(
    `SELECT id, type FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!post) throw new HttpError(403, 'Not found or not yours');
  if (post.type !== 'ask') throw new HttpError(400, 'Only ask posts can be resolved');

  const resolvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await execute(`UPDATE posts SET resolved_at = ? WHERE id = ? AND user_id = ?`, [resolvedAt, postId, userId]);
  return { resolvedAt };
}

/**
 * Owner reopens a resolved ask: clears resolution state and hard-deletes the
 * append-only helpful_events row(s) for the post. No credits are computed yet,
 * so the undo is total — as if the answer had never been accepted. Silent: fires
 * no notification, and leaves the helper's prior answer_accepted notification be.
 * Covers both resolved states — accepted-answer and "solved it myself"
 * (accepted_answer_id may already be NULL, making its clear a no-op).
 */
export async function reopenAsk(userId: number, postId: number): Promise<{ reopened: true }> {
  if (!postId) throw new HttpError(400, 'post_id required');

  const post = await queryOne<{ id: number; type: string }>(
    `SELECT id, type FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!post) throw new HttpError(403, 'Not found or not yours');
  if (post.type !== 'ask') throw new HttpError(400, 'Only ask posts can be reopened');

  await transaction(async (connection) => {
    await connection.execute(
      `UPDATE posts SET accepted_answer_id = NULL, resolved_at = NULL WHERE id = ? AND user_id = ?`,
      [postId, userId]
    );
    await connection.execute(`DELETE FROM helpful_events WHERE post_id = ?`, [postId]);
  });

  return { reopened: true };
}
