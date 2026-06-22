import { NextResponse } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';
import { withAuth } from '@/lib/api-auth';
import { query, queryOne, execute } from '@/lib/db';
import { DEFAULT_AVATAR } from '@/lib/models/user';
import { processImageUpload, deleteUploadFile, ImageUploadError } from '@/lib/uploads';

// Allowlist sanitizer for composer HTML that is later rendered via
// dangerouslySetInnerHTML. Permits only the formatting tags the toolbar emits
// (bold / italic / underline / lists) plus the mention & hashtag pill spans;
// data-* attributes survive (DOMPurify's ALLOW_DATA_ATTR default) so the feed's
// extractPostTags can still read data-tag. DOMPurify strips scripts, inline
// event handlers, javascript: URIs and contenteditable. Input is capped first so
// truncation can never leave a half-open tag.
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
// data-tag="uiux"), so viewer tags and in-post hashtags compare apples-to-apples.
function slugifyTag(t: any): string {
  return String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Parse a users.tags JSON value (string or array) into a slug list.
function parseTagList(raw: any): string[] {
  let arr: any = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { arr = []; } }
  return Array.isArray(arr) ? arr.map(slugifyTag).filter(Boolean) : [];
}

// Extract the hashtag slugs written inside a post's HTML (the data-tag pills).
function extractPostTags(html: string): string[] {
  const out: string[] = [];
  const re = /data-tag="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html || '')) !== null) out.push(slugifyTag(m[1]));
  return out;
}

export const POST = withAuth(async (request, user) => {
  // Post creation arrives as multipart/form-data (it may carry an image File);
  // every other action stays JSON. Parse the body once accordingly so it is
  // never read twice.
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');
  let imageFile: File | null = null;
  let body;
  if (isMultipart) {
    const formData = await request.formData();
    imageFile = formData.get('image') as File | null;
    body = {
      action: 'create',
      content_html: formData.get('content_html'),
      visibility: formData.get('visibility'),
    };
  } else {
    body = await request.json().catch(() => ({}));
  }
  const action = body.action || 'create';

  // ── Create post ─────────────────────────────────────────
  if (action === 'create') {
    const raw = (body.content_html || '').trim();
    const hasImage = !!(imageFile && imageFile.size > 0);
    // A post needs either text or an image — image-only posts are valid.
    if (!raw && !hasImage) {
      return NextResponse.json({ success: false, message: 'Content or image required' }, { status: 400 });
    }

    const content_html = sanitizeHtml(raw);
    const allowedVisibility = ['friends', 'public', 'exclusive'];
    const visibility = allowedVisibility.includes(body.visibility) ? body.visibility : 'friends';

    let image_path: string | null = null;
    if (hasImage) {
      try {
        image_path = await processImageUpload(imageFile!, {
          subdir: 'posts',
          filenamePrefix: 'post',
          maxBytes: 5 * 1024 * 1024,
          maxDimension: 1600,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        });
      } catch (err) {
        if (err instanceof ImageUploadError) {
          return NextResponse.json({ success: false, message: err.message }, { status: 400 });
        }
        throw err;
      }
    }

    const result = await execute(
      `INSERT INTO posts (user_id, content_html, visibility, image_path) VALUES (?, ?, ?, ?)`,
      [user.id, content_html, visibility, image_path]
    );

    const post = await queryOne(
      `SELECT p.id, p.user_id, p.content_html, p.image_path, p.visibility, p.created_at,
              u.username, u.first_name, u.last_name, u.avatar,
              0 AS like_count, 0 AS comment_count, 0 AS liked_by_me
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
      [result.insertId]
    );

    return NextResponse.json({ success: true, post: normalizeAvatar(post) });
  }

  // ── Toggle like ──────────────────────────────────────────
  if (action === 'like') {
    const post_id = parseInt(body.post_id || 0);
    if (!post_id) return NextResponse.json({ success: false, message: 'post_id required' }, { status: 400 });

    const existing = await queryOne(
      `SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [post_id, user.id]
    );

    if (existing) {
      await execute(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, [post_id, user.id]);
      return NextResponse.json({ success: true, liked: false });
    } else {
      await execute(`INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)`, [post_id, user.id]);
      return NextResponse.json({ success: true, liked: true });
    }
  }

  // ── Toggle comment upvote ────────────────────────────────
  if (action === 'comment_vote') {
    const comment_id = parseInt(body.comment_id || 0);
    if (!comment_id) return NextResponse.json({ success: false, message: 'comment_id required' }, { status: 400 });

    const existing = await queryOne(
      `SELECT id FROM comment_votes WHERE comment_id = ? AND user_id = ?`,
      [comment_id, user.id]
    );

    if (existing) {
      await execute(`DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?`, [comment_id, user.id]);
      return NextResponse.json({ success: true, upvoted: false });
    } else {
      await execute(`INSERT INTO comment_votes (comment_id, user_id) VALUES (?, ?)`, [comment_id, user.id]);
      return NextResponse.json({ success: true, upvoted: true });
    }
  }

  // ── Edit own comment ─────────────────────────────────────
  if (action === 'comment_edit') {
    const comment_id = parseInt(body.comment_id || 0);
    const content = (body.content || '').trim().slice(0, 1000);
    if (!comment_id || !content) return NextResponse.json({ success: false, message: 'comment_id and content required' }, { status: 400 });

    const owned = await queryOne(`SELECT id FROM post_comments WHERE id = ? AND user_id = ?`, [comment_id, user.id]);
    if (!owned) return NextResponse.json({ success: false, message: 'Not found or not yours' }, { status: 403 });

    await execute(`UPDATE post_comments SET content = ? WHERE id = ? AND user_id = ?`, [content, comment_id, user.id]);
    return NextResponse.json({ success: true, content });
  }

  // ── Delete own comment (cascades to replies + votes) ──────
  if (action === 'comment_delete') {
    const comment_id = parseInt(body.comment_id || 0);
    if (!comment_id) return NextResponse.json({ success: false, message: 'comment_id required' }, { status: 400 });

    const owned = await queryOne(`SELECT id FROM post_comments WHERE id = ? AND user_id = ?`, [comment_id, user.id]);
    if (!owned) return NextResponse.json({ success: false, message: 'Not found or not yours' }, { status: 403 });

    // Walk the reply tree so deleting a parent also removes its thread.
    const ids: number[] = [comment_id];
    let frontier: number[] = [comment_id];
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

    return NextResponse.json({ success: true, deleted_ids: ids });
  }

  // ── Delete post ──────────────────────────────────────────
  if (action === 'delete') {
    const post_id = parseInt(body.post_id || 0);
    if (!post_id) return NextResponse.json({ success: false, message: 'post_id required' }, { status: 400 });

    const owned = await queryOne<{ image_path: string | null }>(
      `SELECT image_path FROM posts WHERE id = ? AND user_id = ?`,
      [post_id, user.id]
    );
    if (!owned) return NextResponse.json({ success: false, message: 'Not found or not yours' }, { status: 403 });

    await execute(`DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM post_comments WHERE post_id = ?)`, [post_id]);
    await execute(`DELETE FROM post_likes    WHERE post_id = ?`, [post_id]);
    await execute(`DELETE FROM post_comments WHERE post_id = ?`, [post_id]);
    await execute(`DELETE FROM posts         WHERE id = ? AND user_id = ?`, [post_id, user.id]);

    // Remove the orphaned image file from disk (mirrors avatar cleanup).
    deleteUploadFile(owned.image_path);

    return NextResponse.json({ success: true });
  }

  // ── Add comment ──────────────────────────────────────────
  if (action === 'comment') {
    const post_id = parseInt(body.post_id || 0);
    const content = (body.content || '').trim().slice(0, 1000);
    const parent_id = body.parent_id ? parseInt(body.parent_id) : null;
    if (!post_id || !content) return NextResponse.json({ success: false, message: 'post_id and content required' }, { status: 400 });

    if (parent_id) {
      const parent = await queryOne(`SELECT id FROM post_comments WHERE id = ? AND post_id = ?`, [parent_id, post_id]);
      if (!parent) return NextResponse.json({ success: false, message: 'Parent comment not found' }, { status: 404 });
    }

    const result = await execute(
      `INSERT INTO post_comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)`,
      [post_id, user.id, content, parent_id]
    );

    const comment = await queryOne(
      `SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
              u.username, u.first_name, u.last_name, u.avatar
       FROM post_comments c JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [result.insertId]
    );

    return NextResponse.json({
      success: true,
      comment: { ...normalizeAvatar(comment), upvote_count: 0, upvoted_by_me: false },
    });
  }

  return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
});

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

  // ── Feed ─────────────────────────────────────────────────
  // Shows every PUBLIC post (from anyone) plus your own and friends-only /
  // follows posts from people you're connected to. Ranked by how well the
  // tags written inside each post match your own tags, then by recency.
  if (action === 'feed') {
    const FEED_WINDOW = 300; // candidate pool we rank in-memory

    const me = await queryOne<{ tags: any }>(`SELECT tags FROM users WHERE id = ?`, [user.id]);
    const viewerTags = new Set(parseTagList(me?.tags));

    const candidates = await query(
      `SELECT p.id, p.user_id, p.content_html, p.image_path, p.visibility, p.created_at,
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
      [user.id, user.id, user.id, user.id, user.id, user.id]
    );

    // Score: in-post hashtags weigh heaviest, author's profile tags break ties,
    // then most-recent wins. id is the final deterministic tiebreaker so the
    // offset pagination stays stable between requests.
    const scored = candidates
      .map((p) => {
        const postMatches = extractPostTags(p.content_html).filter((t) => viewerTags.has(t)).length;
        const authorMatches = parseTagList(p.author_tags).filter((t) => viewerTags.has(t)).length;
        return { p, score: postMatches * 10 + authorMatches };
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

    // Embed the top-2 root comments per post so the feed paints its always-visible
    // comment layers without a per-card waterfall. One windowed query over the
    // whole page slice (rn <= 2), then grouped back onto each post in memory.
    const pageIds = normalized.map((p) => p.id);
    if (pageIds.length > 0) {
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
        [user.id, ...pageIds]
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
      for (const p of normalized) p.top_comments = byPost.get(Number(p.id)) ?? [];
      } catch (e) {
        // Non-fatal: the feed still renders without embedded comment previews.
        console.error('feed top_comments embed failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      posts: normalized,
      has_more: offset + limit < scored.length,
    });
  }

  // ── Comments for a post ───────────────────────────────────
  if (action === 'comments') {
    const post_id = parseInt(searchParams.get('post_id') || '0');
    if (!post_id) return NextResponse.json({ success: false, message: 'post_id required' }, { status: 400 });

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
      [user.id, post_id]
    );

    const normalizedComments = comments.map((c) => ({
      ...normalizeAvatar(c),
      upvote_count: parseInt(c.upvote_count || 0),
      upvoted_by_me: parseInt(c.upvoted_by_me || 0) > 0,
    }));

    return NextResponse.json({ success: true, comments: normalizedComments });
  }

  // ── Top 2 comments for hover preview ─────────────────────────
  if (action === 'top_comments') {
    const post_id = parseInt(searchParams.get('post_id') || '0');
    if (!post_id) return NextResponse.json({ success: false, message: 'post_id required' }, { status: 400 });

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
      [user.id, post_id]
    );

    return NextResponse.json({
      success: true,
      comments: comments.map((c: any) => ({
        ...normalizeAvatar(c),
        upvote_count: parseInt(c.upvote_count || 0),
        upvoted_by_me: parseInt(c.upvoted_by_me || 0) > 0,
      })),
    });
  }

  return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
});

export const dynamic = 'force-dynamic';
