import { withError, getSessionUser } from '@/lib/api-auth';
import { updateOnlineStatus } from '@/lib/models/user';
import { drainLiveSync, parseViewingUserId, isEmptySync } from '@/lib/live-sync';

// ──────────────────────────────────────────────────────────
// ACTIVE-mode live channel. One SSE connection per engaged user, emitting a
// single structured `sync` event (grouped messages/notifications/posts/social/
// presence sections built by drainLiveSync — the same shape the AFK heartbeat
// returns, so the client applies both through one code path).
//
// Server-authoritative presence: an OPEN stream ⇒ this user is ACTIVE
// (is_idle = 0). No client flag is read — when the client goes AFK it closes
// this connection and falls back to /api/heartbeat, whose requests mark idle.
//
// Soft auth: the stream also serves anonymous viewers watching another user's
// presence (public profile), so a missing session is allowed — the logged-in
// branches just skip.
// ──────────────────────────────────────────────────────────

/** DB poll cadence while a stream is open. */
const TICK_MS = 2000;
/** Contacts-presence snapshot every Nth tick (~20s) — drift, not latency-bound. */
const CONTACTS_EVERY_TICKS = 10;
/** Keepalive comment cadence (proxies drop silent connections). */
const PING_MS = 20000;

export const GET = withError(async (request) => {
  const { searchParams } = new URL(request.url);
  // Trust-Zero: strict allowlist parse — anything not a positive int is null.
  const viewingUserId = parseViewingUserId(searchParams.get('viewing_user_id'));

  const user = await getSessionUser();
  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    async start(controller) {
      const sendSync = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: sync\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      const sendPing = () => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {}
      };

      // Flush headers immediately so EventSource fires `open` without waiting
      // for the first data tick.
      sendPing();

      let lastViewedStatus: string | null = null;
      let lastPingTime = Date.now();
      let tick = 0;
      let active = true;

      request.signal.addEventListener('abort', () => {
        active = false;
        try {
          controller.close();
        } catch {}
      });

      const loop = async () => {
        while (active) {
          try {
            // Open stream ⇒ server marks this user ACTIVE. Never client-asserted.
            if (user) {
              await updateOnlineStatus(user.id, 0);
            }

            const payload = await drainLiveSync(user?.id ?? null, viewingUserId, {
              includeContacts: !!user && tick % CONTACTS_EVERY_TICKS === 0,
            });

            // Only forward the viewed user's status when it MEANINGFULLY changed —
            // `diff` is a seconds-since-seen counter that ticks on every loop, so
            // it's excluded from the comparison (else every tick would emit).
            if (payload.viewed_user_status) {
              const serialized = JSON.stringify({ ...payload.viewed_user_status, diff: 0 });
              if (serialized === lastViewedStatus) {
                payload.viewed_user_status = null;
              } else {
                lastViewedStatus = serialized;
              }
            }

            if (!isEmptySync(payload)) {
              sendSync(payload);
            }

            if (Date.now() - lastPingTime >= PING_MS) {
              sendPing();
              lastPingTime = Date.now();
            }

            tick++;
            await new Promise((resolve) => setTimeout(resolve, TICK_MS));
          } catch (error) {
            console.error('SSE Stream loop error:', error);
            active = false;
            try {
              controller.close();
            } catch {}
            break;
          }
        }
      };

      loop();
    },
  });

  return new Response(customStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
export const dynamic = 'force-dynamic';
