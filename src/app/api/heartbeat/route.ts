import { NextRequest, NextResponse } from 'next/server';
import { updateOnlineStatus, getOnlineStatus, getNotifications } from '@/lib/models/user';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;

  try {
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
  } catch (error: any) {
    console.error('Heartbeat API error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
