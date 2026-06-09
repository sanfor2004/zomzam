import { query, queryOne, execute } from '../db';
import { hashPassword, comparePassword } from '../auth';

export interface UserRow {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  password?: string;
  role: 'user' | 'admin' | 'moderator';
  avatar: string | null;
  bio: string | null;
  tags: any | null;
  timezone: string;
  notifications_enabled: number;
  is_active: number;
  is_verified: number;
  primary_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  secondary_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  last_login_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeAvatar(user: Partial<UserRow>) {
  if (user && !user.avatar) {
    user.avatar = '/Assets/Img/default-avatar.png';
  }
  return user;
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

  await execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);

  const { password, ...safeUser } = user;
  return {
    success: true,
    message: 'Login successful',
    user: normalizeAvatar(safeUser),
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

export async function pushStreamOrder(userId: number, orderName: string, params: any = {}) {
  try {
    const row = await queryOne<{ stream_queue: string }>(
      `SELECT stream_queue FROM user_online_status WHERE user_id = ?`,
      [userId]
    );

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

    await execute(
      `INSERT INTO user_online_status (user_id, stream_queue, last_seen) 
       VALUES (?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE stream_queue = ?, last_seen = NOW()`,
      [userId, jsonStr, jsonStr]
    );
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

    const lastSeenTime = new Date(row.last_seen).getTime();
    const diff = Math.floor((Date.now() - lastSeenTime) / 1000);
    const isOnline = diff < 7; // 7 seconds threshold

    let label = 'ONLINE';
    if (!isOnline) {
      if (diff < 60) label = `${diff}S AGO`;
      else if (diff < 3600) label = `${Math.floor(diff / 60)}M AGO`;
      else if (diff < 86400) label = `${Math.floor(diff / 3600)}H AGO`;
      else label = `${Math.floor(diff / 86400)}D AGO`;
    }

    return {
      is_online: isOnline,
      is_idle: !!row.is_idle && isOnline,
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
      `SELECT id, type, data, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
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
