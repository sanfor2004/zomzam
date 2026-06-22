import DOMPurify from 'isomorphic-dompurify';
import { query, queryOne, execute, transaction } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { DEFAULT_AVATAR } from '@/lib/models/user';
import { processImageUpload, deleteUploadFile, ImageUploadError } from '@/lib/uploads';

// Social-feed business logic. Route handlers parse the request (multipart vs
// JSON, image File) and dispatch; every SQL query, owner-scoping rule, tag
// ranking and sanitization lives here so the feed is unit-testable in isolation.

// Allowlist sanitizer for composer HTML later rendered via dangerouslySetInnerHTML.
// Permits only the formatting tags the toolbar emits plus mention/hashtag pill
// spans; data-* attributes survive (DOMPurify default) so extractPostTags can read
// data-tag. Input is capped first so truncation never leaves a half-open tag.
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html.slice(0, 10000), {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'span', 'div', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['class'],
  });
}

function normalizeAvatar(row: any) {
  return { ...row, avatar: row.avatar || DEFAULT_AVATAR };
}

// Normalize a tag to its hashtag slug form (the composer stores #UI/UX as
// data-tag="uiux") so viewer tags and in-post hashtags compare apples-to-apples.
function slugifyTag(t: any): string {
  return String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseTagList(raw: any): string[] {
  let arr: any = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { arr = []; } }
  return Array.isArray(arr) ? arr.map(slugifyTag).filter(Boolean) : [];
}

function extractPostTags(html: string): string[] {
  const out: string[] = [];
  const re = /data-tag="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html || '')) !== null) out.push(slugifyTag(m[1]));
  return out;
}

export interface CreatePostInput {
  contentHtml: string;
  visibility: string;
  imageFile: File | null;
  type?: string;             // 'status' | 'ask' | 'win'
  skillTag?: string | null;  // ask routing tag, ignored for non-ask
}

const POST_TYPES = ['status', 'ask', 'win'];

export async function createPost(userId: number, input: CreatePostInput) {
  const raw = (input.contentHtml || '').trim();
  const hasImage = !!(input.imageFile && input.imageFile.size > 0);
  // A post needs either text or an image — image-only posts are valid.
  if (!raw && !hasImage) {
    throw new HttpError(400, 'Content or image required');
  }

  const content_html = sanitizeHtml(raw);
  const allowedVisibility = ['friends', 'public', 'exclusive'];
  const visibility = allowedVisibility.includes(input.visibility) ? input.visibility : 'friends';
  const type = POST_TYPES.includes(input.type ?? '') ? input.type! : 'status';
  // Only asks carry a routing tag; slugify-cap to the column width.
  const skill_tag = type === 'ask' && input.skillTag ? slugifyTag(input.skillTag).slice(0, 50) || null : null;

  let image_path: string | null = null;
  if (hasImage) {
    try {
      image_path = await processImageUpload(input.imageFile!, {
        subdir: 'posts',
        filenamePrefix: 'post',
        maxBytes: 5 * 1024 * 1024,
        maxDimension: 1600,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
    } catch (err) {
      if (err instanceof ImageUploadError) {
        throw new HttpError(400, err.message);
      }
      throw err;
    }
  }

  const result = await execute(
    `INSERT INTO posts (user_id, content_html, visibility, image_path, type, skill_tag) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, content_html, visibility, image_path, type, skill_tag]
  );

  const post = await queryOne(
    `SELECT p.id, p.user_id, p.content_html, p.image_path, p.visibility,
            p.type, p.skill_tag, p.accepted_answer_id, p.resolved_at, p.created_at,
            u.username, u.first_name, u.last_name, u.avatar,
            0 AS like_count, 0 AS comment_count, 0 AS liked_by_me
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [result.insertId]
  );

  return normalizeAvatar(post);
}

export interface AcceptAnswerResult {
  postId: number;
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

  const post = await queryOne<{ id: number; type: string }>(
    `SELECT id, type FROM posts WHERE id = ? AND user_id = ?`,
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

  return { result: { postId, commentId, resolvedAt }, helperUserId: answer.user_id };
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
     FROM users u
     JOIN user_connections c ON (
       (c.type = 'friend' AND c.status = 'accepted'
          AND ((c.requester_id = ? AND c.addressee_id = u.id)
               OR (c.addressee_id = ? AND c.requester_id = u.id)))
       OR (c.type = 'follow' AND c.status = 'accepted' AND c.addressee_id = ? AND c.requester_id = u.id)
     )
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

export async function deletePost(userId: number, postId: number): Promise<void> {
  if (!postId) throw new HttpError(400, 'post_id required');

  const owned = await queryOne<{ image_path: string | null }>(
    `SELECT image_path FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!owned) throw new HttpError(403, 'Not found or not yours');

  await execute(`DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM post_comments WHERE post_id = ?)`, [postId]);
  await execute(`DELETE FROM post_likes    WHERE post_id = ?`, [postId]);
  await execute(`DELETE FROM post_comments WHERE post_id = ?`, [postId]);
  await execute(`DELETE FROM posts         WHERE id = ? AND user_id = ?`, [postId, userId]);

  // Remove the orphaned image file from disk (mirrors avatar cleanup).
  deleteUploadFile(owned.image_path);
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

const FEED_WINDOW = 300; // candidate pool ranked in-memory

/**
 * The home feed: every PUBLIC post plus the viewer's own and friends-/follows-only
 * posts, ranked by how well the in-post hashtags match the viewer's profile tags,
 * then recency, with top-2 root comments embedded per post.
 */
export async function getFeed(userId: number, offset: number, limit: number, filter?: string) {
  const me = await queryOne<{ tags: any }>(`SELECT tags FROM users WHERE id = ?`, [userId]);
  const viewerTags = new Set(parseTagList(me?.tags));

  const candidates = await query(
    `SELECT p.id, p.user_id, p.content_html, p.image_path, p.visibility,
            p.type, p.skill_tag, p.accepted_answer_id, p.resolved_at, p.created_at,
            u.username, u.first_name, u.last_name, u.avatar, u.tags AS author_tags,
            (SELECT COUNT(*) FROM post_likes   WHERE post_id = p.id) AS like_count,
            (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,
            (SELECT COUNT(*) FROM post_likes   WHERE post_id = p.id AND user_id = ?) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.visibility = 'public'
        OR p.user_id = ?
        OR p.user_id IN (
             SELECT addressee_id FROM user_connections
               WHERE requester_id = ? AND type = 'follow' AND status = 'accepted'
             UNION
             SELECT IF(requester_id = ?, addressee_id, requester_id) FROM user_connections
               WHERE (requester_id = ? OR addressee_id = ?) AND type = 'friend' AND status = 'accepted'
           )
     ORDER BY p.created_at DESC
     LIMIT ${FEED_WINDOW}`,
    [userId, userId, userId, userId, userId, userId]
  );

  // Optional help views: 'help' = all asks; 'help_matches' = open asks whose
  // skill_tag is one of the viewer's tags.
  let pool = candidates;
  if (filter === 'help') {
    pool = candidates.filter((p) => p.type === 'ask');
  } else if (filter === 'help_matches') {
    pool = candidates.filter(
      (p) => p.type === 'ask' && !p.resolved_at && p.skill_tag && viewerTags.has(slugifyTag(p.skill_tag))
    );
  }

  // Score: in-post hashtags weigh heaviest, author's profile tags break ties.
  // Open asks float up (skill-matched highest) on a 3-day time-decay so help
  // requests get seen while fresh; resolved asks settle below. Then most-recent
  // wins; id is the final deterministic tiebreaker so offset pagination stays
  // stable between requests.
  const scored = pool
    .map((p) => {
      const postMatches = extractPostTags(p.content_html).filter((t) => viewerTags.has(t)).length;
      const authorMatches = parseTagList(p.author_tags).filter((t) => viewerTags.has(t)).length;
      let score = postMatches * 10 + authorMatches;
      if (p.type === 'ask' && !p.resolved_at) {
        const ageHours = (Date.now() - new Date(p.created_at).getTime()) / 3.6e6;
        const decay = Math.max(0, 1 - ageHours / 72);
        const skillMatch = p.skill_tag && viewerTags.has(slugifyTag(p.skill_tag));
        score += (skillMatch ? 30 : 8) * decay;
      } else if (p.type === 'ask' && p.resolved_at) {
        score -= 5;
      }
      return { p, score };
    })
    .sort((a, b) =>
      b.score - a.score ||
      new Date(b.p.created_at).getTime() - new Date(a.p.created_at).getTime() ||
      Number(b.p.id) - Number(a.p.id)
    );

  const normalized = scored.slice(offset, offset + limit).map(({ p }) => {
    const { author_tags, ...rest } = p;
    return {
      ...normalizeAvatar(rest),
      like_count: parseInt(rest.like_count || 0),
      comment_count: parseInt(rest.comment_count || 0),
      liked_by_me: parseInt(rest.liked_by_me || 0) > 0,
      top_comments: [] as any[],
    };
  });

  await embedTopComments(userId, normalized);

  return { posts: normalized, has_more: offset + limit < scored.length };
}

// Embed the top-2 root comments per post in one windowed query (rn <= 2), then
// group them back onto each post in memory — avoids a per-card waterfall.
async function embedTopComments(userId: number, posts: any[]): Promise<void> {
  const pageIds = posts.map((p) => p.id);
  if (pageIds.length === 0) return;

  try {
    const placeholders = pageIds.map(() => '?').join(',');
    const topRows = await query(
      `SELECT t.id, t.post_id, t.parent_id, t.content, t.created_at,
              t.username, t.first_name, t.last_name, t.avatar, t.upvote_count, t.upvoted_by_me
       FROM (
         SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
                u.username, u.first_name, u.last_name, u.avatar,
                (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id) AS upvote_count,
                (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND user_id = ?) AS upvoted_by_me,
                ROW_NUMBER() OVER (
                  PARTITION BY c.post_id
                  ORDER BY (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id) DESC, c.created_at ASC
                ) AS rn
         FROM post_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id IN (${placeholders}) AND c.parent_id IS NULL
       ) t
       WHERE t.rn <= 2
       ORDER BY t.post_id, t.rn`,
      [userId, ...pageIds]
    );

    const byPost = new Map<number, any[]>();
    for (const row of topRows) {
      const list = byPost.get(Number(row.post_id)) ?? [];
      list.push({
        ...normalizeAvatar(row),
        upvote_count: parseInt(row.upvote_count || 0),
        upvoted_by_me: parseInt(row.upvoted_by_me || 0) > 0,
      });
      byPost.set(Number(row.post_id), list);
    }
    for (const p of posts) p.top_comments = byPost.get(Number(p.id)) ?? [];
  } catch (e) {
    // Non-fatal: the feed still renders without embedded comment previews.
    console.error('feed top_comments embed failed:', e);
  }
}

export async function getComments(userId: number, postId: number) {
  if (!postId) throw new HttpError(400, 'post_id required');
  const comments = await query(
    `SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
            u.username, u.first_name, u.last_name, u.avatar,
            (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id) AS upvote_count,
            (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND user_id = ?) AS upvoted_by_me
     FROM post_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC
     LIMIT 100`,
    [userId, postId]
  );
  return comments.map((c) => ({
    ...normalizeAvatar(c),
    upvote_count: parseInt(c.upvote_count || 0),
    upvoted_by_me: parseInt(c.upvoted_by_me || 0) > 0,
  }));
}

export async function getTopComments(userId: number, postId: number) {
  if (!postId) throw new HttpError(400, 'post_id required');
  const comments = await query(
    `SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
            u.username, u.first_name, u.last_name, u.avatar,
            (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id) AS upvote_count,
            (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND user_id = ?) AS upvoted_by_me
     FROM post_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ? AND c.parent_id IS NULL
     ORDER BY upvote_count DESC, c.created_at ASC
     LIMIT 2`,
    [userId, postId]
  );
  return comments.map((c: any) => ({
    ...normalizeAvatar(c),
    upvote_count: parseInt(c.upvote_count || 0),
    upvoted_by_me: parseInt(c.upvoted_by_me || 0) > 0,
  }));
}
