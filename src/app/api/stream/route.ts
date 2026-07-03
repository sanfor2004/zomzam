import { withAuth } from '@/lib/api-auth';
import { updateOnlineStatus } from '@/lib/models/user';
import { drainLiveSync, isEmptySync } from '@/lib/live-sync';

// ──────────────────────────────────────────────────────────
// ACTIVE-mode live channel. One SSE connection per engaged user, emitting a
// single structured `sync` event (grouped messages/notifications/posts/social/
// contacts-presence sections built by drainLiveSync — the same shape the AFK
// heartbeat returns, so the client applies both through one code path).
//
// Server-authoritative presence: an OPEN stream ⇒ this user is ACTIVE
// (is_idle = 0). No client flag is read — when the client goes AFK it closes
// this connection and falls back to /api/heartbeat, whose requests mark idle.
//
// Auth-gated: the channel only ever serves the authenticated session's own
// live data — there is no way to watch another user's presence through it.
// ──────────────────────────────────────────────────────────

/** DB poll cadence while a stream is open. */
const TICK_MS = 2000;
/** Contacts-presence snapshot every Nth tick (~20s) — drift, not latency-bound. */
const CONTACTS_EVERY_TICKS = 10;
/** Keepalive comment cadence (proxies drop silent connections). */
const PING_MS = 20000;

export const GET = withAuth(async (request, user) => {
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
            await updateOnlineStatus(user.id, 0);

            const payload = await drainLiveSync(user.id, {
              includeContacts: tick % CONTACTS_EVERY_TICKS === 0,
            });

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
