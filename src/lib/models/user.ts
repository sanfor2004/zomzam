import { query, queryOne, execute } from '../db';
import { hashPassword, comparePassword } from '../auth';
import { canonicalEmail } from '../email';

export interface UserRow {
  id: number;
  username: string;
  email: string;
  email_canonical?: string | null;
  first_name: string | null;
  last_name: string | null;
  password?: string | null;
  google_id?: string | null;
  facebook_id?: string | null;
  role: 'user' | 'admin' | 'moderator';
  avatar: string | null;
  bio: string | null;
  tags: any | null;
  timezone: string;
  notifications_enabled: number;
  is_active: number;
  token_version: number;
  is_verified: number;
  primary_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  secondary_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  last_login_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_AVATAR = '/Assets/Img/default-avatar.png';

export function normalizeAvatar<T extends { avatar?: string | null }>(user: T): T {
  return user.avatar ? user : { ...user, avatar: DEFAULT_AVATAR };
}

/**
 * "Online" means seen within this many seconds. Must comfortably exceed the
 * background refresh cadence (SSE loop 2–5s, out-of-band heartbeat ~25s) plus
 * slack — otherwise a genuinely-connected user whose last ping is mid-interval
 * reads as offline, and presence flickers. 7s was far too tight; 35s keeps a
 * connected user steadily online and degrades gracefully ("active recently")
 * for ~half a minute after they leave.
 */
export const ONLINE_WINDOW_SECONDS = 35;

/**
 * Returns online status fields from a DB-fetched last_seen timestamp.
 * Exported so list endpoints can enrich joined user rows without re-querying.
 */
export function computeOnlineFields(lastSeen: string, isIdleFlag: number | boolean) {
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  const is_online = diff < ONLINE_WINDOW_SECONDS;
  const is_idle = !!isIdleFlag && is_online;
  return { diff, is_online, is_idle };
}

export async function getUserById(userId: number): Promise<Partial<UserRow> | null> {
  const row = await queryOne<UserRow>(
    `SELECT id, username, first_name, last_name, email, role, avatar, bio, tags, timezone, notifications_enabled, primary_currency, secondary_currency, last_login_at, created_at 
     FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  return row ? normalizeAvatar(row) : null;
}

export async function getUserByUsername(username: string): Promise<Partial<UserRow> | null> {
  const row = await queryOne<UserRow>(
    `SELECT id, username, first_name, last_name, email, role, avatar, bio, tags, timezone, notifications_enabled, primary_currency, secondary_currency, last_login_at, created_at 
     FROM users WHERE username = ? LIMIT 1`,
    [username]
  );
  return row ? normalizeAvatar(row) : null;
}

export async function registerUser(username: string, email: string, passwordPlain: string) {
  if (!username || !email || !passwordPlain) {
    return { success: false, message: 'All fields are required' };
  }

  // Sanitized username
  const cleanUsername = username.replace(/\s+/g, '_').trim();

  // Validate format
  if (passwordPlain.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters' };
  }

  // Check unique username
  const existUser = await queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', [cleanUsername]);
  if (existUser) {
    return { success: false, message: 'Username already exists' };
  }

  // Reject a duplicate INBOX, not just an exact-string match — so the same Gmail
  // entered with different dots/case/+tag can't open a second account (and later
  // collide with the OAuth-linking path). See canonicalEmail.
  const emailCanonical = canonicalEmail(email);
  const existEmail = await queryOne('SELECT id FROM users WHERE email_canonical = ? LIMIT 1', [emailCanonical]);
  if (existEmail) {
    return { success: false, message: 'Email already exists' };
  }

  const hashedPassword = await hashPassword(passwordPlain);

  const res = await execute(
    `INSERT INTO users (username, email, email_canonical, password, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [cleanUsername, email, emailCanonical, hashedPassword]
  );

  return {
    success: true,
    message: 'User registered successfully',
    user: {
      id: res.insertId,
      username: cleanUsername,
      email: email,
    },
  };
}

export async function loginUser(identifier: string, passwordPlain: string) {
  if (!identifier || !passwordPlain) {
    return { success: false, message: 'Username/Email and password are required' };
  }

  // Match on username, the exact email, OR the canonical inbox — so signing in
  // with a different dotting/case of the same Gmail still finds the account.
  const user = await queryOne<UserRow>(
    `SELECT * FROM users WHERE username = ? OR email = ? OR email_canonical = ? LIMIT 1`,
    [identifier, identifier, canonicalEmail(identifier)]
  );

  if (!user) {
    return { success: false, message: 'Invalid credentials' };
  }

  const passwordValid = await comparePassword(passwordPlain, user.password || '');
  if (!passwordValid) {
    return { success: false, message: 'Invalid credentials' };
  }

  // Deactivated accounts cannot mint a new session (mirrors the per-request
  // is_active gate in getSessionUser, but blocks login outright).
  if (user.is_active === 0) {
    return { success: false, message: 'This account has been deactivated.' };
  }

  await execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);

  const { password, ...safeUser } = user;
  return {
    success: true,
    message: 'Login successful',
    user: normalizeAvatar(safeUser),
  };
}

function usernameFromEmail(email: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 40);
  return base || 'user';
}

async function uniqueUsername(base: string): Promise<string> {
  let candidate = base;
  let suffix = 0;
  while (await queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate])) {
    suffix += 1;
    candidate = `${base}_${suffix}`.slice(0, 50);
  }
  return candidate;
}

export interface GoogleProfileInput {
  googleId: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

/**
 * Finds the user tied to this Google account, links an existing email
 * account on first Google sign-in, or creates a brand-new password-less
 * account. Email is trusted for linking because Google has already verified
 * ownership of it (the caller checks `email_verified` before calling this).
 */
export async function findOrCreateGoogleUser(profile: GoogleProfileInput) {
  const byGoogleId = await queryOne<UserRow>('SELECT * FROM users WHERE google_id = ? LIMIT 1', [
    profile.googleId,
  ]);
  if (byGoogleId) {
    if (byGoogleId.is_active === 0) {
      return { success: false, message: 'This account has been deactivated.' };
    }
    await execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [byGoogleId.id]);
    const { password, ...safeUser } = byGoogleId;
    return { success: true, message: 'Login successful', user: normalizeAvatar(safeUser) };
  }

  // Link to an existing account by INBOX identity, not the exact string — so a
  // password account registered as "2004.sanfor@gmail.com" links to the Google
  // profile that returns "2004sanfor@gmail.com" instead of forking a duplicate.
  const emailCanonical = canonicalEmail(profile.email);
  const byEmail = await queryOne<UserRow>('SELECT * FROM users WHERE email_canonical = ? LIMIT 1', [emailCanonical]);
  if (byEmail) {
    if (byEmail.is_active === 0) {
      return { success: false, message: 'This account has been deactivated.' };
    }
    // Link the Google identity and opportunistically fill in any blank profile
    // fields from Google — but ONLY where the account has none yet, so a user's
    // own avatar/name is never overwritten by Google's (`||` treats null AND ''
    // as empty). first/last fall back to splitting the full `name` if Google
    // didn't send the granular claims.
    const [gFirst, ...gRest] = (profile.name || '').trim().split(/\s+/);
    const nextAvatar = byEmail.avatar || profile.picture || null;
    const nextFirst = byEmail.first_name || profile.firstName || gFirst || null;
    const nextLast = byEmail.last_name || profile.lastName || (gRest.length ? gRest.join(' ') : null);
    await execute(
      `UPDATE users SET google_id = ?, avatar = ?, first_name = ?, last_name = ?, last_login_at = NOW() WHERE id = ?`,
      [profile.googleId, nextAvatar, nextFirst, nextLast, byEmail.id]
    );
    byEmail.avatar = nextAvatar;
    byEmail.first_name = nextFirst;
    byEmail.last_name = nextLast;
    const { password, ...safeUser } = byEmail;
    return { success: true, message: 'Login successful', user: normalizeAvatar(safeUser) };
  }

  // Brand-new Google account: seed name + avatar from the profile too (granular
  // claims if present, else split the full name) so it isn't created blank.
  const [gFirst, ...gRest] = (profile.name || '').trim().split(/\s+/);
  const newFirst = profile.firstName || gFirst || null;
  const newLast = profile.lastName || (gRest.length ? gRest.join(' ') : null);
  const username = await uniqueUsername(usernameFromEmail(profile.email));
  const res = await execute(
    `INSERT INTO users (username, email, email_canonical, google_id, avatar, first_name, last_name, is_verified, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
    [username, profile.email, emailCanonical, profile.googleId, profile.picture || null, newFirst, newLast]
  );

  return {
    success: true,
    message: 'Account created successfully',
    user: normalizeAvatar({
      id: res.insertId,
      username,
      email: profile.email,
      avatar: profile.picture || null,
      first_name: newFirst,
      last_name: newLast,
      role: 'user' as const,
      token_version: 0,
    }),
  };
}

export async function updateOnlineStatus(userId: number, isIdle: number = 0) {
  try {
    await execute(
      `INSERT INTO user_online_status (user_id, last_seen, is_idle) 
       VALUES (?, NOW(), ?) 
       ON DUPLICATE KEY UPDATE last_seen = NOW(), is_idle = ?`,
      [userId, isIdle, isIdle]
    );

    await execute(`UPDATE users SET last_active_at = NOW() WHERE id = ?`, [userId]);
    return true;
  } catch (error) {
    console.error('Failed to update online status:', error);
    return false;
  }
}

/**
 * Enqueue an SSE order onto a user's `stream_queue`, delivered by their open
 * `/api/stream` connection on the next loop tick.
 *
 * `touchLastSeen` (default true) bumps `last_seen = NOW()`, which is correct for
 * targeted, user-initiated pushes (a DM, a friend request) — the recipient just
 * "did something" relative to the sender. For broadcast fan-outs (e.g. the
 * "new posts" pill pushed to every friend/follower) pass `false`: bumping
 * last_seen there would make all those recipients spuriously appear ONLINE on
 * presence rails. In no-touch mode we also skip the INSERT — a user who has
 * never connected has no live stream to deliver to, so there's nothing to queue.
 */
export async function pushStreamOrder(
  userId: number,
  orderName: string,
  params: any = {},
  touchLastSeen = true
) {
  try {
    // Append in a SINGLE atomic statement (JSON_ARRAY_APPEND) instead of the old
    // SELECT-then-write: one DB round-trip instead of two (latency), and no
    // read-modify-write race where two concurrent pushes clobber each other's order.
    const orderJson = JSON.stringify({ order_name: orderName, params });

    if (touchLastSeen) {
      // Targeted, user-initiated push: create the row if missing, else append and
      // refresh last_seen (the user is genuinely active relative to this action).
      await execute(
        `INSERT INTO user_online_status (user_id, stream_queue, last_seen)
         VALUES (?, JSON_ARRAY(CAST(? AS JSON)), NOW())
         ON DUPLICATE KEY UPDATE
           stream_queue = JSON_ARRAY_APPEND(COALESCE(stream_queue, JSON_ARRAY()), '$', CAST(? AS JSON)),
           last_seen = NOW()`,
        [userId, orderJson, orderJson]
      );
    } else {
      // Broadcast/delivery (DM, notification, fan-out): append only to an EXISTING
      // row and never touch last_seen — doing so would falsely flip the recipient
      // "online". A user who never connected has no row, so this is a no-op.
      await execute(
        `UPDATE user_online_status
         SET stream_queue = JSON_ARRAY_APPEND(COALESCE(stream_queue, JSON_ARRAY()), '$', CAST(? AS JSON))
         WHERE user_id = ?`,
        [orderJson, userId]
      );
    }
    return true;
  } catch (error) {
    console.error('Failed to push stream order:', error);
    return false;
  }
}

export async function getOnlineStatus(userId: number) {
  try {
    const row = await queryOne<{ last_seen: string; is_idle: number }>(
      `SELECT last_seen, is_idle FROM user_online_status WHERE user_id = ?`,
      [userId]
    );

    if (!row) {
      return { is_online: false, last_seen: null, is_idle: false, label: 'OFFLINE' };
    }

    const { diff, is_online, is_idle } = computeOnlineFields(row.last_seen, row.is_idle);

    let label = 'ONLINE';
    if (!is_online) {
      if (diff < 60) label = `${diff}S AGO`;
      else if (diff < 3600) label = `${Math.floor(diff / 60)}M AGO`;
      else if (diff < 86400) label = `${Math.floor(diff / 3600)}H AGO`;
      else label = `${Math.floor(diff / 86400)}D AGO`;
    }

    return {
      is_online,
      is_idle,
      last_seen: row.last_seen,
      label,
      diff,
    };
  } catch (error) {
    return { is_online: false, last_seen: null, label: 'UNKNOWN' };
  }
}

/** Options controlling how a notification is persisted. */
export interface NotificationOptions {
  /**
   * Coalesce into an existing UNREAD notification of the same `type` for this
   * recipient instead of inserting a fresh row — so "alice and 3 others reposted
   * your post" collapses to ONE row that grows an actor roster. When set, rows
   * are matched on the same `data[aggregateKey]` value (e.g. 'post_id'); pass
   * `true` with no key to bucket purely by type (e.g. followers, which have no
   * per-target id). Re-actions from the same actor never double-count.
   */
  aggregate?: boolean;
  aggregateKey?: string;
}

// How long a read-once notification stays eligible to re-collapse new actors
// into the same roster. Past this, a new actor opens a fresh row.
const NOTIF_AGGREGATE_WINDOW_DAYS = 7;
// Roster preview cap stored on the row; actor_count still reflects the true
// distinct total so "and N others" stays accurate beyond the preview.
const NOTIF_ROSTER_CAP = 5;

/** Pull the acting user out of a notification payload into a roster entry. */
function notificationActor(data: any) {
  return {
    user_id: data.from_user_id ?? null,
    username: data.from_username ?? data.by_user ?? 'Someone',
    avatar: data.from_avatar ?? DEFAULT_AVATAR,
  };
}

/**
 * Fold an incoming notification's actor into a (possibly existing) roster.
 * Dedupes by user_id so a repeat action re-orders rather than inflates, keeps
 * the freshest target fields, and surfaces the latest actor as the lead.
 */
function mergeNotificationActors(prev: any | null, incoming: any) {
  const actor = notificationActor(incoming);
  const prior: any[] = Array.isArray(prev?.actors) ? prev.actors : [];
  const deduped = [actor, ...prior.filter((a) => a.user_id !== actor.user_id)];
  return {
    ...(prev || {}),
    ...incoming,                       // refresh target fields (post_id, message…)
    actors: deduped.slice(0, NOTIF_ROSTER_CAP),
    actor_count: deduped.length,       // true distinct total, not the capped preview
    from_user_id: actor.user_id,
    from_username: actor.username,
    from_avatar: actor.avatar,
  };
}

export async function createNotification(
  userId: number,
  type: string,
  data: any,
  options: NotificationOptions = {}
) {
  try {
    let notificationId: number;
    let payload = data;

    // aggregateKey must be one of OUR controlled field names — guard before it
    // ever reaches a JSON path so the path can never be attacker-influenced.
    const safeKey = options.aggregateKey && /^[a-zA-Z0-9_]+$/.test(options.aggregateKey)
      ? options.aggregateKey
      : null;

    if (options.aggregate) {
      // Find the open roster to grow: same recipient + type, still unread, within
      // the window, optionally scoped to the same target value.
      const where: string[] = [`user_id = ?`, `type = ?`, `is_read = 0`,
        `created_at >= (NOW() - INTERVAL ${NOTIF_AGGREGATE_WINDOW_DAYS} DAY)`];
      const params: any[] = [userId, type];
      if (safeKey && data[safeKey] != null) {
        where.push(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${safeKey}')) = ?`);
        params.push(String(data[safeKey]));
      }
      const existing = await queryOne<{ id: number; data: any }>(
        `SELECT id, data FROM notifications WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 1`,
        params
      );

      if (existing) {
        const prev = typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data;
        payload = mergeNotificationActors(prev, data);
        // Re-surface the roster: bump to now and flip back to unread so a batched
        // update re-alerts the recipient.
        await execute(
          `UPDATE notifications SET data = ?, is_read = 0, created_at = NOW() WHERE id = ?`,
          [JSON.stringify(payload), existing.id]
        );
        notificationId = existing.id;
      } else {
        payload = mergeNotificationActors(null, data);
        const res = await execute(
          `INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)`,
          [userId, type, JSON.stringify(payload)]
        );
        notificationId = res.insertId;
      }
    } else {
      const res = await execute(
        `INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)`,
        [userId, type, JSON.stringify(payload)]
      );
      notificationId = res.insertId;
    }

    // touchLastSeen=false: a notification is delivered TO this user, it is not
    // activity BY them — bumping last_seen would falsely show them online. The
    // row is persisted in `notifications` regardless, so an offline recipient
    // still sees it on their next sync. The id is stable across a coalesce, so
    // the client replaces the existing row in place rather than duplicating it.
    await pushStreamOrder(userId, 'new_notification', {
      id: notificationId,
      type,
      data: payload,
      created_at: new Date().toISOString(),
    }, false);

    return notificationId;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return false;
  }
}

export async function getNotifications(userId: number, limit: number = 20) {
  try {
    const rows = await query<any>(
      `SELECT id, type, data, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ${Math.floor(limit)}`,
      [userId]
    );

    return rows.map((r) => ({
      ...r,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
    }));
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return [];
  }
}

export async function markAllNotificationsRead(userId: number) {
  try {
    await execute(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, [userId]);
    return true;
  } catch (error) {
    console.error('Failed to mark notifications read:', error);
    return false;
  }
}
