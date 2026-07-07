import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { canonicalEmail } from '../src/lib/email';

// Manual .env parser for scripts running directly via tsx without external
// dotenv dependency. Loads `.env` then `.env.local`, with `.env.local` taking
// precedence — mirroring Next.js's load order so the script and the app read
// the same values regardless of which file a secret lives in.
function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          process.env[key.trim()] = values.join('=').trim();
        }
      }
    });
  }
}

loadEnv();

const schema: Record<string, Record<string, string>> = {
  users: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    username: 'VARCHAR(50) NOT NULL UNIQUE',
    email: 'VARCHAR(255) NOT NULL UNIQUE',
    email_canonical: 'VARCHAR(255) NULL DEFAULT NULL',            // inbox-identity key (lowercased, +tag/dot-folded) — see src/lib/email.ts
    first_name: 'VARCHAR(100) NULL',
    last_name: 'VARCHAR(100) NULL',
    password: 'VARCHAR(255) NULL',
    google_id: 'VARCHAR(255) NULL UNIQUE',
    facebook_id: 'VARCHAR(255) NULL UNIQUE',
    role: "ENUM('user', 'admin', 'moderator') NOT NULL DEFAULT 'user'",
    avatar: 'VARCHAR(500) NULL',
    bio: 'TEXT NULL',
    tags: 'JSON NULL',
    timezone: "VARCHAR(50) NOT NULL DEFAULT 'UTC'",
    notifications_enabled: 'TINYINT(1) NOT NULL DEFAULT 0',
    is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
    token_version: 'INT NOT NULL DEFAULT 0',
    is_verified: 'TINYINT(1) NOT NULL DEFAULT 0',
    verification_token: 'VARCHAR(255) NULL',
    reset_token: 'VARCHAR(255) NULL',
    reset_token_expires: 'DATETIME NULL',
    primary_currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    secondary_currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'USD'",
    last_login_at: 'DATETIME NULL',
    last_login_ip: 'VARCHAR(45) NULL',
    last_active_at: 'DATETIME NULL',
    login_attempts: 'INT UNSIGNED NOT NULL DEFAULT 0',
    locked_until: 'DATETIME NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  time_horizons: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    type: "ENUM('week', 'month', 'year') NOT NULL",
    content: 'TEXT NOT NULL',
    status: "ENUM('active', 'completed') NOT NULL DEFAULT 'active'",
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  time_tasks: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    horizon_id: 'INT UNSIGNED NULL',
    project_id: 'INT UNSIGNED NULL',
    title: 'VARCHAR(255) NOT NULL',
    priority: "ENUM('urgent', 'medium', 'maybe', 'free') NOT NULL DEFAULT 'medium'",
    duration_block: 'INT UNSIGNED NOT NULL',
    actual_duration: 'INT UNSIGNED NULL',
    status: "ENUM('pending', 'in_progress', 'completed', 'deleted') NOT NULL DEFAULT 'pending'",
    completed_at: 'DATETIME NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    notion_page_id: 'VARCHAR(255) NULL UNIQUE',
  },
  time_ideas: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    linked_task_id: 'INT UNSIGNED NULL',
    linked_horizon_id: 'INT UNSIGNED NULL',
    content: 'TEXT NOT NULL',
    status: "VARCHAR(20) NOT NULL DEFAULT 'open'",
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  time_links: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    title: 'VARCHAR(255) NOT NULL',
    url: 'TEXT NOT NULL',
    notion_page_id: 'VARCHAR(255) NULL UNIQUE',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  time_task_links: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    task_id: 'INT UNSIGNED NOT NULL',
    link_id: 'INT UNSIGNED NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  money_accounts: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    name: 'VARCHAR(100) NOT NULL',
    type: "ENUM('bank', 'cash', 'paypal', 'wallet', 'other', 'credit_card') NOT NULL DEFAULT 'bank'",
    currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    balance: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00',
    last_four: 'VARCHAR(4) NULL',
    credit_limit: 'DECIMAL(15, 2) NULL',
    statement_day: 'TINYINT UNSIGNED NULL',
    due_day: 'TINYINT UNSIGNED NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  money_categories: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    name: 'VARCHAR(100) NOT NULL',
    type: "ENUM('need', 'want', 'saving', 'debt', 'income') NOT NULL DEFAULT 'need'",
    budget_percent: 'DECIMAL(5, 2) NULL',
    icon: 'VARCHAR(50) NULL',
    color: 'VARCHAR(20) NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  money_transactions: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    account_id: 'INT UNSIGNED NOT NULL',
    category_id: 'INT UNSIGNED NULL',
    type: "ENUM('income', 'expense', 'transfer', 'lend') NOT NULL",
    amount: 'DECIMAL(15, 2) NOT NULL',
    currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    description: 'VARCHAR(255) NULL',
    transaction_date: 'DATE NOT NULL',
    lead_id: 'INT UNSIGNED NULL', // CRM client/deal this income/expense is attributed to (per-client profitability)
    transfer_account_id: 'INT UNSIGNED NULL', // destination account for a transfer's credit leg
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  money_lend: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    person_name: 'VARCHAR(100) NOT NULL',
    type: "ENUM('owe_me', 'i_owe') NOT NULL",
    amount: 'DECIMAL(15, 2) NOT NULL',
    currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    status: "ENUM('pending', 'partial', 'settled') NOT NULL DEFAULT 'pending'",
    due_date: 'DATE NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  money_budget: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    buckets: 'JSON NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  user_online_status: {
    user_id: 'INT UNSIGNED PRIMARY KEY',
    last_seen: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    stream_queue: 'JSON NULL',
    is_idle: 'TINYINT(1) NOT NULL DEFAULT 0',
  },
  user_connections: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    requester_id: 'INT UNSIGNED NOT NULL',
    addressee_id: 'INT UNSIGNED NOT NULL',
    type: "ENUM('friend','follow') NOT NULL DEFAULT 'friend'",
    status: "ENUM('pending','accepted','declined','blocked') NOT NULL DEFAULT 'pending'",
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  notifications: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    type: 'VARCHAR(50) NOT NULL',
    data: 'JSON NOT NULL',
    is_read: 'TINYINT(1) NOT NULL DEFAULT 0',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  conversations: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    // Canonical pair: user_one_id is always LEAST(a, b), user_two_id is always
    // GREATEST(a, b) — so a 1:1 thread between two users has exactly one row
    // regardless of who started it.
    user_one_id: 'INT UNSIGNED NOT NULL',
    user_two_id: 'INT UNSIGNED NOT NULL',
    last_message_at: 'DATETIME NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  messages: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    conversation_id: 'INT UNSIGNED NOT NULL',
    sender_id: 'INT UNSIGNED NOT NULL',
    content: 'TEXT NOT NULL',
    read_at: 'DATETIME NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  crm_leads: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    name: 'VARCHAR(255) NOT NULL',
    email: 'VARCHAR(255) NULL',
    phone: 'VARCHAR(100) NULL',
    website: 'TEXT NULL',
    address: 'TEXT NULL',
    company: 'VARCHAR(255) NULL',
    status: "ENUM('new', 'contacted', 'qualified', 'lost') NOT NULL DEFAULT 'new'",
    source: "VARCHAR(100) NOT NULL DEFAULT 'Google Maps Scanner'",
    industry: 'VARCHAR(255) NULL',
    notes: 'TEXT NULL',
    rating: 'FLOAT NULL',
    review_count: 'INT UNSIGNED NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  crm_scrape_jobs: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    query: 'VARCHAR(255) NOT NULL',
    area: 'VARCHAR(255) NOT NULL',
    status: "ENUM('pending', 'scraping', 'completed', 'failed') NOT NULL DEFAULT 'completed'",
    leads_found: 'INT UNSIGNED NOT NULL DEFAULT 0',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  crm_settings: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    key: 'VARCHAR(255) NOT NULL',
    value: 'TEXT NULL',
  },
  crm_projects: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    lead_id: 'INT UNSIGNED NULL',
    name: 'VARCHAR(255) NOT NULL',
    status: "ENUM('planning', 'in_design', 'review', 'delivered') NOT NULL DEFAULT 'planning'",
    amount: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00',
    currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    notion_page_id: 'VARCHAR(255) NULL UNIQUE',
  },
  posts: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    public_id: 'CHAR(32) NULL DEFAULT NULL',                         // opaque MD5 used in the public /p/ permalink (hides the sequential id)
    user_id: 'INT NOT NULL',
    content_html: 'TEXT NOT NULL',
    visibility: "ENUM('friends', 'public', 'exclusive') NOT NULL DEFAULT 'friends'",
    image_path: 'VARCHAR(255) NULL DEFAULT NULL',                   // first attached image (kept for back-compat + plain-repost guards)
    image_paths: 'JSON NULL DEFAULT NULL',                          // full ordered list of up to 3 attached images (image_path = element 0)
    type: "ENUM('status', 'ask', 'win') NOT NULL DEFAULT 'status'", // favor economy: one feed, branch on type
    skill_tag: 'VARCHAR(50) NULL DEFAULT NULL',                      // ask routing/matching
    accepted_answer_id: 'BIGINT UNSIGNED NULL DEFAULT NULL',         // FK -> post_comments.id (the accepted answer)
    resolved_at: 'DATETIME NULL DEFAULT NULL',                       // set on accept OR manual resolve; resolved = NOT NULL
    repost_of: 'BIGINT UNSIGNED NULL DEFAULT NULL',                  // pointer model: set ⇒ this row is a repost of the (root) original
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  post_likes: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    post_id: 'BIGINT UNSIGNED NOT NULL',
    user_id: 'INT NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  post_comments: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    post_id: 'BIGINT UNSIGNED NOT NULL',
    user_id: 'INT NOT NULL',
    content: 'VARCHAR(1000) NOT NULL',
    parent_id: 'BIGINT UNSIGNED NULL DEFAULT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  comment_votes: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    comment_id: 'BIGINT UNSIGNED NOT NULL',
    user_id: 'INT NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  // Chat-style read receipts for the feed: one row per (post, viewer). Its
  // presence with seen=1 means the viewer has already seen that post, so the
  // feed can serve unseen posts first and backfill seen ones (see getFeed).
  post_views: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    post_id: 'BIGINT UNSIGNED NOT NULL',
    user_id: 'INT NOT NULL',
    seen: 'TINYINT(1) NOT NULL DEFAULT 1',          // true/false read flag (room for "delivered, not seen" later)
    seen_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  // Private saved-posts: one row per (user, post). Its presence means the viewer
  // bookmarked that post; the /saved page reverse-chrons these (visibility
  // re-checked at read time so a since-hidden post never leaks).
  post_bookmarks: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    post_id: 'BIGINT UNSIGNED NOT NULL',
    user_id: 'INT NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  // User reports on posts (the card's 3-dot "Report" action). One row per
  // (post, reporter) — re-reporting is a silent no-op. Append-only moderation
  // inbox; nothing reads it in-app yet.
  post_reports: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    post_id: 'BIGINT UNSIGNED NOT NULL',
    user_id: 'INT NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  // Append-only log the future credits engine consumes (NOT a ledger): one row
  // each time an asker accepts an answer. No balance is ever touched here.
  helpful_events: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    post_id: 'BIGINT UNSIGNED NOT NULL',
    comment_id: 'BIGINT UNSIGNED NOT NULL',
    helper_user_id: 'INT UNSIGNED NOT NULL',   // answer author (future credit recipient)
    asker_user_id: 'INT UNSIGNED NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  // Emoji reactions on direct messages. One reaction per (message, user) —
  // reacting again replaces the emoji, reacting with the same emoji toggles it
  // off (Messenger-style). Scoped/authorized at the API by walking the message's
  // conversation participants.
  message_reactions: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    message_id: 'BIGINT UNSIGNED NOT NULL',
    user_id: 'INT UNSIGNED NOT NULL',
    emoji: 'VARCHAR(16) NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  // Append-only user safety/moderation trail. One row per sensitive self-service
  // change (username edit, avatar change/remove, post deletion) so abuse can be
  // traced after the fact — the actor, what changed (old→new), and, for deleted
  // content, the removed body itself (content_html). Nothing reads it in-app yet
  // (mirrors post_reports — a moderation inbox), it is a durable record only.
  user_audit_log: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',                 // the actor whose account performed the change
    action: 'VARCHAR(50) NOT NULL',                   // 'username_changed' | 'avatar_changed' | 'avatar_removed' | 'post_deleted'
    old_value: 'TEXT NULL',                           // prior scalar (old username / old avatar path)
    new_value: 'TEXT NULL',                           // next scalar (new username / new avatar path)
    content: 'MEDIUMTEXT NULL',                       // removed body kept verbatim (post_deleted → content_html)
    metadata: 'JSON NULL',                            // structured extras (post_id, visibility, image_paths, ip)
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  // Shared-backend rate limiter (src/lib/rate-limit.ts). One append-only row per
  // attempt, keyed by an opaque `bucket` (e.g. "login:1.2.3.4"). Lives in the DB,
  // not process memory, because Vercel's serverless functions are ephemeral +
  // multi-instance — an in-memory window resets on every cold start and isn't
  // shared across instances, so it can't actually throttle brute force there.
  // `created_at_ms` is epoch milliseconds (matches Date.now()) for exact
  // sliding-window math without DATETIME/timezone rounding.
  rate_limit_events: {
    id: 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    bucket: 'VARCHAR(190) NOT NULL',
    created_at_ms: 'BIGINT UNSIGNED NOT NULL',
  },
};

// Composite / secondary indexes the column-only `schema` map cannot express
// (single-column UNIQUE is folded into the column def above; everything below is
// a multi-column key or a named secondary index). Keyed by index name so the
// sync can check INFORMATION_SCHEMA.STATISTICS and add only what is missing —
// declarative + idempotent, the same contract as the column sync.
const indexes: Record<string, Record<string, string>> = {
  users: {
    uq_email_canonical: 'UNIQUE INDEX uq_email_canonical (email_canonical)',  // one account per inbox (blocks dot/+tag/case duplicates)
  },
  money_budget: {
    uq_user_id: 'UNIQUE INDEX uq_user_id (user_id)',  // one budget row per user (ON DUPLICATE KEY UPDATE target)
  },
  posts: {
    idx_user_id: 'INDEX idx_user_id (user_id)',
    idx_created_at: 'INDEX idx_created_at (created_at DESC)',
    idx_type_resolved: 'INDEX idx_type_resolved (type, resolved_at)',
    idx_repost_of: 'INDEX idx_repost_of (repost_of)',
    uq_public_id: 'UNIQUE INDEX uq_public_id (public_id)',  // permalink lookup target + collision guard
  },
  post_likes: {
    uq_post_user: 'UNIQUE INDEX uq_post_user (post_id, user_id)',
    idx_post_id: 'INDEX idx_post_id (post_id)',
  },
  post_comments: {
    idx_post_id: 'INDEX idx_post_id (post_id)',
    idx_created_at: 'INDEX idx_created_at (created_at ASC)',
    idx_parent_id: 'INDEX idx_parent_id (parent_id)',
  },
  comment_votes: {
    uq_comment_user: 'UNIQUE INDEX uq_comment_user (comment_id, user_id)',
    idx_comment_id: 'INDEX idx_comment_id (comment_id)',
  },
  post_views: {
    uq_post_user: 'UNIQUE INDEX uq_post_user (post_id, user_id)',  // upsert target for mark_seen
    idx_user_seen: 'INDEX idx_user_seen (user_id, seen)',          // "my unseen" NOT EXISTS filter
  },
  post_bookmarks: {
    uq_user_post: 'UNIQUE INDEX uq_user_post (user_id, post_id)',  // toggle target + one-per-user
    idx_user_id: 'INDEX idx_user_id (user_id, id)',                // newest-saved-first keyset
  },
  post_reports: {
    uq_post_user: 'UNIQUE INDEX uq_post_user (post_id, user_id)',  // one report per viewer (INSERT IGNORE target)
  },
  rate_limit_events: {
    // The count-within-window + per-bucket purge both filter by (bucket, time).
    idx_bucket_time: 'INDEX idx_bucket_time (bucket, created_at_ms)',
  },
  message_reactions: {
    uq_message_user: 'UNIQUE INDEX uq_message_user (message_id, user_id)',  // one reaction per user per message (upsert target)
    idx_message_id: 'INDEX idx_message_id (message_id)',                    // load all reactions for a thread's messages
  },
  user_audit_log: {
    idx_user_id: 'INDEX idx_user_id (user_id, id)',        // "this user's history", newest-first keyset
    idx_action: 'INDEX idx_action (action, created_at)',   // "all username changes since X" moderation sweep
  },
};

/**
 * Guard rail: db:sync performs declarative schema migration (CREATE/ALTER) on
 * whatever DB_HOST points to. Against the live site that can change tables out
 * from under running traffic. Any non-localhost host is treated as production
 * and requires an explicit ALLOW_PROD_SYNC=1 opt-in.
 */
function assertSyncTargetIsSafe() {
  const host = (process.env.DB_HOST || 'localhost').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal && process.env.ALLOW_PROD_SYNC !== '1') {
    console.error(
      `\n  ✋ REFUSING to sync schema: DB_HOST="${host}" looks like a remote/production database.\n` +
      `     db:sync runs CREATE/ALTER against this DB and can disrupt live traffic.\n` +
      `     Back up first, then re-run intentionally with:\n\n` +
      `       ALLOW_PROD_SYNC=1 npm run db:sync\n`
    );
    process.exit(1);
  }
}

async function syncDatabase() {
  assertSyncTargetIsSafe();
  console.log('Connecting to database...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
  });

  // Ensure DB exists
  const dbName = process.env.DB_NAME || 'zomzam_db';
  console.log(`Ensuring database "${dbName}" exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.changeUser({ database: dbName });

  console.log('Starting database synchronization...');

  for (const [tableName, columns] of Object.entries(schema)) {
    // Check if table exists
    const [tables] = await connection.query<any[]>(`SHOW TABLES LIKE ?`, [tableName]);
    
    if (tables.length === 0) {
      console.log(`Creating table: ${tableName}`);
      const colDefs = Object.entries(columns).map(([name, def]) => `\`${name}\` ${def}`);
      await connection.query(
        `CREATE TABLE \`${tableName}\` (${colDefs.join(', ')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );
    } else {
      // Check for missing or changed columns
      const [columnsInfo] = await connection.query<any[]>(`DESCRIBE \`${tableName}\``);
      const existingCols = columnsInfo.map((c: any) => c.Field);
      
      for (const [name, def] of Object.entries(columns)) {
        if (!existingCols.includes(name)) {
          console.log(`Adding column \`${name}\` to table \`${tableName}\``);
          await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${name}\` ${def}`);
        }
      }
    }
  }

  // Sync secondary / composite indexes idempotently (the column loop above only
  // creates tables + adds missing columns; multi-column keys live here).
  for (const [tableName, idxs] of Object.entries(indexes)) {
    for (const [idxName, addClause] of Object.entries(idxs)) {
      const [existing] = await connection.query<any[]>(
        `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
        [dbName, tableName, idxName]
      );
      if (existing.length === 0) {
        console.log(`Adding index \`${idxName}\` to table \`${tableName}\``);
        await connection.query(`ALTER TABLE \`${tableName}\` ADD ${addClause}`);
      }
    }
  }

  // Custom schema updates (widening money_accounts.type enum to add 'credit_card' —
  // the generic column loop above only ADDs missing columns, it never MODIFYs an
  // existing one, so a changed ENUM on a pre-existing install needs this same
  // pattern as the two blocks below)
  try {
    const [columnsInfo] = await connection.query<any[]>(`DESCRIBE \`money_accounts\``);
    const typeCol = columnsInfo.find((c: any) => c.Field === 'type');
    if (typeCol && !typeCol.Type.includes('credit_card')) {
      console.log("Modifying money_accounts.type enum to add 'credit_card'...");
      await connection.query(
        "ALTER TABLE `money_accounts` MODIFY COLUMN `type` ENUM('bank', 'cash', 'paypal', 'wallet', 'other', 'credit_card') NOT NULL DEFAULT 'bank'"
      );
    }
  } catch (err) {
    console.error('Failed to update money_accounts.type enum:', err);
  }

  // Custom schema updates (making crm_projects.lead_id nullable)
  try {
    const [columnsInfo] = await connection.query<any[]>(`DESCRIBE \`crm_projects\``);
    const leadIdCol = columnsInfo.find((c: any) => c.Field === 'lead_id');
    if (leadIdCol && leadIdCol.Null === 'NO') {
      console.log('Modifying crm_projects.lead_id to be nullable...');
      await connection.query('ALTER TABLE `crm_projects` MODIFY COLUMN `lead_id` INT UNSIGNED NULL');
    }
  } catch (err) {
    console.error('Failed to update crm_projects.lead_id column:', err);
  }

  // Backfill opaque public_id for any pre-existing posts (rows created before the
  // column existed). MD5 of the id + RAND() + UUID() so the value is unique and
  // NOT derivable from the sequential id — old permalinks become non-enumerable
  // too, not just new ones. New rows get their public_id from the app on insert.
  try {
    const [r] = await connection.query<any>(
      `UPDATE posts SET public_id = MD5(CONCAT(id, '-', RAND(), '-', UUID()))
       WHERE public_id IS NULL OR public_id = ''`
    );
    if (r.affectedRows > 0) console.log(`Backfilled public_id on ${r.affectedRows} existing post(s)`);
  } catch (err) {
    console.error('Failed to backfill posts.public_id:', err);
  }

  // Backfill email_canonical for pre-existing accounts (rows created before the
  // column existed). Gmail-aware folding can't be expressed in pure SQL, so we
  // compute it in JS. Per-row try/catch: if two legacy rows happen to fold to
  // the same inbox, the unique index rejects the second — we log it rather than
  // abort the whole sync (it flags a real duplicate to reconcile by hand).
  try {
    const [rows] = await connection.query<any[]>(
      `SELECT id, email FROM users WHERE email_canonical IS NULL OR email_canonical = ''`
    );
    let filled = 0;
    for (const r of rows) {
      try {
        await connection.query(`UPDATE users SET email_canonical = ? WHERE id = ?`, [canonicalEmail(r.email), r.id]);
        filled++;
      } catch (e: any) {
        console.error(`  email_canonical collision for user ${r.id} (${r.email}) -> ${canonicalEmail(r.email)}:`, e.code || e.message);
      }
    }
    if (filled > 0) console.log(`Backfilled email_canonical on ${filled} user(s)`);
  } catch (err) {
    console.error('Failed to backfill users.email_canonical:', err);
  }

  // Custom schema updates (making users.password nullable for Google-OAuth-only accounts)
  try {
    const [columnsInfo] = await connection.query<any[]>(`DESCRIBE \`users\``);
    const passwordCol = columnsInfo.find((c: any) => c.Field === 'password');
    if (passwordCol && passwordCol.Null === 'NO') {
      console.log('Modifying users.password to be nullable...');
      await connection.query('ALTER TABLE `users` MODIFY COLUMN `password` VARCHAR(255) NULL');
    }
  } catch (err) {
    console.error('Failed to update users.password column:', err);
  }

  console.log('Database synchronization complete.');

  // Seeding initial data
  console.log('Seeding initial data...');

  // Seed default money categories for user_id = 1 (default user setup)
  const categories = [
    ['Needs', 'need', 60.00, 'shield'],
    ['Wants', 'want', 20.00, 'heart'],
    ['Savings', 'saving', 20.00, 'piggy-bank'],
    ['Insurance', 'need', null, 'umbrella'],
    ['Food & Groceries', 'need', null, 'shopping-cart'],
    ['Internet', 'need', null, 'wifi'],
    ['Electricity & Gas', 'need', null, 'zap'],
    ['Cat food', 'need', null, 'cat'],
    ['Salary', 'income', null, 'dollar-sign'],
    ['Extra Bonus', 'income', null, 'plus-circle']
  ];

  for (const cat of categories) {
    const [existing] = await connection.query<any[]>(
      `SELECT id FROM money_categories WHERE user_id = 1 AND name = ?`,
      [cat[0]]
    );
    if (existing.length === 0) {
      console.log(`Seeding category: ${cat[0]}`);
      await connection.query(
        `INSERT INTO money_categories (user_id, name, type, budget_percent, icon) VALUES (1, ?, ?, ?, ?)`,
        [cat[0], cat[1], cat[2], cat[3]]
      );
    }
  }

  // Seed default money accounts for user_id = 1
  const accounts = [
    ['Banque Misr VISA USD Debit', 'bank', 'USD', 0.00, '4193'],
    ['Egypt Post VISA EGP Debit', 'bank', 'EGP', 0.00, '1154'],
    ['PayPal', 'paypal', 'USD', 0.00, null]
  ];

  for (const acc of accounts) {
    const [existing] = await connection.query<any[]>(
      `SELECT id FROM money_accounts WHERE user_id = 1 AND name = ?`,
      [acc[0]]
    );
    if (existing.length === 0) {
      console.log(`Seeding account: ${acc[0]}`);
      await connection.query(
        `INSERT INTO money_accounts (user_id, name, type, currency, balance, last_four) VALUES (1, ?, ?, ?, ?, ?)`,
        [acc[0], acc[1], acc[2], acc[3], acc[4]]
      );
    }
  }

  // Seed default crm settings for user_id = 1
  const crmSettings = [
    ['CLAUDE_API_KEY', 'sk-ant-sid-placeholder-zomzam-crm-api-key'],
    ['claude_model', 'claude-3-5-sonnet-latest'],
    ['claude_tone', 'professional'],
    ['claude_temperature', '0.75'],
    ['claude_max_tokens', '800'],
    ['system_signature', '[Your Name]\nLead Outreach Strategist\nZomzam CRM Executive Suite'],
    ['system_theme', 'dark'],
    ['GOOGLE_MAPS_API_KEY', ''],
    ['GOOGLE_MAPS_MAP_ID', 'CRM_LEADS_MAP']
  ];

  for (const [key, value] of crmSettings) {
    const [existing] = await connection.query<any[]>(
      `SELECT id FROM crm_settings WHERE user_id = 1 AND \`key\` = ?`,
      [key]
    );
    if (existing.length === 0) {
      console.log(`Seeding CRM setting: ${key}`);
      await connection.query(
        `INSERT INTO crm_settings (user_id, \`key\`, value) VALUES (1, ?, ?)`,
        [key, value]
      );
    }
  }

  console.log('Seeding complete.');
  await connection.end();
}

syncDatabase().catch((err) => {
  console.error('Error during synchronization:', err);
  process.exit(1);
});
