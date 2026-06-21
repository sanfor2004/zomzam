import { withError, getSessionUser } from '@/lib/api-auth';
import { getOnlineStatus, updateOnlineStatus } from '@/lib/models/user';
import { queryOne, execute } from '@/lib/db';

// Soft auth: the SSE feed also serves anonymous viewers watching another user's
// presence, so a missing session is allowed — the logged-in-only branches just
// skip. withError centralizes the boundary for the synchronous setup phase.
export const GET = withError(async (request) => {
  const { searchParams } = new URL(request.url);
  const viewingUserIdParam = searchParams.get('viewing_user_id');
  const viewingUserId = viewingUserIdParam ? parseInt(viewingUserIdParam) : null;

  const user = await getSessionUser();

  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    async start(controller) {
      const sendSSE = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      const sendPing = () => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {}
      };

      // Initial connection established message
      sendSSE('order', {
        order_name: 'connection_established',
        params: { timestamp: new Date().toISOString() },
      });

      let lastViewedStatus: any = null;
      let lastPingTime = Date.now();
      let active = true;

      // Monitor connection abort
      request.signal.addEventListener('abort', () => {
        active = false;
        try {
          controller.close();
        } catch {}
      });

      const loop = async () => {
        while (active) {
          try {
            let currentIdle = 0;

            if (user) {
              const row = await queryOne<{ is_idle: number }>(
                `SELECT is_idle FROM user_online_status WHERE user_id = ?`,
                [user.id]
              );
              currentIdle = row?.is_idle || 0;
              await updateOnlineStatus(user.id, currentIdle);
            }

            const orders: any[] = [];

            if (viewingUserId) {
              const currentStatus = await getOnlineStatus(viewingUserId);
              if (JSON.stringify(currentStatus) !== JSON.stringify(lastViewedStatus)) {
                orders.push({
                  order_name: 'update_viewed_user_status',
                  params: currentStatus,
                });
                lastViewedStatus = currentStatus;
              }
            }

            if (user) {
              const row = await queryOne<{ stream_queue: string }>(
                `SELECT stream_queue FROM user_online_status WHERE user_id = ?`,
                [user.id]
              );

              if (row?.stream_queue) {
                try {
                  const queuedOrders = JSON.parse(row.stream_queue);
                  if (Array.isArray(queuedOrders)) {
                    orders.push(...queuedOrders);
                  }
                } catch {}

                await execute(`UPDATE user_online_status SET stream_queue = NULL WHERE user_id = ?`, [
                  user.id,
                ]);
              }
            }

            for (const order of orders) {
              sendSSE('order', order);
            }

            // Send keepalive ping every 20s
            if (Date.now() - lastPingTime >= 20000) {
              sendPing();
              lastPingTime = Date.now();
            }

            const sleepTime = currentIdle === 1 ? 5000 : 2000;
            await new Promise((resolve) => setTimeout(resolve, sleepTime));
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
