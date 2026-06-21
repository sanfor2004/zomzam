import { NextResponse } from 'next/server';
import { updateOnlineStatus, getOnlineStatus, getNotifications } from '@/lib/models/user';
import { withError, getSessionUser } from '@/lib/api-auth';

// Soft auth: heartbeat also serves anonymous viewers (it returns the viewed
// user's online status), so a missing/invalid session is allowed — we just skip
// the logged-in-only work. withError still centralizes the 500 boundary.
export const POST = withError(async (request) => {
  const user = await getSessionUser();

  const body = await request.json().catch(() => ({}));
  const isIdle = body.idle ? 1 : 0;
  const viewingUserId = body.viewing_user_id;

  if (user) {
    await updateOnlineStatus(user.id, isIdle);
  }

  const responseData: any = {
    user_status: null,
    notifications: {
      count: 0,
      items: [],
    },
  };

  if (viewingUserId) {
    responseData.user_status = await getOnlineStatus(parseInt(viewingUserId));
  }

  if (user) {
    const notifications = await getNotifications(user.id, 10);
    responseData.notifications = {
      count: notifications.filter((n: any) => !n.is_read).length,
      items: notifications,
    };
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    data: responseData,
  });
});
