import { query, queryOne, execute } from '@/lib/db';
import { DEFAULT_AVATAR } from '@/lib/models/user';
import { normalizeAvatar, shapeComment, slugifyTag, parseTagList, decodeImagePaths, CONNECTED_USERS_JOIN } from './shared';

// Feed reads: the home feed (tiered unseen→seen, relevance-scored first page),
// the /saved bookmark list, the single-post fetch used to hydrate a freshly
// created quote, the read-receipt writer, and the connection audience for the
// live "new posts" pill. The shared FEED_* SQL fragments below are the one source
// of truth for the per-post wire shape across every feed-style surface.

const SCORED_WINDOW = 300; // candidate pool ranked in-memory for the landing page

function extractPostTags(html: string): string[] {
  const out: string[] = [];
  const re = /data-tag="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html || '')) !== null) out.push(slugifyTag(m[1]));
  return out;
}

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

// A plain repost (empty pointer: repost_of set, no text AND no image) is never a
// standalone post — it only boosts its original in the feed (collapsed) and shows
// on the reposter's profile. So it must never appear as its own row on /saved
// either. Quote reposts (text and/or image) and normal posts pass. The home feed
// FETCHES plain reposts on purpose (collapse re-floats their original), so this
// guard is scoped to /saved, which has no collapse pass.
const NOT_PLAIN_REPOST = `(p.repost_of IS NULL OR p.content_html <> '' OR p.image_path IS NOT NULL)`;

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
    _reposted_by, _repost_seen_ids,
    ...rest
  } = p;
  // Reference the destructured-out fields so noUnusedLocals/lint stays quiet.
  void author_tags; void bookmark_id; void orig_user_id; void orig_username; void orig_first_name;
  void orig_last_name; void orig_avatar; void orig_content_html; void orig_type;
  void orig_skill_tag; void orig_accepted_answer_id; void orig_resolved_at; void orig_created_at;
  void orig_like_count; void orig_comment_count; void orig_id; void orig_public_id;

  // Twitter-style boost attribution attached by collapsePlainReposts (absent on a
  // normal/quote card). Cap the named reposters for the label; keep the full total.
  const reposters: any[] = Array.isArray(_reposted_by) ? _reposted_by : [];
  const reposted_by = reposters.length
    ? { users: reposters.slice(0, 3).map((u: any) => ({ username: u.username, first_name: u.first_name, last_name: u.last_name })), total: reposters.length }
    : undefined;

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
    reposted_by,
    repost_seen_ids: Array.isArray(_repost_seen_ids) ? _repost_seen_ids : undefined,
    top_comments: [] as any[],
  };
}

// A PLAIN repost is the empty pointer row: repost_of set, no text AND no image.
// (An image-only quote has content_html='' but image_path set, so it is NOT plain.)
// Mirrors the predicate in reposts.ts toggleRepost.
function isPlainRepostRow(r: any): boolean {
  return r.repost_of != null && !(r.content_html || '').trim() && !r.image_path;
}

/**
 * Twitter-style repost collapse. A plain repost (empty pointer) must NOT render as
 * its own empty reposter card; instead its ORIGINAL surfaces with a "<reposter>
 * reposted" label. This runs AFTER the page rows are fetched, so the feed's
 * recency ordering / keyset cursor (which advance over the raw posts.id stream)
 * are untouched — the pointer row's fresh id still floats its original up (the
 * reach boost).
 *
 * For each plain-repost row it substitutes the ORIGINAL post (full viewer state —
 * fetched in one batched query when the original isn't already on the page), so
 * like/bookmark/comment target the original, not the empty pointer. Multiple
 * reposts of the same original — and an original that ALSO appears on its own —
 * collapse to ONE card at the highest (most recent) position, with the reposters
 * aggregated into `_reposted_by`. Each absorbed pointer id rides along in
 * `_repost_seen_ids` so the viewer's read-receipt marks it seen and the boost
 * doesn't loop. A plain repost of a deleted/invisible original is dropped (no
 * feed tombstone — that's a quote-only affordance). Quote reposts are untouched.
 *
 * ponytail: dedup is per-page; an original boosted on one page can still re-appear
 * via its own recency on a deeper page, but the client feed already de-dups by
 * post id across pages, so it never double-renders. Cross-page collapse would need
 * stateful cursors — not worth it until it measurably matters.
 */
async function collapsePlainReposts(userId: number, rows: any[]): Promise<any[]> {
  if (!rows.some(isPlainRepostRow)) return rows; // fast path: no plain reposts

  // Originals already on the page are reused directly; the rest are fetched once.
  const byId = new Map<number, any>();
  for (const r of rows) if (!isPlainRepostRow(r)) byId.set(Number(r.id), r);

  const missing = new Set<number>();
  for (const r of rows) {
    if (isPlainRepostRow(r)) {
      const oid = Number(r.repost_of);
      if (!byId.has(oid)) missing.add(oid);
    }
  }
  if (missing.size) {
    const ids = [...missing];
    const ph = ids.map(() => '?').join(',');
    const fetched = await query(
      `SELECT ${FEED_COLUMNS} ${FEED_FROM} WHERE p.id IN (${ph})`,
      [...feedColParams(userId), ...ids]
    );
    for (const o of fetched) byId.set(Number(o.id), o);
  }

  const reposterOf = (r: any) => ({ username: r.username, first_name: r.first_name, last_name: r.last_name });

  const out: any[] = [];
  const emitted = new Map<number, any>(); // effective post id → the row already placed
  for (const r of rows) {
    const plain = isPlainRepostRow(r);
    const effId = plain ? Number(r.repost_of) : Number(r.id);
    const subject = plain ? byId.get(effId) : r;
    if (!subject) continue; // plain repost of a gone/invisible original → drop the boost

    let card = emitted.get(effId);
    if (!card) {
      // Clone a substituted original (it may be shared via byId); a direct row is
      // emitted as-is.
      card = plain ? { ...subject } : subject;
      out.push(card);
      emitted.set(effId, card);
    }
    if (plain) {
      (card._reposted_by ??= []).push(reposterOf(r));
      (card._repost_seen_ids ??= []).push(Number(r.id));
    }
  }
  return out;
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
      list.push(shapeComment(row));
      byPost.set(Number(row.post_id), list);
    }
    for (const p of posts) p.top_comments = byPost.get(Number(p.id)) ?? [];
  } catch (e) {
    // Non-fatal: the feed still renders without embedded comment previews.
    console.error('feed top_comments embed failed:', e);
  }
}

/** Fetch one post in the full feed shape (incl. nested repost original + top
 *  comments) for a given viewer. Returns null if the id is gone. Used by
 *  crud.createPost to return a freshly-created quote in the wire shape. */
export async function fetchFeedPostById(viewerId: number, postId: number) {
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

  // Plain reposts are FETCHED into the page (the pointer row's fresh id makes
  // `id DESC` recency float its original back to the top — the reach boost), but
  // they never render as their own empty card: collapsePlainReposts (below)
  // substitutes the ORIGINAL with a "<reposter> reposted" label and de-dups
  // multiple reposters to ONE card. Quote reposts stay their own cards. The
  // scoring window keeps a repost recency-only (no relevance boost).
  const isScoredFirstPage = tier === 'unseen' && !cursor && !filter;

  let rows: any[];
  let hasMore: boolean;

  if (isScoredFirstPage) {
    // Landing screen: rank a recency window in-memory by tag relevance + ask
    // freshness, then take the top `limit`.
    const window = await query(
      `${SELECT} WHERE ${VISIBILITY} AND ${SEEN} ORDER BY p.id DESC LIMIT ${SCORED_WINDOW}`,
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
      `${SELECT} WHERE ${VISIBILITY} AND ${SEEN}${filterSql}${keysetSql}
       ORDER BY p.id DESC LIMIT ${limit}`,
      [...baseParams, ...filterParams, ...keysetParams]
    );
    hasMore = rows.length === limit;
  }

  // The keyset cursor advances over the RAW rows fetched (real posts.id values,
  // incl. plain-repost pointers), computed BEFORE collapse — otherwise a boosted
  // original's low id would seed the next page and skip the rows between.
  const next_cursor = hasMore && rows.length
    ? Math.min(...rows.map((r) => Number(r.id)))
    : null;

  const normalized = (await collapsePlainReposts(userId, rows)).map(normalizeFeedRow);
  await embedTopComments(userId, normalized);

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
     WHERE b.user_id = ? AND ${VISIBILITY} AND ${NOT_PLAIN_REPOST}${keysetSql}
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
     FROM users u${CONNECTED_USERS_JOIN}
     WHERE u.id <> ?`,
    [authorId, authorId, authorId, authorId]
  );
  return rows.map((r) => Number(r.id));
}
