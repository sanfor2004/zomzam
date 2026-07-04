import DOMPurify from 'isomorphic-dompurify';
import { queryOne, execute } from '@/lib/db';
import { logUserChange } from '@/lib/models/audit';
import { HttpError } from '@/lib/http-error';
import { processImageUpload, deleteUploadFile, ImageUploadError } from '@/lib/uploads';
import {
  newPublicId, normalizeAvatar, slugifyTag,
  encodeImagePaths, decodeImagePaths, MAX_POST_IMAGES,
} from './shared';
import { resolveRepostTarget } from './reposts';
import { fetchFeedPostById } from './feed';

// Post create / edit / delete — the author-owned write path, including the quote
// repost branch (collapses to its root via resolveRepostTarget) and the image
// pipeline (sanitize, validate, store, orphan-cleanup). Plain repost toggles live
// in reposts.ts; the feed read shape used to return a fresh quote lives in feed.ts.

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

/** Coalesce the legacy `imageFile` + new `imageFiles` inputs into one ordered,
 *  non-empty File list, capped at MAX_POST_IMAGES. Drops nulls/empty files. */
function selectImageFiles(input: { imageFiles?: (File | null)[]; imageFile?: File | null }): File[] {
  const raw = input.imageFiles?.length ? input.imageFiles : (input.imageFile ? [input.imageFile] : []);
  return raw.filter((f): f is File => !!f && f.size > 0).slice(0, MAX_POST_IMAGES);
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

export async function deletePost(userId: number, postId: number): Promise<void> {
  if (!postId) throw new HttpError(400, 'post_id required');

  // Pull the body/visibility too — it's kept verbatim in the safety trail below
  // (the row is about to be gone, so the log is the only remaining record of it).
  const owned = await queryOne<{ content_html: string; visibility: string; image_path: string | null; image_paths: unknown }>(
    `SELECT content_html, visibility, image_path, image_paths FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!owned) throw new HttpError(403, 'Not found or not yours');

  const blobs = decodeImagePaths(owned.image_paths);

  // Moderation trail — record the removed post's content before it's gone.
  // Best-effort (logUserChange swallows its own errors) so it never blocks the delete.
  await logUserChange({
    userId,
    action: 'post_deleted',
    content: owned.content_html,
    metadata: { post_id: postId, visibility: owned.visibility, image_paths: blobs },
  });

  await execute(`DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM post_comments WHERE post_id = ?)`, [postId]);
  await execute(`DELETE FROM post_likes    WHERE post_id = ?`, [postId]);
  await execute(`DELETE FROM post_comments WHERE post_id = ?`, [postId]);
  await execute(`DELETE FROM posts         WHERE id = ? AND user_id = ?`, [postId, userId]);

  // Remove every orphaned image blob (mirrors avatar cleanup). Multi-image rows
  // store the full list in image_paths; legacy rows fall back to image_path.
  for (const file of (blobs.length ? blobs : [owned.image_path])) await deleteUploadFile(file);
}
