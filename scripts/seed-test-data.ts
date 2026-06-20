/**
 * Seed realistic test data for the social/community features.
 *
 *   npm run db:seed
 *
 * Creates 100 users (random real-world freelancer tags), wires up a friend
 * graph, has 10 of them publish 3 posts each (public + friends mix), and lets
 * 10 users "chat" (comment, with some threaded replies + upvotes + likes) on
 * every post. Your own account is befriended to the authors so the feed fills.
 *
 * Idempotent: every seeded user gets a `@seed.zomzam.test` email; re-running
 * wipes the previous batch (and all their posts/comments/votes/connections)
 * before reseeding, so it never piles up.
 *
 * Override the owner account that gets befriended:  SEED_OWNER_EMAIL=you@x.com
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ── env (same manual parser as db-sync.ts — no dotenv dependency) ──
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...values] = trimmed.split('=');
    if (key && values.length) process.env[key.trim()] = values.join('=').trim();
  }
}
loadEnv();

const SEED_EMAIL_DOMAIN = 'seed.zomzam.test';
const SEED_PASSWORD = 'Password123';
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL || '2004.sanfor@gmail.com';

const USER_COUNT = 100;
const AUTHOR_COUNT = 10;
const POSTS_PER_AUTHOR = 3;
const COMMENTER_COUNT = 10;

// ── data pools ─────────────────────────────────────────────────
const FIRST_NAMES = [
  'Mariam', 'Omar', 'Layla', 'Karim', 'Nour', 'Youssef', 'Hana', 'Khaled', 'Salma', 'Tarek',
  'Aya', 'Ahmed', 'Farida', 'Mostafa', 'Dina', 'Hassan', 'Yara', 'Amr', 'Rana', 'Seif',
  'Liam', 'Emma', 'Noah', 'Olivia', 'Ethan', 'Ava', 'Lucas', 'Mia', 'Mason', 'Sophia',
  'Diego', 'Lucia', 'Mateo', 'Camila', 'Hugo', 'Valentina', 'Bruno', 'Isabella', 'Thiago', 'Sofia',
  'Aarav', 'Ananya', 'Vihaan', 'Diya', 'Arjun', 'Saanvi', 'Reyansh', 'Aisha', 'Kabir', 'Zara',
  'Wei', 'Mei', 'Hiroshi', 'Yuki', 'Minjun', 'Seoyeon', 'Chen', 'Lin', 'Haruto', 'Sakura',
];
const LAST_NAMES = [
  'Hassan', 'Said', 'Fathy', 'Adel', 'Mahmoud', 'Ali', 'Ibrahim', 'Mansour', 'Saleh', 'Nasser',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta',
  'Wang', 'Li', 'Zhang', 'Chen', 'Tanaka', 'Sato', 'Suzuki', 'Kim', 'Park', 'Lee',
];

// Realistic freelancer skill tags.
const TAG_POOL = [
  'React', 'Next.js', 'TypeScript', 'Node.js', 'Python', 'Vue', 'Laravel', 'WordPress',
  'UI/UX Design', 'Figma', 'Branding', 'Logo Design', 'Illustration', 'Motion Graphics',
  'Video Editing', 'Photography', '3D Modeling', 'After Effects', 'Web Design', 'App Design',
  'Copywriting', 'Content Writing', 'Translation', 'SEO', 'Social Media', 'Email Marketing',
  'Shopify', 'WooCommerce', 'Data Analysis', 'Excel', 'Voice Over', 'Animation',
];

const BIOS = [
  'Freelance maker. Coffee-driven. Open to collabs.',
  'Helping small brands look big since 2019.',
  'Remote-first. Building things people actually use.',
  'Designer by day, side-projects by night.',
  'Turning ideas into shipped products.',
  'Indie freelancer. Love clean work and good clients.',
  'Always learning, always shipping.',
  'Your friendly neighborhood problem-solver.',
  'Pixels, words, and the occasional bug fix.',
  'On a mission to never work a boring 9–5 again.',
];

const POST_TEXTS = [
  'Just wrapped a project I’m genuinely proud of. Two weeks of focus paid off 🙌',
  'Hot take: the hardest part of freelancing isn’t the work, it’s the invoicing.',
  'Looking for an accountability buddy for deep-work sessions this week. Who’s in?',
  'Closed my biggest client yet today. Still buzzing ⚡',
  'What’s everyone using to track time lately? Tried three apps, hate all of them.',
  'Reminder: raise your rates. The right clients won’t blink.',
  'Spent the morning refactoring instead of sleeping. Worth it. Mostly.',
  'New month, new goals. Aiming for two new clients and zero scope creep.',
  'Anyone else feel most productive at 11pm? Just me?',
  'Shipped a redesign today. The before/after still makes me smile.',
  'Cold email tip: lead with their problem, not your résumé.',
  'Took the afternoon off and the world didn’t end. Highly recommend.',
  'Trying out co-focus rooms with a friend — way better than working alone.',
  'Three revisions in and the client just said “go back to v1” 🙃',
  'Finally automated my proposal flow. Past me would be proud.',
];

const COMMENT_TEXTS = [
  'This is so relatable 😂',
  'Congrats! Well deserved 🎉',
  'Saving this, thank you!',
  'Totally agree with this.',
  'How long did it take you?',
  'Love this energy.',
  'Needed to hear this today.',
  'Same here honestly.',
  'Drop the tool, I’m curious.',
  'Inspiring stuff 🔥',
  'Been there, you got this.',
  'Bookmarked for later.',
  'What was the budget on that, if you don’t mind?',
  'Clean work as always 👏',
  'Count me in!',
  'This made my day.',
  'Big if true 😅',
  'Solid advice.',
  'I felt this one.',
  'More of these posts please.',
];

// ── helpers ────────────────────────────────────────────────────
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[rint(0, arr.length - 1)];
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rint(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sample = <T>(arr: T[], n: number): T[] => shuffle(arr).slice(0, n);
// MySQL DATETIME string from a Date.
const dt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

function tagPill(tag: string): string {
  const slug = tag.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `<span data-tag="${slug}" class="inline-flex items-center px-0.5 mx-0.5 text-sm font-bold cursor-text text-sky-400">#${slug}</span>`;
}

/**
 * Guard rail: this script wipes the previous seed batch and injects 100 fake
 * users + posts. That is catastrophic against a live database. We treat any
 * non-localhost DB_HOST as "production" and refuse to run unless the operator
 * explicitly opts in with ALLOW_PROD_SEED=1. Belt-and-suspenders for the
 * "we debug on prod" workflow — accidental `npm run db:seed` can't pollute
 * real customer data.
 */
function assertSeedTargetIsSafe() {
  const host = (process.env.DB_HOST || 'localhost').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal && process.env.ALLOW_PROD_SEED !== '1') {
    console.error(
      `\n  ✋ REFUSING to seed: DB_HOST="${host}" looks like a remote/production database.\n` +
      `     db:seed WIPES the prior seed batch and inserts 100 fake users + posts.\n` +
      `     If you really mean to seed THIS database, re-run with:\n\n` +
      `       ALLOW_PROD_SEED=1 npm run db:seed\n`
    );
    process.exit(1);
  }
}

async function main() {
  assertSeedTargetIsSafe();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'zomzam_db',
    multipleStatements: false,
  });

  try {
    console.log('→ Ensuring social tables exist…');
    await ensureSocialTables(conn);

    console.log('→ Cleaning up any previous seed batch…');
    await cleanupPreviousSeed(conn);

    console.log(`→ Creating ${USER_COUNT} users…`);
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    const existing = await q<{ username: string }>(conn, 'SELECT username FROM users');
    const usedNames = new Set(existing.map((r) => r.username.toLowerCase()));

    const users: { id: number; username: string }[] = [];
    for (let i = 0; i < USER_COUNT; i++) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const base = `${first}_${last}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
      let username = base;
      let n = 1;
      while (usedNames.has(username.toLowerCase())) username = `${base}${++n}`;
      usedNames.add(username.toLowerCase());

      const tags = JSON.stringify(sample(TAG_POOL, rint(2, 5)));
      const email = `${username}@${SEED_EMAIL_DOMAIN}`;
      const avatar = `https://i.pravatar.cc/200?u=${encodeURIComponent(username)}`;

      const res = await x(conn,
        `INSERT INTO users (username, email, password, first_name, last_name, bio, tags, avatar, is_active, is_verified, notifications_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, NOW(), NOW())`,
        [username, email, passwordHash, first, last, pick(BIOS), tags, avatar],
      );
      users.push({ id: res.insertId, username });
    }

    const userIds = users.map((u) => u.id);
    const authors = users.slice(0, AUTHOR_COUNT);
    const commenters = users.slice(AUTHOR_COUNT, AUTHOR_COUNT + COMMENTER_COUNT);
    // "Strangers" the owner is NOT befriended to — their PUBLIC posts prove the
    // feed shows public posts from non-friends.
    const strangers = users.slice(AUTHOR_COUNT + COMMENTER_COUNT, AUTHOR_COUNT + COMMENTER_COUNT + 8);

    console.log('→ Building friend graph…');
    await seedFriendships(conn, userIds, authors.map((a) => a.id), commenters.map((c) => c.id));

    console.log('→ Wiring your owner account into the network…');
    const ownerId = await befriendOwner(conn, authors.map((a) => a.id), commenters.map((c) => c.id));

    console.log(`→ Publishing ${AUTHOR_COUNT * POSTS_PER_AUTHOR} posts…`);
    const postIds: number[] = [];
    for (const author of authors) {
      const authorTags: string[] = JSON.parse(
        (await q<{ tags: string }>(conn, 'SELECT tags FROM users WHERE id = ?', [author.id]))[0]?.tags || '[]',
      );
      // Guarantee at least one public + one friends; randomize the third.
      const visibilities = shuffle(['public', 'friends', pick(['public', 'friends'])]);
      for (let p = 0; p < POSTS_PER_AUTHOR; p++) {
        let html = pick(POST_TEXTS);
        if (authorTags.length && Math.random() < 0.6) html += ' ' + tagPill(pick(authorTags));
        const createdAt = dt(minutesAgo(rint(5, 3 * 24 * 60))); // last ~3 days
        const res = await x(conn,
          `INSERT INTO posts (user_id, content_html, visibility, created_at) VALUES (?, ?, ?, ?)`,
          [author.id, html, visibilities[p], createdAt],
        );
        postIds.push(res.insertId);
      }
    }

    // One PUBLIC post each from non-befriended "strangers" — these should show
    // in the owner's feed purely because they're public.
    for (const stranger of strangers) {
      const sTags: string[] = JSON.parse(
        (await q<{ tags: string }>(conn, 'SELECT tags FROM users WHERE id = ?', [stranger.id]))[0]?.tags || '[]',
      );
      let html = pick(POST_TEXTS);
      if (sTags.length) html += ' ' + tagPill(pick(sTags));
      const res = await x(conn,
        `INSERT INTO posts (user_id, content_html, visibility, created_at) VALUES (?, ?, 'public', ?)`,
        [stranger.id, html, dt(minutesAgo(rint(5, 3 * 24 * 60)))],
      );
      postIds.push(res.insertId);
    }

    console.log('→ Adding comments (with replies), upvotes, and likes…');
    let commentCount = 0;
    let replyCount = 0;
    for (const postId of postIds) {
      const topLevelIds: number[] = [];
      // Every commenter chats on every post (order shuffled so it feels organic).
      for (const commenter of shuffle(commenters)) {
        const asReply = topLevelIds.length > 0 && Math.random() < 0.3;
        const parentId = asReply ? pick(topLevelIds) : null;
        const createdAt = dt(minutesAgo(rint(1, 4 * 60)));
        const res = await x(conn,
          `INSERT INTO post_comments (post_id, user_id, content, parent_id, created_at) VALUES (?, ?, ?, ?, ?)`,
          [postId, commenter.id, pick(COMMENT_TEXTS), parentId, createdAt],
        );
        if (parentId) replyCount++; else topLevelIds.push(res.insertId);
        commentCount++;

        // Random upvotes on this comment (drives the vote-sorted ordering).
        for (const voter of sample(userIds, rint(0, 6))) {
          await x(conn, `INSERT IGNORE INTO comment_votes (comment_id, user_id) VALUES (?, ?)`, [res.insertId, voter]);
        }
      }

      // Random likes on the post itself.
      for (const liker of sample(userIds, rint(0, 18))) {
        await x(conn, `INSERT IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)`, [postId, liker]);
      }
    }

    console.log('\n✅ Seed complete:');
    console.log(`   • ${users.length} users  (login: <username>@${SEED_EMAIL_DOMAIN} / ${SEED_PASSWORD})`);
    console.log(`   • ${postIds.length} posts: ${authors.length} authors (public + friends) + ${strangers.length} public posts from non-friends (tests public-feed visibility)`);
    console.log(`   • ${commentCount} comments (${replyCount} of them replies) across all posts`);
    console.log(`   • friend graph + likes + comment upvotes for testing sort/reorder`);
    if (ownerId) console.log(`   • owner account #${ownerId} befriended to all authors & commenters — feed is populated`);
    else console.log(`   ⚠ owner account "${OWNER_EMAIL}" not found — set SEED_OWNER_EMAIL to your login email and re-run to populate your feed`);
    console.log(`\n   Re-run anytime — it wipes this batch first (idempotent).`);
  } finally {
    await conn.end();
  }
}

// Small typed wrappers.
async function q<T = any>(conn: mysql.Connection, sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await conn.query(sql, params);
  return rows as T[];
}
async function x(conn: mysql.Connection, sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const [res] = await conn.query(sql, params);
  return res as mysql.ResultSetHeader;
}

// Mirror the lazy CREATE TABLEs from src/app/api/posts/route.ts so the seed
// works even if the app has never created them yet.
async function ensureSocialTables(conn: mysql.Connection) {
  await x(conn, `CREATE TABLE IF NOT EXISTS posts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content_html TEXT NOT NULL,
    visibility ENUM('friends','public','exclusive') NOT NULL DEFAULT 'friends',
    created_at DATETIME DEFAULT NOW(),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  try { await x(conn, `ALTER TABLE posts ADD COLUMN visibility ENUM('friends','public','exclusive') NOT NULL DEFAULT 'friends'`); } catch {}

  await x(conn, `CREATE TABLE IF NOT EXISTS post_likes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT UNSIGNED NOT NULL,
    user_id INT NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    UNIQUE KEY uq_post_user (post_id, user_id),
    INDEX idx_post_id (post_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await x(conn, `CREATE TABLE IF NOT EXISTS post_comments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT UNSIGNED NOT NULL,
    user_id INT NOT NULL,
    content VARCHAR(1000) NOT NULL,
    parent_id BIGINT UNSIGNED NULL DEFAULT NULL,
    created_at DATETIME DEFAULT NOW(),
    INDEX idx_post_id (post_id),
    INDEX idx_parent_id (parent_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  try { await x(conn, `ALTER TABLE post_comments ADD COLUMN parent_id BIGINT UNSIGNED NULL DEFAULT NULL`); } catch {}

  await x(conn, `CREATE TABLE IF NOT EXISTS comment_votes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    comment_id BIGINT UNSIGNED NOT NULL,
    user_id INT NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    UNIQUE KEY uq_comment_user (comment_id, user_id),
    INDEX idx_comment_id (comment_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function cleanupPreviousSeed(conn: mysql.Connection) {
  const seed = await q<{ id: number }>(conn, `SELECT id FROM users WHERE email LIKE ?`, [`%@${SEED_EMAIL_DOMAIN}`]);
  if (!seed.length) return;
  const ids = seed.map((r) => r.id);
  const list = ids.join(',');
  // Posts authored by seed users → their whole comment/like/vote subtrees.
  const seedPosts = await q<{ id: number }>(conn, `SELECT id FROM posts WHERE user_id IN (${list})`);
  const postList = seedPosts.map((p) => p.id).join(',') || '0';

  await x(conn, `DELETE FROM comment_votes WHERE user_id IN (${list}) OR comment_id IN (SELECT id FROM post_comments WHERE post_id IN (${postList}) OR user_id IN (${list}))`);
  await x(conn, `DELETE FROM post_comments WHERE post_id IN (${postList}) OR user_id IN (${list})`);
  await x(conn, `DELETE FROM post_likes WHERE post_id IN (${postList}) OR user_id IN (${list})`);
  await x(conn, `DELETE FROM posts WHERE id IN (${postList})`);
  await x(conn, `DELETE FROM user_connections WHERE requester_id IN (${list}) OR addressee_id IN (${list})`);
  await x(conn, `DELETE FROM notifications WHERE user_id IN (${list})`);
  await x(conn, `DELETE FROM user_online_status WHERE user_id IN (${list})`);
  await x(conn, `DELETE FROM users WHERE id IN (${list})`);
  console.log(`   removed ${ids.length} previous seed users and their data`);
}

// Each commenter befriends each author (so friends-only posts have an audience),
// plus a sprinkling of random friendships across the whole set.
async function seedFriendships(conn: mysql.Connection, allIds: number[], authorIds: number[], commenterIds: number[]) {
  const made = new Set<string>();
  const link = async (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (made.has(key)) return;
    made.add(key);
    await x(conn,
      `INSERT INTO user_connections (requester_id, addressee_id, type, status, created_at, updated_at) VALUES (?, ?, 'friend', 'accepted', NOW(), NOW())`,
      [a, b],
    );
  };
  for (const author of authorIds) for (const commenter of commenterIds) await link(author, commenter);
  // ~6 random extra friends each for a denser, more realistic graph.
  for (const id of allIds) for (const other of sample(allIds, 6)) await link(id, other);
}

async function befriendOwner(conn: mysql.Connection, authorIds: number[], commenterIds: number[]): Promise<number | null> {
  let owner = (await q<{ id: number }>(conn, `SELECT id FROM users WHERE email = ? LIMIT 1`, [OWNER_EMAIL]))[0];
  if (!owner) owner = (await q<{ id: number }>(conn, `SELECT id FROM users WHERE id = 1 LIMIT 1`))[0];
  if (!owner) return null;
  for (const target of [...authorIds, ...commenterIds]) {
    await x(conn,
      `INSERT INTO user_connections (requester_id, addressee_id, type, status, created_at, updated_at) VALUES (?, ?, 'friend', 'accepted', NOW(), NOW())`,
      [owner.id, target],
    );
  }
  return owner.id;
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
