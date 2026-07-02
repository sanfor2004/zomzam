import { query, transaction } from './db';
import { computeOnlineFields, getOnlineStatus } from './models/user';

// ──────────────────────────────────────────────────────────
// Unified live-sync payload — the single source of truth for BOTH live
// channels: the SSE stream (`/api/stream`, active mode) and the AFK heartbeat
// (`/api/heartbeat`, polled every 5s while the user is away). Both emit the
// exact same grouped JSON shape, so the client applies either one through a
// single code path and switching modes is lossless.
//
// Trust-Zero: everything here derives from the verified session user and
// server-side state. The only client-influenced value is `viewing_user_id`,
// which must pass `parseViewingUserId` before it ever reaches SQL.
// ──────────────────────────────────────────────────────────

/** One queued realtime event, tagged with the order name it was pushed under. */
export interface LiveEvent {
  kind: string;
  params: any;
}

/** Presence snapshot for one accepted friend — merged into the chat dock. */
export interface ContactPresence {
  user_id: number;
  is_online: boolean;
  is_idle: boolean;
  online_label: string;
}

export interface LiveSyncPayload {
  /** new_message | typing | message_read — chat-dock traffic. */
  messages: LiveEvent[];
  /** new_notification — bell feed + toast. */
  notifications: any[];
  /** new_post — "new posts" pill fan-out from people the viewer is connected to. */
  posts: any[];
  /** social_update — connect requests / accepts. */
  social: any[];
  /** Live status of the profile the viewer is watching (public profile page). */
  viewed_user_status: any | null;
  /** Throttled friends-presence snapshot (~every 20s), null when not sampled. */
  contacts_presence: ContactPresence[] | null;
}

/** Bound how many queued orders one drain will process — an abandoned queue
 *  that grew while the user was offline can't stall a sync tick. */
const MAX_DRAIN_ORDERS = 200;
/** Queues untouched for this long only carry stale realtime state: transient
 *  `typing` pings from that far back are meaningless and get discarded. */
const STALE_QUEUE_MS = 10 * 60 * 1000;

/**
 * Strict, allowlist-style parse of a client-supplied "viewing user id".
 * Accepts only a plain positive decimal integer (as number or string) — every
 * other shape (NaN, floats, negatives, hex, arrays, objects) resolves to null
 * so garbage can never reach a SQL parameter.
 */
export function parseViewingUserId(raw: unknown): number | null {
  if (raw == null) return null;
  const str = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (!/^\d{1,10}$/.test(str)) return null;
  const n = Number(str);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Human presence label matching the chat-contacts wire format. */
function presenceLabel(diff: number, isOnline: boolean, isIdle: boolean): string {
  if (isOnline) return isIdle ? 'Idle' : 'Online';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Atomically drain the user's `stream_queue` (SELECT … FOR UPDATE + clear in
 * one transaction) so the SSE loop and an AFK heartbeat can never both deliver
 * the same order during a mode switch.
 */
async function drainQueue(userId: number): Promise<{ orders: any[]; lastSeen: string | null }> {
  return transaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT stream_queue, last_seen FROM user_online_status WHERE user_id = ? FOR UPDATE`,
      [userId]
    );
    const row = (rows as any[])[0];
    if (!row?.stream_queue) return { orders: [], lastSeen: row?.last_seen ?? null };

    await conn.execute(`UPDATE user_online_status SET stream_queue = NULL WHERE user_id = ?`, [userId]);

    let orders: any[] = [];
    try {
      const parsed = typeof row.stream_queue === 'string' ? JSON.parse(row.stream_queue) : row.stream_queue;
      if (Array.isArray(parsed)) orders = parsed.slice(0, MAX_DRAIN_ORDERS);
    } catch { /* corrupt queue ⇒ treat as empty, it's already cleared */ }
    return { orders, lastSeen: row.last_seen ?? null };
  });
}

/** Presence snapshot of every accepted friend (the chat-dock roster). */
async function getContactsPresence(userId: number): Promise<ContactPresence[]> {
  const rows = await query<{ user_id: number; last_seen: string | null; is_idle: number | null }>(
    `SELECT u.id AS user_id, uos.last_seen, uos.is_idle
     FROM user_connections uc
     JOIN users u ON u.id = IF(uc.requester_id = ?, uc.addressee_id, uc.requester_id)
     LEFT JOIN user_online_status uos ON uos.user_id = u.id
     WHERE uc.type = 'friend' AND uc.status = 'accepted'
       AND (uc.requester_id = ? OR uc.addressee_id = ?)`,
    [userId, userId, userId]
  );
  return rows.map((r) => {
    if (!r.last_seen) {
      return { user_id: Number(r.user_id), is_online: false, is_idle: false, online_label: 'Offline' };
    }
    const { diff, is_online, is_idle } = computeOnlineFields(r.last_seen, r.is_idle || 0);
    return {
      user_id: Number(r.user_id),
      is_online,
      is_idle,
      online_label: presenceLabel(diff, is_online, is_idle),
    };
  });
}

/**
 * Build one sync frame: drain the queue into grouped sections, plus optional
 * viewed-user status and throttled contacts presence. `userId` null serves the
 * anonymous case (public profile viewers get presence only).
 */
export async function drainLiveSync(
  userId: number | null,
  viewingUserId: number | null,
  opts: { includeContacts?: boolean } = {}
): Promise<LiveSyncPayload> {
  const payload: LiveSyncPayload = {
    messages: [],
    notifications: [],
    posts: [],
    social: [],
    viewed_user_status: null,
    contacts_presence: null,
  };

  if (userId) {
    const { orders, lastSeen } = await drainQueue(userId);
    const queueIsStale = !lastSeen || Date.now() - new Date(lastSeen).getTime() > STALE_QUEUE_MS;

    for (const order of orders) {
      const kind = order?.order_name;
      const params = order?.params ?? {};
      switch (kind) {
        case 'new_message':
        case 'message_read':
          payload.messages.push({ kind, params });
          break;
        case 'typing':
          // Transient — pointless to replay after a long-dead queue.
          if (!queueIsStale) payload.messages.push({ kind, params });
          break;
        case 'new_notification':
          payload.notifications.push(params);
          break;
        case 'new_post':
          payload.posts.push(params);
          break;
        case 'social_update':
          payload.social.push(params);
          break;
        default:
          // Unknown order names are dropped — never forwarded blind to clients.
          break;
      }
    }

    if (opts.includeContacts) {
      payload.contacts_presence = await getContactsPresence(userId);
    }
  }

  if (viewingUserId) {
    payload.viewed_user_status = await getOnlineStatus(viewingUserId);
  }

  return payload;
}

/** True when a frame carries nothing worth emitting (SSE skips these ticks). */
export function isEmptySync(payload: LiveSyncPayload): boolean {
  return (
    payload.messages.length === 0 &&
    payload.notifications.length === 0 &&
    payload.posts.length === 0 &&
    payload.social.length === 0 &&
    payload.viewed_user_status === null &&
    payload.contacts_presence === null
  );
}
