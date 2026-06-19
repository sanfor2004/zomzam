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

    // ── Delete post ──────────────────────────────────────────
    if (action === 'delete') {
      const post_id = parseInt(body.post_id || 0);
      if (!post_id) return NextResponse.json({ success: false, message: 'post_id required' }, { status: 400 });

      const owned = await queryOne(
        `SELECT id FROM posts WHERE id = ? AND user_id = ?`,
        [post_id, user.id]
      );
      if (!owned) return NextResponse.json({ success: false, message: 'Not found or not yours' }, { status: 403 });

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

      return NextResponse.json({ success: true, comment: normalizeAvatar(comment) });
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
  const beforeId = parseInt(searchParams.get('before_id') || '0');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

  try {
    await ensureTables();

    // ── Feed ─────────────────────────────────────────────────
    if (action === 'feed') {
      const params: any[] = [user.id, user.id, user.id, user.id, user.id, user.id];
      if (beforeId > 0) params.push(beforeId);

      const posts = await query(
        `SELECT p.id, p.user_id, p.content_html, p.visibility, p.created_at,
                u.username, u.first_name, u.last_name, u.avatar,
                (SELECT COUNT(*) FROM post_likes   WHERE post_id = p.id) AS like_count,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,
                (SELECT COUNT(*) FROM post_likes   WHERE post_id = p.id AND user_id = ?) AS liked_by_me
         FROM posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.user_id IN (
           SELECT addressee_id FROM user_connections
             WHERE requester_id = ? AND type = 'follow' AND status = 'accepted'
           UNION
           SELECT IF(requester_id = ?, addressee_id, requester_id) FROM user_connections
             WHERE (requester_id = ? OR addressee_id = ?) AND type = 'friend' AND status = 'accepted'
           UNION SELECT ?
         )
         ${beforeId > 0 ? 'AND p.id < ?' : ''}
         ORDER BY p.created_at DESC
         LIMIT ${limit}`,
        params
      );

      const normalized = posts.map((p) => ({
        ...normalizeAvatar(p),
        like_count: parseInt(p.like_count || 0),
        comment_count: parseInt(p.comment_count || 0),
        liked_by_me: parseInt(p.liked_by_me || 0) > 0,
      }));

      return NextResponse.json({ success: true, posts: normalized, has_more: posts.length === limit });
    }

    // ── Comments for a post ───────────────────────────────────
    if (action === 'comments') {
      const post_id = parseInt(searchParams.get('post_id') || '0');
      if (!post_id) return NextResponse.json({ success: false, message: 'post_id required' }, { status: 400 });

      const comments = await query(
        `SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
                u.username, u.first_name, u.last_name, u.avatar
         FROM post_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC
         LIMIT 100`,
        [post_id]
      );

      return NextResponse.json({ success: true, comments: comments.map(normalizeAvatar) });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Posts GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
