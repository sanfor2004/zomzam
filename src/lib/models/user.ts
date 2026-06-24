import { query, queryOne, execute } from '../db';
import { hashPassword, comparePassword } from '../auth';

export interface UserRow {
  id: number;
  username: string;
  email: string;
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
 * Returns online status fields from a DB-fetched last_seen timestamp.
 * Exported so list endpoints can enrich joined user rows without re-querying.
 */
export function computeOnlineFields(lastSeen: string, isIdleFlag: number | boolean) {
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  const is_online = diff < 7;
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

  // Check unique email
  const existEmail = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existEmail) {
    return { success: false, message: 'Email already exists' };
  }

  const hashedPassword = await hashPassword(passwordPlain);

  const res = await execute(
    `INSERT INTO users (username, email, password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
    [cleanUsername, email, hashedPassword]
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

  const user = await queryOne<UserRow>(
    `SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1`,
    [identifier, identifier]
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

  const byEmail = await queryOne<UserRow>('SELECT * FROM users WHERE email = ? LIMIT 1', [profile.email]);
  if (byEmail) {
    if (byEmail.is_active === 0) {
      return { success: false, message: 'This account has been deactivated.' };
    }
    await execute(`UPDATE users SET google_id = ?, last_login_at = NOW() WHERE id = ?`, [
      profile.googleId,
      byEmail.id,
    ]);
    const { password, ...safeUser } = byEmail;
    return { success: true, message: 'Login successful', user: normalizeAvatar(safeUser) };
  }

  const username = await uniqueUsername(usernameFromEmail(profile.email));
  const res = await execute(
    `INSERT INTO users (username, email, google_id, avatar, is_verified, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
    [username, profile.email, profile.googleId, profile.picture || null]
  );

  return {
    success: true,
    message: 'Account created successfully',
    user: normalizeAvatar({
      id: res.insertId,
      username,
      email: profile.email,
      avatar: profile.picture || null,
      role: 'user' as const,
      token_version: 0,
    }),
  };
}

export interface FacebookProfileInput {
  facebookId: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Finds the user tied to this Facebook account, links an existing email
 * account on first Facebook sign-in, or creates a brand-new password-less
 * account. Email is trusted for linking because Facebook only hands back the
 * `email` field for accounts it has already confirmed (the caller checks for
 * its presence before calling this).
 */
export async function findOrCreateFacebookUser(profile: FacebookProfileInput) {
  const byFacebookId = await queryOne<UserRow>('SELECT * FROM users WHERE facebook_id = ? LIMIT 1', [
    profile.facebookId,
  ]);
  if (byFacebookId) {
    if (byFacebookId.is_active === 0) {
      return { success: false, message: 'This account has been deactivated.' };
    }
    await execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [byFacebookId.id]);
    const { password, ...safeUser } = byFacebookId;
    return { success: true, message: 'Login successful', user: normalizeAvatar(safeUser) };
  }

  const byEmail = await queryOne<UserRow>('SELECT * FROM users WHERE email = ? LIMIT 1', [profile.email]);
  if (byEmail) {
    if (byEmail.is_active === 0) {
      return { success: false, message: 'This account has been deactivated.' };
    }
    await execute(`UPDATE users SET facebook_id = ?, last_login_at = NOW() WHERE id = ?`, [
      profile.facebookId,
      byEmail.id,
    ]);
    const { password, ...safeUser } = byEmail;
    return { success: true, message: 'Login successful', user: normalizeAvatar(safeUser) };
  }

  const username = await uniqueUsername(usernameFromEmail(profile.email));
  const res = await execute(
    `INSERT INTO users (username, email, facebook_id, avatar, is_verified, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
    [username, profile.email, profile.facebookId, profile.picture || null]
  );

  return {
    success: true,
    message: 'Account created successfully',
    user: normalizeAvatar({
      id: res.insertId,
      username,
      email: profile.email,
      avatar: profile.picture || null,
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
    const row = await queryOne<{ stream_queue: string }>(
      `SELECT stream_queue FROM user_online_status WHERE user_id = ?`,
      [userId]
    );

    // No-touch fan-out to a user who has never connected: nothing to deliver to.
    if (!touchLastSeen && !row) return false;

    let queue: any[] = [];
    if (row?.stream_queue) {
      try {
        queue = JSON.parse(row.stream_queue);
        if (!Array.isArray(queue)) queue = [];
      } catch {
        queue = [];
      }
    }

    queue.push({ order_name: orderName, params });
    const jsonStr = JSON.stringify(queue);

    if (touchLastSeen) {
      await execute(
        `INSERT INTO user_online_status (user_id, stream_queue, last_seen)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE stream_queue = ?, last_seen = NOW()`,
        [userId, jsonStr, jsonStr]
      );
    } else {
      await execute(
        `UPDATE user_online_status SET stream_queue = ? WHERE user_id = ?`,
        [jsonStr, userId]
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

export async function createNotification(userId: number, type: string, data: any) {
  try {
    const res = await execute(
      `INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)`,
      [userId, type, JSON.stringify(data)]
    );

    const notificationId = res.insertId;

    await pushStreamOrder(userId, 'new_notification', {
      id: notificationId,
      type,
      data,
      created_at: new Date().toISOString(),
    });

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
