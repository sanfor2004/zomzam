import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { execute, query } from '@/lib/db';

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated user.
 *
 * POST /api/notifications?action=mark_read
 * Marks all unread notifications as read in the database.
 */

export async function GET(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;

  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const notifications = await query(
      `SELECT id, type, data, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    );

    const parsed = notifications.map((n: any) => ({
      ...n,
      data: typeof n.data === 'string' ? JSON.parse(n.data) : n.data,
    }));

    return NextResponse.json({ success: true, notifications: parsed });
  } catch (error: any) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;

  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'mark_read') {
    try {
      await execute(
        `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
        [user.id]
      );
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    } catch (error: any) {
      console.error('Notifications mark_read error:', error);
      return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
}

export const dynamic = 'force-dynamic';
