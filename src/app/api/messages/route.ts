import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { getUserById, pushStreamOrder, computeOnlineFields, DEFAULT_AVATAR } from '@/lib/models/user';

const MAX_MESSAGE_LENGTH = 2000;

function enrichOnline(row: any): any {
  if (!row.last_seen) {
    return { ...row, is_online: false, online_label: 'Offline' };
  }
  const { diff, is_online, is_idle } = computeOnlineFields(row.last_seen, row.is_idle);
  let online_label = 'Offline';
  if (is_online) {
    online_label = is_idle ? 'Idle' : 'Online';
  } else if (diff < 60) {
    online_label = `${diff}s ago`;
  } else if (diff < 3600) {
    online_label = `${Math.floor(diff / 60)}m ago`;
  } else if (diff < 86400) {
    online_label = `${Math.floor(diff / 3600)}h ago`;
  } else {
    online_label = `${Math.floor(diff / 86400)}d ago`;
  }
  return { ...row, is_online, is_idle, online_label };
}

function normalizeUser(row: any): any {
  return { ...row, avatar: row.avatar || DEFAULT_AVATAR };
}

/** Canonical pair ordering so a 1:1 thread always resolves to one conversation row. */
function pairOf(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

async function findOrCreateConversation(userA: number, userB: number): Promise<number> {
  const [lo, hi] = pairOf(userA, userB);
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM conversations WHERE user_one_id = ? AND user_two_id = ? LIMIT 1`,
    [lo, hi]
  );
  if (existing) return existing.id;

  const res = await execute(
    `INSERT INTO conversations (user_one_id, user_two_id) VALUES (?, ?)`,
    [lo, hi]
  );
  return res.insertId;
}

export async function GET(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;

  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'list': {
        const rows = await query(
          `SELECT c.id AS conversation_id, c.last_message_at,
             u.id AS other_id, u.username, u.first_name, u.last_name, u.avatar,
             uos.last_seen, uos.is_idle,
             (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
             (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_sender_id,
             (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.read_at IS NULL) AS unread_count
           FROM conversations c
           JOIN users u ON u.id = IF(c.user_one_id = ?, c.user_two_id, c.user_one_id)
           LEFT JOIN user_online_status uos ON uos.user_id = u.id
           WHERE c.user_one_id = ? OR c.user_two_id = ?
           ORDER BY c.last_message_at DESC`,
          [user.id, user.id, user.id, user.id]
        );

        return NextResponse.json({
          success: true,
          conversations: rows.map((r: any) => normalizeUser(enrichOnline(r))),
        });
      }

      case 'thread': {
        const otherId = parseInt(searchParams.get('user_id') || '0');
        if (!otherId || otherId === user.id) {
          return NextResponse.json({ success: false, message: 'Invalid user_id' }, { status: 400 });
        }

        const otherUser = await getUserById(otherId);
        if (!otherUser) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }

        const [lo, hi] = pairOf(user.id, otherId);
        const conversation = await queryOne<{ id: number }>(
          `SELECT id FROM conversations WHERE user_one_id = ? AND user_two_id = ? LIMIT 1`,
          [lo, hi]
        );

        if (!conversation) {
          return NextResponse.json({
            success: true,
            conversation_id: null,
            other_user: normalizeUser(otherUser),
            messages: [],
          });
        }

        const messages = await query(
          `SELECT id, conversation_id, sender_id, content, read_at, created_at
           FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200`,
          [conversation.id]
        );

        // Mark the other person's messages as read now that we're viewing the thread.
        await execute(
          `UPDATE messages SET read_at = NOW() WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL`,
          [conversation.id, user.id]
        );

        return NextResponse.json({
          success: true,
          conversation_id: conversation.id,
          other_user: normalizeUser(otherUser),
          messages,
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Messages API GET Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;

  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || '';

    switch (action) {
      case 'send': {
        const recipientId = parseInt(body.recipient_id || 0);
        const content = String(body.content || '').trim().slice(0, MAX_MESSAGE_LENGTH);

        if (!recipientId || recipientId === user.id) {
          return NextResponse.json({ success: false, message: 'Invalid recipient' }, { status: 400 });
        }
        if (!content) {
          return NextResponse.json({ success: false, message: 'Message cannot be empty' }, { status: 400 });
        }

        const recipient = await getUserById(recipientId);
        if (!recipient) {
          return NextResponse.json({ success: false, message: 'Recipient not found' }, { status: 404 });
        }

        const blocked = await queryOne(
          `SELECT id FROM user_connections WHERE type = 'friend' AND status = 'blocked'
           AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) LIMIT 1`,
          [user.id, recipientId, recipientId, user.id]
        );
        if (blocked) {
          return NextResponse.json({ success: false, message: 'You can\'t message this user' }, { status: 403 });
        }

        const conversationId = await findOrCreateConversation(user.id, recipientId);

        const res = await execute(
          `INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)`,
          [conversationId, user.id, content]
        );
        await execute(`UPDATE conversations SET last_message_at = NOW() WHERE id = ?`, [conversationId]);

        const message = {
          id: res.insertId,
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          read_at: null,
          created_at: new Date().toISOString(),
        };

        const me = await getUserById(user.id);
        await pushStreamOrder(recipientId, 'new_message', {
          conversation_id: conversationId,
          message,
          sender: me ? normalizeUser(me) : { id: user.id, username: user.username },
        });

        return NextResponse.json({ success: true, message, conversation_id: conversationId });
      }

      case 'mark_read': {
        const conversationId = parseInt(body.conversation_id || 0);
        if (!conversationId) {
          return NextResponse.json({ success: false, message: 'conversation_id required' }, { status: 400 });
        }

        const conversation = await queryOne<{ user_one_id: number; user_two_id: number }>(
          `SELECT user_one_id, user_two_id FROM conversations WHERE id = ? LIMIT 1`,
          [conversationId]
        );
        if (!conversation || (conversation.user_one_id !== user.id && conversation.user_two_id !== user.id)) {
          return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
        }

        await execute(
          `UPDATE messages SET read_at = NOW() WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL`,
          [conversationId, user.id]
        );

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Messages API POST Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
