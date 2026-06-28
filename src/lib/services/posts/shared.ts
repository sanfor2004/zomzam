import crypto from 'crypto';
import { DEFAULT_AVATAR } from '@/lib/models/user';

// Pure, db-free helpers shared by two or more posts-service modules (crud / feed
// / comments / reposts / asks). Nothing here queries the database or imports a
// sibling module, so this file sits at the bottom of the dependency graph and can
// never take part in an import cycle. A helper used by only ONE module lives with
// that module instead (e.g. the image pipeline in crud.ts, the feed SQL in feed.ts).

export function normalizeAvatar(row: any) {
  return { ...row, avatar: row.avatar || DEFAULT_AVATAR };
}

// Shape a raw comment row into the wire form: default avatar + the two vote
// fields coerced (count → int, upvoted_by_me → bool). Shared by the single-post
// comment reads and the batched feed-preview embed so the shape can't drift.
export function shapeComment(c: any) {
  return {
    ...normalizeAvatar(c),
    upvote_count: parseInt(c.upvote_count || 0),
    upvoted_by_me: parseInt(c.upvoted_by_me || 0) > 0,
  };
}

// Opaque public identifier for the /p/ permalink. MD5 of 16 random bytes — 32
// hex chars, unguessable and NOT derived from the sequential post id, so the
// permalink can't be walked (md5(1), md5(2), …) to enumerate or count posts.
export function newPublicId(): string {
  return crypto.createHash('md5').update(crypto.randomBytes(16)).digest('hex');
}

// Normalize a tag to its hashtag slug form (the composer stores #UI/UX as
// data-tag="uiux") so viewer tags and in-post hashtags compare apples-to-apples.
export function slugifyTag(t: any): string {
  return String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseTagList(raw: any): string[] {
  let arr: any = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { arr = []; } }
  return Array.isArray(arr) ? arr.map(slugifyTag).filter(Boolean) : [];
}

/** Encode a JSON image array for the `image_paths` column, or null when empty
 *  so a no-image post stores SQL NULL (not "[]"). */
export function encodeImagePaths(paths: string[]): string | null {
  return paths.length ? JSON.stringify(paths) : null;
}

/** Decode the `image_paths` column back to a string[]. mysql2 hands JSON columns
 *  back already-parsed, but tolerate a raw string (or absent column) defensively. */
export function decodeImagePaths(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === 'string');
  if (typeof raw === 'string' && raw.trim()) {
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((s) => typeof s === 'string') : []; }
    catch { return []; }
  }
  return [];
}

// Product cap: a post (or quote) carries at most this many images. Enforced
// server-side here even though the composer also limits it — never trust client.
export const MAX_POST_IMAGES = 3;

// The one definition of "users connected to a subject user": accepted friends
// (either direction) OR followers (they follow the subject). A JOIN fragment so
// the connection rule lives in exactly one place across the ask-notify and
// feed-audience reads. Use as `FROM users u${CONNECTED_USERS_JOIN} WHERE u.id <> ?`
// and pass four copies of the subject-user id (friend-requester, friend-addressee,
// follow-addressee, then the `u.id <> ?` exclusion).
export const CONNECTED_USERS_JOIN = `
     JOIN user_connections c ON (
       (c.type = 'friend' AND c.status = 'accepted'
          AND ((c.requester_id = ? AND c.addressee_id = u.id)
               OR (c.addressee_id = ? AND c.requester_id = u.id)))
       OR (c.type = 'follow' AND c.status = 'accepted' AND c.addressee_id = ? AND c.requester_id = u.id)
     )`;
