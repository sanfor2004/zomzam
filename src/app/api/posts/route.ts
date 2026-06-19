import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { DEFAULT_AVATAR } from '@/lib/models/user';

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      content_html TEXT NOT NULL,
      created_at DATETIME DEFAULT NOW(),
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      post_id BIGINT UNSIGNED NOT NULL,
      user_id INT NOT NULL,
      created_at DATETIME DEFAULT NOW(),
      UNIQUE KEY uq_post_user (post_id, user_id),
      INDEX idx_post_id (post_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      post_id BIGINT UNSIGNED NOT NULL,
      user_id INT NOT NULL,
      content VARCHAR(1000) NOT NULL,
      created_at DATETIME DEFAULT NOW(),
      INDEX idx_post_id (post_id),
      INDEX idx_created_at (created_at ASC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS comment_votes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      comment_id BIGINT UNSIGNED NOT NULL,
      user_id INT NOT NULL,
      created_at DATETIME DEFAULT NOW(),
      UNIQUE KEY uq_comment_user (comment_id, user_id),
      INDEX idx_comment_id (comment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const dbName = process.env.DB_NAME || 'zomzam_db';
  const hasParentId = await queryOne(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='post_comments' AND COLUMN_NAME='parent_id'`,
    [dbName]
  );
  if (!hasParentId) {
    await execute(`ALTER TABLE post_comments ADD COLUMN parent_id BIGINT UNSIGNED NULL DEFAULT NULL`);
    await execute(`ALTER TABLE post_comments ADD INDEX idx_parent_id (parent_id)`);
  }
  const hasVisibility = await queryOne(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='posts' AND COLUMN_NAME='visibility'`,
    [dbName]
  );
  if (!hasVisibility) {
    await execute(
      `ALTER TABLE posts ADD COLUMN visibility ENUM('friends','public','exclusive') NOT NULL DEFAULT 'friends'`
    );
  }
  tablesReady = true;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/\scontenteditable="false"/gi, '')
    .slice(0, 10000);
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

export async function POST(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    await ensureTables();
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'create';

    // ── Create post ─────────────────────────────────────────
    if (action === 'create') {
      const raw = (body.content_html || '').trim();
      if (!raw) return NextResponse.json({ success: false, message: 'Content required' }, { status: 400 });

      const content_html = sanitizeHtml(raw);
      const allowedVisibility = ['friends', 'public', 'exclusive'];
      const visibility = allowedVisibility.includes(body.visibility) ? body.visibility : 'friends';
      const result = await execute(
        `INSERT INTO posts (user_id, content_html, visibility) VALUES (?, ?, ?)`,
        [user.id, content_html, visibility]
      );

      const post = await queryOne(
        `SELECT p.id, p.user_id, p.content_html, p.visibility, p.created_at,
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

      const owned = await queryOne(
        `SELECT id FROM posts WHERE id = ? AND user_id = ?`,
        [post_id, user.id]
      );
      if (!owned) return NextResponse.json({ success: false, message: 'Not found or not yours' }, { status: 403 });

      await execute(`DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM post_comments WHERE post_id = ?)`, [post_id]);
      await execute(`DELETE FROM post_likes    WHERE post_id = ?`, [post_id]);
      await execute(`DELETE FROM post_comments WHERE post_id = ?`, [post_id]);
      await execute(`DELETE FROM posts         WHERE id = ? AND user_id = ?`, [post_id, user.id]);

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
  } catch (error: any) {
    console.error('Posts POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

  try {
    await ensureTables();

    // ── Feed ─────────────────────────────────────────────────
    // Shows every PUBLIC post (from anyone) plus your own and friends-only /
    // follows posts from people you're connected to. Ranked by how well the
    // tags written inside each post match your own tags, then by recency.
    if (action === 'feed') {
      const FEED_WINDOW = 300; // candidate pool we rank in-memory

      const me = await queryOne<{ tags: any }>(`SELECT tags FROM users WHERE id = ?`, [user.id]);
      const viewerTags = new Set(parseTagList(me?.tags));

      const candidates = await query(
        `SELECT p.id, p.user_id, p.content_html, p.visibility, p.created_at,
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
        };
      });

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
  } catch (error: any) {
    console.error('Posts GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
