import { NextResponse } from 'next/server';
import { updateOnlineStatus, getNotifications } from '@/lib/models/user';
import { withError, getSessionUser } from '@/lib/api-auth';
import { drainLiveSync, parseViewingUserId } from '@/lib/live-sync';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// ──────────────────────────────────────────────────────────
// AFK-mode live channel — the SSE stream's polled twin. While the user is
// away (no input / tab hidden) the client closes its EventSource and beats
// this endpoint every 5s instead; the response `data` is the exact grouped
// payload shape `/api/stream` emits in its `sync` event, so nothing is lost
// across a mode switch and the client applies both via one code path.
//
// Server-authoritative presence: a heartbeat request ⇒ this user is AFK
// (is_idle = 1) by definition of the channel. The old client-asserted `idle`
// body flag is gone — a client can no longer claim to be active; the only
// thing it can "fake" is looking idle, which grants nothing.
//
// Soft auth: also serves anonymous viewers watching a public profile's
// presence (viewed-user status only).
// ──────────────────────────────────────────────────────────

/** Per-caller throttle: the legit cadence is one beat / 5s (+ an occasional
 *  `init` catch-up), so >6 beats in 10s is abuse, not usage. */
const RATE_MAX = 6;
const RATE_WINDOW_MS = 10000;

export const POST = withError(async (request) => {
  const user = await getSessionUser();

  const body = await request.json().catch(() => ({}));
  // Trust-Zero: strict allowlist parse — anything not a positive int is null.
  const viewingUserId = parseViewingUserId(body?.viewing_user_id);
  // Strict boolean — anything but literal true is false. Harmless to spoof:
  // it only returns the caller's OWN notification list.
  const wantsInit = body?.init === true;

  const rateKey = user ? `heartbeat:u:${user.id}` : `heartbeat:ip:${clientIp(request)}`;
  if (!(await rateLimit(rateKey, RATE_MAX, RATE_WINDOW_MS))) {
    return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
  }

  if (user) {
    // Heartbeat channel ⇒ server marks this user IDLE unless this is an initialization/active catch-up request.
    if (wantsInit) {
      await updateOnlineStatus(user.id, 0);
    } else {
      await updateOnlineStatus(user.id, 1);
    }
  }

  const payload = await drainLiveSync(user?.id ?? null, viewingUserId, {
    includeContacts: !!user,
  });

  // Bootstrap: the full recent notification list + unread count, requested once
  // on mount and on AFK→active resume (catch-up), not on every beat.
  let notificationsBootstrap: { count: number; items: any[] } | null = null;
  if (user && wantsInit) {
    const items = await getNotifications(user.id, 10);
    notificationsBootstrap = {
      count: items.filter((n: any) => !n.is_read).length,
      items,
    };
  }

  return NextResponse.json({
    success: true,
    now: new Date().toISOString(),
    data: { ...payload, notifications_bootstrap: notificationsBootstrap },
  });
});
