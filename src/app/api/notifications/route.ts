import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { markAllNotificationsRead } from '@/lib/models/user';

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated user.
 *
 * POST /api/notifications?action=mark_read
 * Marks all unread notifications as read in the database.
 */

export const GET = withAuth(async (request, user) => {
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
});

export const POST = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'mark_read') {
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ success: true, message: 'All notifications marked as read' });
  }

  return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
});

export const dynamic = 'force-dynamic';
