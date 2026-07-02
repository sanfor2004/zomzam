import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { getUserById, createNotification, pushStreamOrder, computeOnlineFields, DEFAULT_AVATAR } from '@/lib/models/user';
import { query, queryOne, execute } from '@/lib/db';

function enrichOnline(f: any): any {
  if (!f.last_seen) {
    return { ...f, is_online: false, online_label: 'Offline' };
  }
  const { diff, is_online, is_idle } = computeOnlineFields(f.last_seen, f.is_idle);

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

  return { ...f, is_online, is_idle, online_label };
}

function normalizeAvatar(f: any): any {
  const avatar = f.avatar || DEFAULT_AVATAR;
  let tags = [];
  if (f.tags) {
    if (typeof f.tags === 'string') {
      try {
        tags = JSON.parse(f.tags) || [];
      } catch {}
    } else if (Array.isArray(f.tags)) {
      tags = f.tags;
    }
  }
  return { ...f, avatar, tags };
}

export const POST = withAuth(async (request, user) => {
  const body = await request.json().catch(() => ({}));
  const action = body.action || '';
  const targetId = parseInt(body.user_id || 0);

  if (!action) {
    return NextResponse.json({ success: false, message: 'Action is required' }, { status: 400 });
  }

  if (['friend_request', 'friend_accept', 'friend_decline', 'friend_cancel', 'unfriend', 'block', 'unblock'].includes(action)) {
    if (!targetId || targetId === user.id) {
      return NextResponse.json({ success: false, message: 'Invalid target user' }, { status: 400 });
    }
  }

  switch (action) {
    // ── Connect (LinkedIn-style) ────────────────────────────────
    // One action covers the old follow + add-friend pair: sending a connect
    // request ALSO creates a follow edge, so until (unless) the other side
    // accepts, "pending connect" behaves as "I follow them" — their public
    // posts reach my feed via getFeedAudience. Accepting upgrades the pair to
    // friends; declining silently leaves the requester as a follower.
    // The action keeps its historical name so stored notification rows and
    // the existing DB enum stay valid.
    case 'friend_request': {
      const target = await getUserById(targetId);
      if (!target) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }

      const me = await getUserById(user.id);

      // Check existing
      const existing = await queryOne(
        `SELECT * FROM user_connections WHERE type = 'friend' AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) LIMIT 1`,
        [user.id, targetId, targetId, user.id]
      );

      if (existing) {
        switch (existing.status) {
          case 'accepted':
            return NextResponse.json({ success: false, message: 'Already connected' }, { status: 400 });
          case 'pending':
            if (existing.requester_id === user.id) {
              return NextResponse.json({ success: false, message: 'Request already sent' }, { status: 400 });
            }
            // They asked first — connecting back completes the pair (friends).
            await execute(`UPDATE user_connections SET status = 'accepted', updated_at = NOW() WHERE id = ?`, [existing.id]);
            await createNotification(existing.requester_id, 'friend_accept', {
              from_user_id: user.id,
              from_username: user.username,
              from_avatar: me?.avatar || '/Assets/Img/default-avatar.png',
              message: 'accepted your connection request',
            });
            // Live roster refresh for the original requester: their "Active now"
            // list gains this new connection without a reload.
            await pushStreamOrder(existing.requester_id, 'social_update', {
              action: 'connection_accepted',
              from_user_id: user.id,
            }, false);
            return NextResponse.json({ success: true, message: 'You are now connected' });
          case 'blocked':
            return NextResponse.json({ success: false, message: 'Cannot send request' }, { status: 400 });
          case 'declined':
            await execute(`DELETE FROM user_connections WHERE id = ?`, [existing.id]);
            break;
        }
      }

      await execute(
        `INSERT INTO user_connections (requester_id, addressee_id, type, status) VALUES (?, ?, 'friend', 'pending') ON DUPLICATE KEY UPDATE status = 'pending', updated_at = NOW()`,
        [user.id, targetId]
      );

      // The follow half of Connect — until they accept, I follow them. Silent
      // (no new_follower notification): the connect-request notification below
      // is the single signal, not two.
      await execute(
        `INSERT IGNORE INTO user_connections (requester_id, addressee_id, type, status) VALUES (?, ?, 'follow', 'accepted')`,
        [user.id, targetId]
      );

      await createNotification(targetId, 'friend_request', {
        from_user_id: user.id,
        from_username: user.username,
        from_avatar: me?.avatar || '/Assets/Img/default-avatar.png',
        message: 'wants to connect with you',
      });

      // Live: the recipient's requests page / suggestion rails react instantly.
      await pushStreamOrder(targetId, 'social_update', {
        action: 'request_received',
        from_user_id: user.id,
      }, false);

      return NextResponse.json({ success: true, message: 'Connection request sent' });
    }

    case 'friend_accept': {
      const existing = await queryOne(
        `SELECT id FROM user_connections WHERE requester_id = ? AND addressee_id = ? AND type = 'friend' AND status = 'pending' LIMIT 1`,
        [targetId, user.id]
      );

      if (!existing) {
        return NextResponse.json({ success: false, message: 'No pending request found' }, { status: 404 });
      }

      await execute(`UPDATE user_connections SET status = 'accepted', updated_at = NOW() WHERE id = ?`, [existing.id]);

      const acceptor = await getUserById(user.id);
      await createNotification(targetId, 'friend_accept', {
        from_user_id: user.id,
        from_username: user.username,
        from_avatar: acceptor?.avatar || '/Assets/Img/default-avatar.png',
        message: 'accepted your connection request',
      });

      // Live roster refresh for the requester — the new connection appears in
      // their "Active now" rail the moment this lands, no reload needed.
      await pushStreamOrder(targetId, 'social_update', {
        action: 'connection_accepted',
        from_user_id: user.id,
      }, false);

      return NextResponse.json({ success: true, message: 'Connection accepted' });
    }

    case 'friend_decline': {
      const res = await execute(
        `UPDATE user_connections SET status = 'declined', updated_at = NOW() WHERE requester_id = ? AND addressee_id = ? AND type = 'friend' AND status = 'pending'`,
        [targetId, user.id]
      );

      if (res.affectedRows === 0) {
        return NextResponse.json({ success: false, message: 'No pending request to decline' }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Friend request declined' });
    }

    case 'friend_cancel': {
      const res = await execute(
        `DELETE FROM user_connections WHERE requester_id = ? AND addressee_id = ? AND type = 'friend' AND status = 'pending'`,
        [user.id, targetId]
      );

      if (res.affectedRows === 0) {
        return NextResponse.json({ success: false, message: 'No pending request to cancel' }, { status: 400 });
      }

      // Withdraw the follow half of Connect too — cancelling means "never mind",
      // not "keep me as a follower".
      await execute(
        `DELETE FROM user_connections WHERE requester_id = ? AND addressee_id = ? AND type = 'follow'`,
        [user.id, targetId]
      );

      // Clean up ghost notifications
      await execute(
        `DELETE FROM notifications WHERE user_id = ? AND type = 'friend_request' AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.from_user_id')) = ?`,
        [targetId, String(user.id)]
      );

      // touchLastSeen=false: this targets another user; don't bump their
      // last_seen (would falsely show them online — see new_message/notifications).
      await pushStreamOrder(targetId, 'social_update', {
        action: 'request_cancelled',
        from_user_id: user.id,
      }, false);

      return NextResponse.json({ success: true, message: 'Friend request cancelled' });
    }

    case 'unfriend': {
      const res = await execute(
        `DELETE FROM user_connections WHERE type = 'friend' AND status = 'accepted' AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
        [user.id, targetId, targetId, user.id]
      );

      if (res.affectedRows === 0) {
        return NextResponse.json({ success: false, message: 'Not connected' }, { status: 400 });
      }

      // Disconnecting severs the implied follows in BOTH directions — with no
      // standalone follow UI left, a leftover edge would be invisible and
      // unmanageable.
      await execute(
        `DELETE FROM user_connections WHERE type = 'follow' AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
        [user.id, targetId, targetId, user.id]
      );

      await pushStreamOrder(targetId, 'social_update', {
        action: 'unfriended',
        from_user_id: user.id,
      }, false);

      return NextResponse.json({ success: true, message: 'Disconnected' });
    }

    case 'block': {
      await execute(
        `DELETE FROM user_connections WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
        [user.id, targetId, targetId, user.id]
      );

      await execute(
        `INSERT INTO user_connections (requester_id, addressee_id, type, status) VALUES (?, ?, 'friend', 'blocked')`,
        [user.id, targetId]
      );

      return NextResponse.json({ success: true, message: 'User blocked' });
    }

    case 'unblock': {
      await execute(
        `DELETE FROM user_connections WHERE requester_id = ? AND addressee_id = ? AND status = 'blocked'`,
        [user.id, targetId]
      );

      return NextResponse.json({ success: true, message: 'User unblocked' });
    }

    // The standalone follow / unfollow actions were retired with the Connect
    // rework: the follow edge is now created and withdrawn only as part of the
    // connect lifecycle above. Follow ROWS still power feed reach
    // (getFeedAudience) — only the independent toggles are gone.

    default:
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }
});

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const targetId = parseInt(searchParams.get('user_id') || '0');

  if (!action) {
    return NextResponse.json({ success: false, message: 'Action required' }, { status: 400 });
  }

  switch (action) {
    case 'status': {
      if (!targetId) {
        return NextResponse.json({ success: false, message: 'user_id required' }, { status: 400 });
      }

      const rows = await query(
        `SELECT requester_id, addressee_id, type, status FROM user_connections WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) ORDER BY type ASC, created_at DESC`,
        [user.id, targetId, targetId, user.id]
      );

      let status = 'none';
      let isFollowing = false;

      for (const row of rows) {
        if (row.status === 'blocked') {
          status = row.requester_id === user.id ? 'blocked_by_me' : 'blocked_by_them';
          break;
        }
        if (row.type === 'friend') {
          if (row.status === 'accepted') {
            status = 'friends';
            break;
          }
          if (row.status === 'pending') {
            status = row.requester_id === user.id ? 'friend_pending_out' : 'friend_pending_in';
          }
        }
        if (row.type === 'follow' && row.status === 'accepted' && row.requester_id === user.id) {
          isFollowing = true;
        }
      }

      return NextResponse.json({ success: true, status, is_following: isFollowing });
    }

    case 'friends': {
      const friends = await query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags, uc.created_at AS connected_since, uos.last_seen, uos.is_idle
         FROM user_connections uc
         JOIN users u ON u.id = IF(uc.requester_id = ?, uc.addressee_id, uc.requester_id)
         LEFT JOIN user_online_status uos ON uos.user_id = u.id
         WHERE uc.type = 'friend' AND uc.status = 'accepted' AND (uc.requester_id = ? OR uc.addressee_id = ?)
         ORDER BY u.username ASC`,
        [user.id, user.id, user.id]
      );

      const enriched = friends.map((f) => normalizeAvatar(enrichOnline(f)));
      return NextResponse.json({ success: true, friends: enriched });
    }

    case 'requests_in': {
      const requests = await query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags, uc.created_at AS requested_at
         FROM user_connections uc
         JOIN users u ON u.id = uc.requester_id
         WHERE uc.addressee_id = ? AND uc.type = 'friend' AND uc.status = 'pending'
         ORDER BY uc.created_at DESC`,
        [user.id]
      );
      return NextResponse.json({ success: true, requests: requests.map(normalizeAvatar) });
    }

    case 'requests_out': {
      const requests = await query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags, uc.created_at AS requested_at
         FROM user_connections uc
         JOIN users u ON u.id = uc.addressee_id
         WHERE uc.requester_id = ? AND uc.type = 'friend' AND uc.status = 'pending'
         ORDER BY uc.created_at DESC`,
        [user.id]
      );
      return NextResponse.json({ success: true, requests: requests.map(normalizeAvatar) });
    }

    case 'discover': {
      const myData = await queryOne<{ tags: string }>(
        `SELECT tags FROM users WHERE id = ? LIMIT 1`,
        [user.id]
      );

      let myTags: string[] = [];
      if (myData?.tags) {
        try {
          myTags = JSON.parse(myData.tags) || [];
        } catch {}
      }

      const usersList = await query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags,
           (SELECT COUNT(*) FROM user_connections mf WHERE mf.type = 'friend' AND mf.status = 'accepted' AND (mf.requester_id = u.id OR mf.addressee_id = u.id)) AS friend_count
         FROM users u
         WHERE u.id != ?
           AND u.id NOT IN (
             SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END
             FROM user_connections
             WHERE (requester_id = ? OR addressee_id = ?) AND status != 'declined'
           )
         LIMIT 100`,
        [user.id, user.id, user.id, user.id]
      );

      const enrichedUsers = usersList.map((usr) => {
        const norm = normalizeAvatar(usr);
        const common = norm.tags.filter((t: string) => myTags.includes(t));
        return {
          ...norm,
          matching_tags_count: common.length,
          matching_tags: common,
          friend_count: parseInt(norm.friend_count || 0),
        };
      });

      // Sort: matching tags count descending, friend count descending
      enrichedUsers.sort((a, b) => {
        if (b.matching_tags_count !== a.matching_tags_count) {
          return b.matching_tags_count - a.matching_tags_count;
        }
        return b.friend_count - a.friend_count;
      });

      return NextResponse.json({ success: true, users: enrichedUsers.slice(0, 20) });
    }

    case 'search': {
      const q = (searchParams.get('q') || '').trim();
      if (q.length < 2) {
        return NextResponse.json({ success: true, users: [] });
      }

      const usersList = await query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags
         FROM users u
         WHERE u.id != ? AND u.username LIKE ?
         ORDER BY u.username ASC
         LIMIT 15`,
        [user.id, `%${q}%`]
      );

      return NextResponse.json({ success: true, users: usersList.map(normalizeAvatar) });
    }

    default:
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }
});
export const dynamic = 'force-dynamic';
