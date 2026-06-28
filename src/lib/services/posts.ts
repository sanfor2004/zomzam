import crypto from 'crypto';
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

// Opaque public identifier for the /p/ permalink. MD5 of 16 random bytes — 32
// hex chars, unguessable and NOT derived from the sequential post id, so the
// permalink can't be walked (md5(1), md5(2), …) to enumerate or count posts.
function newPublicId(): string {
  return crypto.createHash('md5').update(crypto.randomBytes(16)).digest('hex');
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
  /** Up to {@link MAX_POST_IMAGES} attached images. `imageFile` is the legacy
   *  single-image field — supply either; both are coalesced via {@link selectImageFiles}. */
  imageFiles?: (File | null)[];
  imageFile?: File | null;
  type?: string;             // 'status' | 'ask' | 'win'
  skillTag?: string | null;  // ask routing tag, ignored for non-ask
  repostOf?: number | null;  // set ⇒ this is a QUOTE repost of that post (root-collapsed)
}

const POST_TYPES = ['status', 'ask', 'win'];

// Product cap: a post (or quote) carries at most this many images. Enforced
// server-side here even though the composer also limits it — never trust client.
export const MAX_POST_IMAGES = 3;

/** Coalesce the legacy `imageFile` + new `imageFiles` inputs into one ordered,
 *  non-empty File list, capped at MAX_POST_IMAGES. Drops nulls/empty files. */
function selectImageFiles(input: { imageFiles?: (File | null)[]; imageFile?: File | null }): File[] {
  const raw = input.imageFiles?.length ? input.imageFiles : (input.imageFile ? [input.imageFile] : []);
  return raw.filter((f): f is File => !!f && f.size > 0).slice(0, MAX_POST_IMAGES);
}

/** Encode a JSON image array for the `image_paths` column, or null when empty
 *  so a no-image post stores SQL NULL (not "[]"). */
function encodeImagePaths(paths: string[]): string | null {
  return paths.length ? JSON.stringify(paths) : null;
}

/** Decode the `image_paths` column back to a string[]. mysql2 hands JSON columns
 *  back already-parsed, but tolerate a raw string (or absent column) defensively. */
function decodeImagePaths(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === 'string');
  if (typeof raw === 'string' && raw.trim()) {
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((s) => typeof s === 'string') : []; }
    catch { return []; }
  }
  return [];
}

/**
 * Validate, re-encode, and store a post image. One piece of knowledge — the
 * post-image params (5 MB cap, longest edge ≤ 1600 px, JPG/PNG/WebP) and the
 * 400-vs-500 mapping — shared by createPost and editPost. Returns the public
 * path; maps an ImageUploadError to a 400, rethrows real (sharp/disk) failures.
 */
async function processPostImage(file: File): Promise<string> {
  try {
    return await processImageUpload(file, {
      subdir: 'posts',
      filenamePrefix: 'post',
      maxBytes: 5 * 1024 * 1024,
      maxDimension: 1600,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
  } catch (err) {
    if (err instanceof ImageUploadError) throw new HttpError(400, err.message);
    throw err;
  }
}

/** Store an ordered batch of post images, preserving order. Sequential (not
 *  Promise.all) so a mid-batch validation failure surfaces the same 400 a single
 *  upload would, without firing later uploads. */
async function processPostImages(files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (const file of files) out.push(await processPostImage(file));
  return out;
}

export async function createPost(userId: number, input: CreatePostInput) {
  const raw = (input.contentHtml || '').trim();
  const files = selectImageFiles(input);
  const hasImage = files.length > 0;

  // QUOTE repost branch: a quote carries the reposter's own comment AND/OR image
  // over a nested original. It collapses to the root and is forced
  // public/status/no-skill. A quote needs text OR an image (an empty, image-less
  // quote is just a plain repost, which the toggle path handles instead). The
  // quote's own image is allowed; the ORIGINAL's image is never republished.
  const isQuote = input.repostOf != null && Number(input.repostOf) > 0;
  let repostRootId: number | null = null;
  if (isQuote) {
    if (!raw && !hasImage) throw new HttpError(400, 'A quote repost needs a comment or image');
    const { rootId } = await resolveRepostTarget(Number(input.repostOf));
    repostRootId = rootId;
  } else if (!raw && !hasImage) {
    // A normal post needs either text or an image — image-only posts are valid.
    throw new HttpError(400, 'Content or image required');
  }

  const content_html = sanitizeHtml(raw);
  const allowedVisibility = ['friends', 'public', 'exclusive'];
  // A quote is always public (it republishes already-public content); a normal
  // post honors the requested visibility.
  const visibility = isQuote
    ? 'public'
    : allowedVisibility.includes(input.visibility) ? input.visibility : 'friends';
  const type = isQuote ? 'status' : POST_TYPES.includes(input.type ?? '') ? input.type! : 'status';
  // Only asks carry a routing tag; slugify-cap to the column width. Quotes never do.
  const skill_tag = !isQuote && type === 'ask' && input.skillTag
    ? slugifyTag(input.skillTag).slice(0, 50) || null
    : null;

  // image_path stays the FIRST image (back-compat + plain-repost guards);
  // image_paths is the full ordered JSON list (NULL when there are none).
  const paths = hasImage ? await processPostImages(files) : [];
  const image_path: string | null = paths[0] ?? null;
  const image_paths = encodeImagePaths(paths);

  const result = await execute(
    `INSERT INTO posts (public_id, user_id, content_html, visibility, image_path, type, skill_tag, repost_of, image_paths) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newPublicId(), userId, content_html, visibility, image_path, type, skill_tag, repostRootId, image_paths]
  );

  // The author has implicitly seen their own post — record it so the unseen-first
  // feed never surfaces it back to them as a "new post" (it's already prepended
  // client-side). Mirrors the chat read-receipt model (see markPostsSeen).
  await execute(
    `INSERT INTO post_views (post_id, user_id, seen) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE seen = 1`,
    [result.insertId, userId]
  );

  // A quote needs the full feed shape (nested original) so the card renders the
  // embedded post immediately; a plain post has no nested original to hydrate.
  if (isQuote) {
    return await fetchFeedPostById(userId, result.insertId);
  }

  // A plain post is never a repost, so repost_of is deliberately omitted (NOT
  // selected as null): PostCard reads `repost_of !== undefined` to decide a row
  // is a repost, so a null here would mis-render a fresh post as a tombstone.
  const post = await queryOne(
    `SELECT p.id, p.public_id, p.user_id, p.content_html, p.image_path, p.image_paths, p.visibility,
            p.type, p.skill_tag, p.accepted_answer_id, p.resolved_at, p.created_at,
            u.username, u.first_name, u.last_name, u.avatar,
            0 AS like_count, 0 AS comment_count, 0 AS liked_by_me
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [result.insertId]
  );

  return { ...normalizeAvatar(post), image_paths: decodeImagePaths(post.image_paths) };
}

export interface EditPostInput {
  contentHtml: string;
  visibility?: string;          // omitted ⇒ leave visibility unchanged
  keptPaths?: string[];         // existing image URLs the user kept, in display order
  newImageFiles?: File[];       // freshly attached images to append (after the kept ones)
}

/**
 * Owner edits a post's text, images, and (optionally) visibility — type and
 * skill_tag are immutable here. Image intent is declarative: the final image set
 * is `keptPaths` (the existing URLs the editor left in place, spoof-filtered
 * against what the row actually has) followed by the freshly uploaded
 * `newImageFiles`, capped at {@link MAX_POST_IMAGES}. Any previously-stored blob
 * the editor dropped is deleted only AFTER the row stops referencing it, so a
 * failed UPDATE never orphans a live image. Edits are silent (no edited marker).
 * Returns the persisted content/images so the caller can patch its cache.
 */
export async function editPost(userId: number, postId: number, input: EditPostInput) {
  if (!postId) throw new HttpError(400, 'post_id required');

  const post = await queryOne<{ id: number; image_path: string | null; image_paths: unknown }>(
    `SELECT id, image_path, image_paths FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!post) throw new HttpError(403, 'Not found or not yours');

  const raw = (input.contentHtml || '').trim();

  // What the row currently stores (multi-image rows use image_paths; legacy rows
  // fall back to the single image_path).
  const existing = decodeImagePaths(post.image_paths);
  const existingList = existing.length ? existing : (post.image_path ? [post.image_path] : []);

  // Keep only the existing URLs the editor actually retained — and only ones the
  // row genuinely has, so a forged keptPaths can't smuggle in an arbitrary URL.
  const requestedKeep = input.keptPaths ?? existingList;
  const kept = requestedKeep.filter((p) => existingList.includes(p)).slice(0, MAX_POST_IMAGES);

  // Append new uploads up to the remaining room.
  const newFiles = (input.newImageFiles ?? []).filter((f) => !!f && f.size > 0);
  const room = Math.max(0, MAX_POST_IMAGES - kept.length);
  const uploaded = room > 0 && newFiles.length ? await processPostImages(newFiles.slice(0, room)) : [];

  const finalPaths = [...kept, ...uploaded];
  // A post must still have text or at least one image after the edit (mirrors createPost).
  if (!raw && finalPaths.length === 0) throw new HttpError(400, 'Content or image required');

  const content_html = sanitizeHtml(raw);
  const allowedVisibility = ['friends', 'public', 'exclusive'];
  const visibility = allowedVisibility.includes(input.visibility ?? '') ? input.visibility! : undefined;

  const image_path = finalPaths[0] ?? null;
  const image_paths = encodeImagePaths(finalPaths);

  if (visibility) {
    await execute(
      `UPDATE posts SET content_html = ?, image_path = ?, image_paths = ?, visibility = ? WHERE id = ? AND user_id = ?`,
      [content_html, image_path, image_paths, visibility, postId, userId]
    );
  } else {
    await execute(
      `UPDATE posts SET content_html = ?, image_path = ?, image_paths = ? WHERE id = ? AND user_id = ?`,
      [content_html, image_path, image_paths, postId, userId]
    );
  }

  // Remove every old blob the editor dropped — only after the row no longer
  // points at it.
  const removed = existingList.filter((p) => !finalPaths.includes(p));
  for (const file of removed) await deleteUploadFile(file);

  return { content_html, image_path, image_paths: finalPaths, visibility };
}

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

/**
 * The set of user ids who can see `authorId`'s feed activity — accepted friends
 * plus followers. Used to fan out the live "new posts" pill over SSE so a
 * viewer's feed can offer to refresh the moment someone they follow posts.
 * Public posts are visible to strangers too, but friends/followers are the
 * bounded, meaningful audience actually watching a personal feed.
 */
export async function getFeedAudience(authorId: number): Promise<number[]> {
  const rows = await query<{ id: number }>(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN user_connections c ON (
       (c.type = 'friend' AND c.status = 'accepted'
          AND ((c.requester_id = ? AND c.addressee_id = u.id)
               OR (c.addressee_id = ? AND c.requester_id = u.id)))
       OR (c.type = 'follow' AND c.status = 'accepted' AND c.addressee_id = ? AND c.requester_id = u.id)
     )
     WHERE u.id <> ?`,
    [authorId, authorId, authorId, authorId]
  );
  return rows.map((r) => Number(r.id));
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

/**
 * Resolve the true root original a repost should point at. If the target is
 * itself a repost, collapse to ITS original — `repost_of` never forms a chain
 * (F2.7). Enforces the public-only rule on the ROOT (F2.4): only a
 * `visibility='public'` original can be reposted, so a stranger only ever sees
 * already-public content. Throws 404 if the root is gone, 400 if it's not public.
 * Returns the root id + its author (to notify) — never the intermediate repost.
 */
async function resolveRepostTarget(targetId: number): Promise<{ rootId: number; rootPublicId: string; authorId: number }> {
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

  // A plain repost never enters the home feed (it only boosts the original +
  // shows on the reposter's profile), so there's no row to return for prepend —
  // just the ids the route needs to notify the original's author (the public_id
  // drives the notification's deep link to the original).
  return { reposted: true, originalAuthorId: authorId, originalId: rootId, originalPublicId: rootPublicId };
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

  const owned = await queryOne<{ image_path: string | null; image_paths: unknown }>(
    `SELECT image_path, image_paths FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!owned) throw new HttpError(403, 'Not found or not yours');

  await execute(`DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM post_comments WHERE post_id = ?)`, [postId]);
  await execute(`DELETE FROM post_likes    WHERE post_id = ?`, [postId]);
  await execute(`DELETE FROM post_comments WHERE post_id = ?`, [postId]);
  await execute(`DELETE FROM posts         WHERE id = ? AND user_id = ?`, [postId, userId]);

  // Remove every orphaned image blob (mirrors avatar cleanup). Multi-image rows
  // store the full list in image_paths; legacy rows fall back to image_path.
  const blobs = decodeImagePaths(owned.image_paths);
  for (const file of (blobs.length ? blobs : [owned.image_path])) await deleteUploadFile(file);
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

const SCORED_WINDOW = 300; // candidate pool ranked in-memory for the landing page

// ── Shared feed-row SQL ───────────────────────────────────────
// The per-post column list used by the feed, the /saved page, and single-post
// fetches, so every surface returns an identically-shaped Post (incl. the nested
// repost original). Six `?` placeholders, in order: liked_by_me, bookmarked_by_me,
// is_following, is_friend (×2), reposted_by_me — supply them with feedColParams().
// repost_count + reposted_by_me are keyed on p.id so each card shows ITS OWN
// repost tally/state: an original shows how many times it was reposted; a
// repost (quote) card shows 0 (reposts collapse to the root, never to a quote),
// so the root's tally never bleeds onto the quote card.
const FEED_COLUMNS = `
    p.id, p.public_id, p.user_id, p.content_html, p.image_path, p.image_paths, p.visibility,
    p.type, p.skill_tag, p.accepted_answer_id, p.resolved_at, p.created_at, p.repost_of,
    u.username, u.first_name, u.last_name, u.avatar, u.tags AS author_tags,
    (SELECT COUNT(*) FROM post_likes     WHERE post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM post_comments  WHERE post_id = p.id) AS comment_count,
    (SELECT COUNT(*) FROM post_likes     WHERE post_id = p.id AND user_id = ?) AS liked_by_me,
    (SELECT COUNT(*) FROM post_bookmarks WHERE post_id = p.id AND user_id = ?) AS bookmarked_by_me,
    (EXISTS(SELECT 1 FROM user_connections WHERE requester_id = ? AND addressee_id = p.user_id AND type = 'follow' AND status = 'accepted')) AS is_following,
    (EXISTS(SELECT 1 FROM user_connections WHERE type = 'friend' AND status = 'accepted' AND ((requester_id = ? AND addressee_id = p.user_id) OR (addressee_id = ? AND requester_id = p.user_id)))) AS is_friend,
    (SELECT COUNT(*) FROM posts r WHERE r.repost_of = p.id) AS repost_count,
    (EXISTS(SELECT 1 FROM posts r WHERE r.repost_of = p.id AND r.user_id = ? AND r.content_html = '' AND r.image_path IS NULL)) AS reposted_by_me,
    orig.id AS orig_id, orig.public_id AS orig_public_id, orig.user_id AS orig_user_id, orig.content_html AS orig_content_html,
    orig.type AS orig_type, orig.skill_tag AS orig_skill_tag,
    orig.accepted_answer_id AS orig_accepted_answer_id, orig.resolved_at AS orig_resolved_at, orig.created_at AS orig_created_at,
    ou.username AS orig_username, ou.first_name AS orig_first_name, ou.last_name AS orig_last_name, ou.avatar AS orig_avatar,
    (SELECT COUNT(*) FROM post_likes    WHERE post_id = orig.id) AS orig_like_count,
    (SELECT COUNT(*) FROM post_comments WHERE post_id = orig.id) AS orig_comment_count`;

// The feed FROM/JOINs: the post, its author, and (when this row is a repost) the
// LEFT-joined original + its author (null ⇒ original deleted ⇒ tombstone).
const FEED_FROM = `
    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN posts orig ON orig.id = p.repost_of
    LEFT JOIN users ou ON ou.id = orig.user_id`;

/** The six per-viewer `?` params FEED_COLUMNS expects, in column order. */
function feedColParams(userId: number): number[] {
  return [userId, userId, userId, userId, userId, userId];
}

// What a viewer may see: public, their own, or friends/follows-only posts whose
// author they're connected to. One source of truth for the feed AND /saved (and
// any future feed-style read) so the visibility rule can never drift between
// them. Five `?`, all the viewer's id: own-check, follow-IN, friend-IF×1, friend-WHERE×2.
const FEED_VISIBILITY = `(
        p.visibility = 'public'
        OR p.user_id = ?
        OR (p.visibility = 'friends' AND p.user_id IN (
             SELECT addressee_id FROM user_connections
               WHERE requester_id = ? AND type = 'follow' AND status = 'accepted'
             UNION
             SELECT IF(requester_id = ?, addressee_id, requester_id) FROM user_connections
               WHERE (requester_id = ? OR addressee_id = ?) AND type = 'friend' AND status = 'accepted'
           ))
      )`;

/**
 * Shape one raw FEED_COLUMNS row into the wire Post. Builds the nested repost
 * original from the orig_* columns: a value of `undefined` ⇒ not a repost; `null`
 * ⇒ a repost whose original was deleted (render a tombstone); an object ⇒ the
 * live original. Strips the raw orig_ / author_tags / bookmark_id helper columns.
 */
function normalizeFeedRow(p: any) {
  const repost_of = p.repost_of
    ? (p.orig_id
        ? {
            id: Number(p.orig_id),
            public_id: p.orig_public_id,
            user_id: Number(p.orig_user_id),
            username: p.orig_username,
            first_name: p.orig_first_name,
            last_name: p.orig_last_name,
            avatar: p.orig_avatar || DEFAULT_AVATAR,
            content_html: p.orig_content_html,
            // The original's image is deliberately NOT carried into a repost — a
            // repost shows the original as text only; click through to see media.
            type: p.orig_type,
            skill_tag: p.orig_skill_tag,
            accepted_answer_id: p.orig_accepted_answer_id,
            resolved_at: p.orig_resolved_at,
            created_at: p.orig_created_at,
            like_count: parseInt(p.orig_like_count || 0),
            comment_count: parseInt(p.orig_comment_count || 0),
            liked_by_me: false,
          }
        : null)
    : undefined;

  const {
    author_tags, bookmark_id,
    orig_id, orig_public_id, orig_user_id, orig_username, orig_first_name, orig_last_name, orig_avatar,
    orig_content_html, orig_type, orig_skill_tag,
    orig_accepted_answer_id, orig_resolved_at, orig_created_at,
    orig_like_count, orig_comment_count,
    repost_count, reposted_by_me,
    ...rest
  } = p;
  // Reference the destructured-out fields so noUnusedLocals/lint stays quiet.
  void author_tags; void bookmark_id; void orig_user_id; void orig_username; void orig_first_name;
  void orig_last_name; void orig_avatar; void orig_content_html; void orig_type;
  void orig_skill_tag; void orig_accepted_answer_id; void orig_resolved_at; void orig_created_at;
  void orig_like_count; void orig_comment_count; void orig_id; void orig_public_id;

  return {
    ...normalizeAvatar(rest),
    image_paths: decodeImagePaths(rest.image_paths),
    like_count: parseInt(rest.like_count || 0),
    comment_count: parseInt(rest.comment_count || 0),
    liked_by_me: parseInt(rest.liked_by_me || 0) > 0,
    bookmarked_by_me: parseInt(rest.bookmarked_by_me || 0) > 0,
    is_following: parseInt(rest.is_following || 0) > 0,
    is_friend: parseInt(rest.is_friend || 0) > 0,
    repost_count: parseInt(repost_count || 0),
    reposted_by_me: parseInt(reposted_by_me || 0) > 0,
    repost_of,
    top_comments: [] as any[],
  };
}

/** Fetch one post in the full feed shape (incl. nested repost original + top
 *  comments) for a given viewer. Returns null if the id is gone. Used to return
 *  a freshly-created repost/quote to the client. */
async function fetchFeedPostById(viewerId: number, postId: number) {
  const rows = await query(`SELECT ${FEED_COLUMNS} ${FEED_FROM} WHERE p.id = ?`, [...feedColParams(viewerId), postId]);
  if (rows.length === 0) return null;
  const normalized = rows.map(normalizeFeedRow);
  await embedTopComments(viewerId, normalized);
  return normalized[0];
}

export type FeedTier = 'unseen' | 'seen';

export interface GetFeedOptions {
  tier?: FeedTier;
  cursor?: number | null; // keyset on posts.id (BIGINT AUTO_INCREMENT ⇒ monotonic with recency)
  limit?: number;
  filter?: string;
}

/**
 * The home feed, chat-style: serve UNSEEN posts first, then backfill SEEN ones.
 * "Seen" is a post_views row (seen=1) for this viewer — see markPostsSeen.
 *
 * Ordering / pagination contract:
 *  • Cursor is a single integer — the smallest posts.id already delivered. Since
 *    id is AUTO_INCREMENT, `id DESC` is recency order and `id < cursor` is a
 *    stable keyset page that never duplicates or skips under concurrent
 *    mark-seen (marking only ever removes rows from the unseen set, it never
 *    reshuffles the id-ordered tail).
 *  • Relevance scoring (tag match + ask freshness) is applied ONLY to the very
 *    first unseen "all" page (the landing screen). Every deeper page, the seen
 *    tier, and the help filters are plain recency keyset — keeping them stable.
 *  • Help filters are expressed in SQL (skill_tag is stored slugified, exactly
 *    like the viewer's tags) so they compose with keyset pagination.
 */
export async function getFeed(userId: number, opts: GetFeedOptions = {}) {
  const tier: FeedTier = opts.tier === 'seen' ? 'seen' : 'unseen';
  const limit = Math.min(Math.max(1, opts.limit ?? 10), 20);
  const cursor = opts.cursor && opts.cursor > 0 ? opts.cursor : null;
  const filter = opts.filter;

  const me = await queryOne<{ tags: any }>(`SELECT tags FROM users WHERE id = ?`, [userId]);
  const viewerTags = parseTagList(me?.tags);
  const viewerTagSet = new Set(viewerTags);

  const SELECT = `SELECT ${FEED_COLUMNS} ${FEED_FROM}`;
  const VISIBILITY = FEED_VISIBILITY;

  const SEEN = tier === 'seen'
    ? `EXISTS (SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.user_id = ? AND v.seen = 1)`
    : `NOT EXISTS (SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.user_id = ? AND v.seen = 1)`;

  // ? order: FEED_COLUMNS viewer cols (6) — liked, bookmarked, is_following,
  // is_friend×2, reposted_by_me — then visibility(5) + seen(1) = 12.
  const baseParams: any[] = [
    ...feedColParams(userId),
    userId, userId, userId, userId, userId, userId, // visibility(5) + seen(1)
  ];

  // Optional help views, in SQL so they stay keyset-stable.
  let filterSql = '';
  const filterParams: any[] = [];
  if (filter === 'help') {
    filterSql = ` AND p.type = 'ask'`;
  } else if (filter === 'help_matches') {
    // Open asks whose skill_tag matches one of the viewer's tags. No tags ⇒ none.
    if (viewerTags.length === 0) return { posts: [], next_cursor: null, has_more: false, tier };
    const ph = viewerTags.map(() => '?').join(',');
    filterSql = ` AND p.type = 'ask' AND p.resolved_at IS NULL AND p.skill_tag IN (${ph})`;
    filterParams.push(...viewerTags);
  }

  // A PLAIN repost (empty pointer: no text, no image) never appears in the home
  // feed — it surfaces on the reposter's profile instead, so the feed isn't
  // flooded with duplicates (Twitter-style). Quote reposts (text and/or image)
  // are real posts and stay.
  const HIDE_PLAIN_REPOST = ` AND NOT (p.repost_of IS NOT NULL AND p.content_html = '' AND p.image_path IS NULL)`;

  const isScoredFirstPage = tier === 'unseen' && !cursor && !filter;

  let rows: any[];
  let hasMore: boolean;

  if (isScoredFirstPage) {
    // Landing screen: rank a recency window in-memory by tag relevance + ask
    // freshness, then take the top `limit`.
    const window = await query(
      `${SELECT} WHERE ${VISIBILITY} AND ${SEEN}${HIDE_PLAIN_REPOST} ORDER BY p.id DESC LIMIT ${SCORED_WINDOW}`,
      baseParams
    );
    const scored = window
      .map((p) => {
        // Reposts ride recency only (no relevance boost) — the F2.8 tiebreak.
        if (p.repost_of) return { p, score: 0 };
        const postMatches = extractPostTags(p.content_html).filter((t) => viewerTagSet.has(t)).length;
        const authorMatches = parseTagList(p.author_tags).filter((t) => viewerTagSet.has(t)).length;
        let score = postMatches * 10 + authorMatches;
        if (p.type === 'ask' && !p.resolved_at) {
          const ageHours = (Date.now() - new Date(p.created_at).getTime()) / 3.6e6;
          const decay = Math.max(0, 1 - ageHours / 72);
          const skillMatch = p.skill_tag && viewerTagSet.has(slugifyTag(p.skill_tag));
          score += (skillMatch ? 30 : 8) * decay;
        } else if (p.type === 'ask' && p.resolved_at) {
          score -= 5;
        }
        return { p, score };
      })
      .sort((a, b) =>
        b.score - a.score ||
        Number(b.p.id) - Number(a.p.id)
      );
    rows = scored.slice(0, limit).map((s) => s.p);
    hasMore = scored.length > limit;
  } else {
    // Recency keyset page (deeper unseen, the whole seen tier, and filtered views).
    let keysetSql = '';
    const keysetParams: any[] = [];
    if (cursor) {
      keysetSql = ` AND p.id < ?`;
      keysetParams.push(cursor);
    }
    rows = await query(
      `${SELECT} WHERE ${VISIBILITY} AND ${SEEN}${HIDE_PLAIN_REPOST}${filterSql}${keysetSql}
       ORDER BY p.id DESC LIMIT ${limit}`,
      [...baseParams, ...filterParams, ...keysetParams]
    );
    hasMore = rows.length === limit;
  }

  const normalized = rows.map(normalizeFeedRow);

  await embedTopComments(userId, normalized);

  // Cursor for the next page is the smallest id we just delivered.
  const next_cursor = hasMore && normalized.length
    ? Math.min(...normalized.map((p) => Number(p.id)))
    : null;

  return { posts: normalized, next_cursor, has_more: hasMore, tier };
}

export interface GetSavedOptions {
  cursor?: number | null; // keyset on post_bookmarks.id (newest-saved-first)
  limit?: number;
}

/**
 * The viewer's bookmarked posts, newest-saved-first, keyset-paginated on
 * post_bookmarks.id. Re-applies the SAME visibility rule as the feed (public,
 * own, or friends/follows-only that the viewer still has access to) — so a post
 * the viewer has since lost access to, or that was deleted, silently drops out
 * instead of leaking (the INNER JOIN already excludes deleted posts). All rows
 * are bookmarked by definition, so bookmarked_by_me is a literal 1.
 */
export async function getSaved(userId: number, opts: GetSavedOptions = {}) {
  const limit = Math.min(Math.max(1, opts.limit ?? 10), 20);
  const cursor = opts.cursor && opts.cursor > 0 ? opts.cursor : null;

  // Same per-viewer column shape as the feed (incl. nested repost original), but
  // sourced from the bookmark join so saved reposts render identically.
  const SELECT = `SELECT ${FEED_COLUMNS}, b.id AS bookmark_id
    FROM post_bookmarks b
    JOIN posts p ON p.id = b.post_id
    JOIN users u ON u.id = p.user_id
    LEFT JOIN posts orig ON orig.id = p.repost_of
    LEFT JOIN users ou ON ou.id = orig.user_id`;

  const VISIBILITY = FEED_VISIBILITY;

  // ? order: FEED_COLUMNS viewer cols (6), bookmark filter(1), visibility(5),
  // keyset(0..1).
  const params: number[] = [...feedColParams(userId), userId, userId, userId, userId, userId, userId];
  let keysetSql = '';
  if (cursor) { keysetSql = ` AND b.id < ?`; params.push(cursor); }

  const rows = await query(
    `${SELECT}
     WHERE b.user_id = ? AND ${VISIBILITY}${keysetSql}
     ORDER BY b.id DESC LIMIT ${limit}`,
    params
  );

  const hasMore = rows.length === limit;
  // Next cursor is the smallest bookmark id in this page (keyset on b.id DESC).
  // Read from the raw rows before bookmark_id is dropped from the wire shape.
  const next_cursor = hasMore && rows.length
    ? Math.min(...rows.map((r) => Number(r.bookmark_id)))
    : null;

  // Every row is saved by definition, so force bookmarked_by_me regardless of
  // what the shared column computed.
  const normalized = rows.map((p) => ({ ...normalizeFeedRow(p), bookmarked_by_me: true }));

  await embedTopComments(userId, normalized);

  return { posts: normalized, next_cursor, has_more: hasMore };
}

/**
 * Chat-style read receipt: mark a batch of posts as seen by this viewer. Upserts
 * one post_views row per (post, viewer) so the unseen-first feed stops surfacing
 * them. Bounded (≤50/call) and id-sanitized; visibility isn't re-checked because
 * a seen row for an invisible post is harmless. Returns how many were marked.
 */
export async function markPostsSeen(userId: number, postIds: number[]): Promise<{ marked: number }> {
  const ids = Array.from(
    new Set((postIds || []).map((n) => parseInt(String(n), 10)).filter((n) => Number.isInteger(n) && n > 0))
  ).slice(0, 50);
  if (ids.length === 0) return { marked: 0 };

  const values = ids.map(() => '(?, ?, 1)').join(', ');
  const params: any[] = [];
  for (const id of ids) params.push(id, userId);

  await execute(
    `INSERT INTO post_views (post_id, user_id, seen) VALUES ${values}
     ON DUPLICATE KEY UPDATE seen = 1, seen_at = CURRENT_TIMESTAMP`,
    params
  );
  return { marked: ids.length };
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
