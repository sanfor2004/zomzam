// ──────────────────────────────────────────────────────────
// NOTIFICATION PRESENTATION (client-safe, pure)
// One source of truth for how a stored notification row is rendered everywhere
// it surfaces — the navbar dropdown AND the live toast. Maps a row to its
// avatar, human sentence (with actor batching), deep-link destination, leading
// emoji, and a relative timestamp. No DB / server imports so it can be pulled
// into client components freely.
// ──────────────────────────────────────────────────────────

export const NOTIF_FALLBACK_AVATAR = '/Assets/Img/default-avatar.png';

/** One actor inside a batched roster (most-recent-first). */
export interface NotificationActor {
  user_id: number | null;
  username: string;
  avatar: string;
}

export interface NotificationRow {
  id: number;
  type: string;
  data: any;
  is_read?: boolean | number;
  created_at?: string;
}

export interface NotificationView {
  /** Avatar of the most recent actor. */
  avatar: string;
  /** Full sentence, e.g. "alice and 2 others reposted your post". */
  text: string;
  /** Where a click should land, or null when the type has no destination. */
  href: string | null;
  /** Leading glyph that signals the notification kind at a glance. */
  emoji: string;
}

/** The lead actor's username + how many distinct actors are batched into the row. */
function actorSummary(d: any): { lead: string; count: number } {
  const lead = d?.actors?.[0]?.username || d?.from_username || d?.by_user || 'Someone';
  const count = Math.max(1, Number(d?.actor_count) || 1);
  return { lead, count };
}

/** "alice" · "alice and 1 other" · "alice and 4 others" — the batched subject. */
function subjectWithOthers(lead: string, count: number): string {
  if (count <= 1) return lead;
  if (count === 2) return `${lead} and 1 other`;
  return `${lead} and ${count - 1} others`;
}

/**
 * Map a notification row to its rendered view. The roster-aware subject means a
 * batched "reposted" / "new_follower" row reads "X and N others …" off the same
 * data the server coalesced (see createNotification's aggregate path).
 */
export function describeNotification(n: NotificationRow): NotificationView {
  const d = n?.data || {};
  const avatar = d.actors?.[0]?.avatar || d.from_avatar || NOTIF_FALLBACK_AVATAR;
  const { lead, count } = actorSummary(d);
  const subject = subjectWithOthers(lead, count);

  const username = d.actors?.[0]?.username || d.from_username || d.by_user;
  const profileHref = username ? `/u/${username}` : null;
  // The permalink is keyed on the opaque public_id, not the numeric post_id, so
  // notifications without one (legacy rows) simply don't deep-link rather than
  // pointing at an id the route no longer resolves.
  const postHref = d.public_id ? `/p/${d.public_id}` : null;

  switch (n.type) {
    case 'reposted':
      return { avatar, text: `${subject} reposted your post`, href: postHref, emoji: '🔁' };
    case 'new_follower':
      return { avatar, text: `${subject} started following you`, href: profileHref, emoji: '➕' };
    case 'new_help_request':
      return {
        avatar,
        text: d.skill_tag ? `${subject} needs help with #${d.skill_tag}` : `${subject} posted a help request`,
        href: postHref,
        emoji: '🆘',
      };
    case 'answer_accepted':
      return { avatar, text: `${subject} accepted your answer`, href: postHref, emoji: '🎉' };
    case 'friend_request':
      return { avatar, text: `${subject} wants to connect with you`, href: profileHref, emoji: '👋' };
    case 'friend_accept':
      return { avatar, text: `${subject} accepted your connection request`, href: profileHref, emoji: '🤝' };
    default:
      // Unknown/legacy types fall back to the stored message; a "message" lands
      // in the inbox, anything else on the actor's profile.
      return {
        avatar,
        text: `${subject} ${d.message || 'sent you a notification'}`,
        href: /message/i.test(d.message || '') ? '/messages' : profileHref,
        emoji: '🔔',
      };
  }
}

/** Compact "now / 5m / 3h / 2d / 4w" relative time for a notification row. */
export function notifTimeAgo(input?: string | null): string {
  if (!input) return '';
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 45) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
