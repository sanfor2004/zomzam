<?php

/**
 * Social Graph API Endpoint — Zomzam Community
 *
 * Actions (POST, param: action):
 *   friend_request   — Send a friend request
 *   friend_accept    — Accept a pending friend request
 *   friend_decline   — Decline a pending friend request
 *   unfriend         — Remove an accepted friendship
 *   block            — Block a user (works for both friend/follow contexts)
 *   unblock          — Remove a block
 *   follow           — Follow a user (instant, no approval)
 *   unfollow         — Unfollow a user
 *
 * Actions (GET, param: action):
 *   status           — Relationship status between me and another user
 *   friends          — My accepted friends list
 *   requests_in      — Pending friend requests I received
 *   requests_out     — Pending friend requests I sent
 *   followers        — Users following me
 *   following        — Users I follow
 *   discover         — Suggested users (not yet connected)
 *   search           — Search users by username
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) session_start();

// ── Auth Guard ────────────────────────────────────────────────────────────────
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
  http_response_code(401);
  echo json_encode(['success' => false, 'message' => 'Unauthorized']);
  exit;
}

$myId     = (int) $_SESSION['user_id'];
$action   = $_GET['action'] ?? $_POST['action'] ?? null;
$pdo      = getConnection();
$userModel = new User();

if (!$action) {
  http_response_code(400);
  echo json_encode(['success' => false, 'message' => 'action parameter required']);
  exit;
}

// ── Router ────────────────────────────────────────────────────────────────────
switch ($action) {

  // ── WRITE actions ──────────────────────────────────────────────────────────

  case 'friend_request':
    postFriendRequest();
    break;

  case 'friend_accept':
    postFriendAccept();
    break;

  case 'friend_decline':
    postFriendDecline();
    break;

  case 'friend_cancel':
    postFriendCancel();
    break;

  case 'unfriend':
    postUnfriend();
    break;

  case 'block':
    postBlock();
    break;

  case 'unblock':
    postUnblock();
    break;

  case 'follow':
    postFollow();
    break;

  case 'unfollow':
    postUnfollow();
    break;

  // ── READ actions ───────────────────────────────────────────────────────────

  case 'status':
    getStatus();
    break;

  case 'friends':
    getFriends();
    break;

  case 'requests_in':
    getRequestsIn();
    break;

  case 'requests_out':
    getRequestsOut();
    break;

  case 'followers':
    getFollowers();
    break;

  case 'following':
    getFollowing();
    break;

  case 'discover':
    getDiscover();
    break;

  case 'search':
    getSearch();
    break;

  default:
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

// =============================================================================
// WRITE HANDLERS
// =============================================================================

/**
 * Send a friend request.
 * Prevents self-friend, duplicates, and handles re-requests after decline.
 */
function postFriendRequest()
{
  global $pdo, $myId, $userModel;

  $targetId = (int) (getInput()['user_id'] ?? 0);
  if (!$targetId || $targetId === $myId) {
    badRequest('Invalid target user');
    return;
  }

  // Verify target exists
  $target = $userModel->getUserById($targetId);
  if (!$target) { badRequest('User not found'); return; }

  // Check existing relationship
  $existing = getConnectionRow($pdo, $myId, $targetId, 'friend');

  if ($existing) {
    switch ($existing['status']) {
      case 'accepted':  badRequest('Already friends'); return;
      case 'pending':
        // Am I the requester or the addressee?
        if ((int)$existing['requester_id'] === $myId) {
          badRequest('Request already sent'); return;
        }
        // They requested me first — auto-accept
        acceptFriendRow($existing['id'], $targetId, $myId);
        return;
      case 'blocked':   badRequest('Cannot send request'); return;
      case 'declined':
        // Allow immediate re-request: delete old row and insert fresh
        $pdo->prepare('DELETE FROM user_connections WHERE id = ?')->execute([$existing['id']]);
        break;
    }
  }

  $stmt = $pdo->prepare(
    'INSERT INTO user_connections (requester_id, addressee_id, type, status)
     VALUES (?, ?, "friend", "pending")
     ON DUPLICATE KEY UPDATE status = "pending", updated_at = NOW()'
  );
  $stmt->execute([$myId, $targetId]);

  // Create persistent notification and trigger SSE
  $me = $userModel->getUserById($myId);
  $userModel->createNotification($targetId, 'friend_request', [
    'from_user_id'  => $myId,
    'from_username' => $me['username'],
    'from_avatar'   => !empty($me['avatar']) ? $me['avatar'] : '/Assets/Img/default-avatar.png',
    'message'       => 'sent you a friend request'
  ]);

  // Keep community tab updates intact
  $userModel->pushStreamOrder($targetId, 'friendRequestReceived', [
    'from_user_id'  => $myId,
    'from_username' => $me['username'],
    'from_avatar'   => !empty($me['avatar']) ? $me['avatar'] : '/Assets/Img/default-avatar.png'
  ]);

  logMessage("Friend request: $myId → $targetId", 'social.log');
  echo json_encode(['success' => true, 'message' => 'Friend request sent']);
}

/**
 * Accept a pending friend request sent TO me.
 */
function postFriendAccept()
{
  global $pdo, $myId, $userModel;

  $requesterId = (int) (getInput()['user_id'] ?? 0);
  if (!$requesterId) { badRequest('user_id required'); return; }

  $row = $pdo->prepare(
    'SELECT id, requester_id FROM user_connections
     WHERE requester_id = ? AND addressee_id = ? AND type = "friend" AND status = "pending" LIMIT 1'
  );
  $row->execute([$requesterId, $myId]);
  $conn = $row->fetch();

  if (!$conn) { badRequest('No pending request found'); return; }

  acceptFriendRow($conn['id'], $requesterId, $myId);
}

/**
 * Shared logic for accepting a friend row.
 */
function acceptFriendRow($rowId, $requesterId, $addresseeId)
{
  global $pdo, $userModel;

  $pdo->prepare(
    'UPDATE user_connections SET status = "accepted", updated_at = NOW() WHERE id = ?'
  )->execute([$rowId]);

  // Create persistent notification and trigger SSE
  $acceptor = $userModel->getUserById($addresseeId);
  $userModel->createNotification($requesterId, 'friend_accept', [
    'from_user_id'  => $addresseeId,
    'from_username' => $acceptor['username'],
    'from_avatar'   => !empty($acceptor['avatar']) ? $acceptor['avatar'] : '/Assets/Img/default-avatar.png',
    'message'       => 'accepted your friend request'
  ]);

  // Keep community tab updates intact
  $userModel->pushStreamOrder($requesterId, 'friendRequestAccepted', [
    'from_user_id'  => $addresseeId,
    'from_username' => $acceptor['username'],
    'from_avatar'   => !empty($acceptor['avatar']) ? $acceptor['avatar'] : '/Assets/Img/default-avatar.png'
  ]);

  logMessage("Friend accepted: $requesterId ↔ $addresseeId", 'social.log');
  echo json_encode(['success' => true, 'message' => 'Friend request accepted']);
}

/**
 * Decline a pending friend request sent TO me.
 */
function postFriendDecline()
{
  global $pdo, $myId;

  $requesterId = (int) (getInput()['user_id'] ?? 0);
  if (!$requesterId) { badRequest('user_id required'); return; }

  $stmt = $pdo->prepare(
    'UPDATE user_connections SET status = "declined", updated_at = NOW()
     WHERE requester_id = ? AND addressee_id = ? AND type = "friend" AND status = "pending"'
  );
  $stmt->execute([$requesterId, $myId]);

  if ($stmt->rowCount() === 0) { badRequest('No pending request to decline'); return; }

  logMessage("Friend declined: $requesterId → $myId", 'social.log');
  echo json_encode(['success' => true, 'message' => 'Friend request declined']);
}

/**
 * Cancel/Undo a pending friend request sent BY me.
 */
function postFriendCancel()
{
  global $pdo, $myId, $userModel;

  $targetId = (int) (getInput()['user_id'] ?? 0);
  if (!$targetId) { badRequest('user_id required'); return; }

  // Delete the connection row
  $stmt = $pdo->prepare(
    'DELETE FROM user_connections
     WHERE requester_id = ? AND addressee_id = ? AND type = "friend" AND status = "pending"'
  );
  $stmt->execute([$myId, $targetId]);

  if ($stmt->rowCount() === 0) { badRequest('No pending request to cancel'); return; }

  // Clean up any corresponding friend_request notification sent to the target user
  // This avoids leaving "ghost notifications" in their notification inbox tray.
  $stmt = $pdo->prepare(
    'DELETE FROM notifications 
     WHERE user_id = ? AND type = "friend_request" AND JSON_UNQUOTE(JSON_EXTRACT(data, "$.from_user_id")) = ?'
  );
  $stmt->execute([$targetId, (string)$myId]);

  // Push SSE update to target user to surgically vanish the incoming request live!
  $userModel->pushStreamOrder($targetId, 'social_update', [
    'action' => 'request_cancelled',
    'from_user_id' => $myId
  ]);

  logMessage("Friend request cancelled: $myId → $targetId", 'social.log');
  echo json_encode(['success' => true, 'message' => 'Friend request cancelled']);
}

/**
 * Remove an accepted friendship (either direction).
 */
function postUnfriend()
{
  global $pdo, $myId, $userModel;

  $targetId = (int) (getInput()['user_id'] ?? 0);
  if (!$targetId) { badRequest('user_id required'); return; }

  $stmt = $pdo->prepare(
    'DELETE FROM user_connections
     WHERE type = "friend" AND status = "accepted"
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))'
  );
  $stmt->execute([$myId, $targetId, $targetId, $myId]);

  if ($stmt->rowCount() === 0) { badRequest('Not friends'); return; }

  // Push SSE update to target user to surgically vanish the friendship card live!
  $userModel->pushStreamOrder($targetId, 'social_update', [
    'action' => 'unfriended',
    'from_user_id' => $myId
  ]);

  logMessage("Unfriended: $myId ↔ $targetId", 'social.log');
  echo json_encode(['success' => true, 'message' => 'Unfriended']);
}

/**
 * Block a user — hard stop for all future interactions.
 * Works regardless of current relationship state.
 */
function postBlock()
{
  global $pdo, $myId;

  $targetId = (int) (getInput()['user_id'] ?? 0);
  if (!$targetId || $targetId === $myId) { badRequest('Invalid user'); return; }

  // Delete any existing connection (friend or follow) between the two
  $pdo->prepare(
    'DELETE FROM user_connections
     WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)'
  )->execute([$myId, $targetId, $targetId, $myId]);

  // Insert a single block row (I am always the requester of the block)
  $pdo->prepare(
    'INSERT INTO user_connections (requester_id, addressee_id, type, status)
     VALUES (?, ?, "friend", "blocked")'
  )->execute([$myId, $targetId]);

  logMessage("Block: $myId → $targetId", 'social.log');
  echo json_encode(['success' => true, 'message' => 'User blocked']);
}

/**
 * Remove my block on a user.
 */
function postUnblock()
{
  global $pdo, $myId;

  $targetId = (int) (getInput()['user_id'] ?? 0);
  if (!$targetId) { badRequest('user_id required'); return; }

  $pdo->prepare(
    'DELETE FROM user_connections
     WHERE requester_id = ? AND addressee_id = ? AND status = "blocked"'
  )->execute([$myId, $targetId]);

  echo json_encode(['success' => true, 'message' => 'User unblocked']);
}

/**
 * Follow a user (instant, no approval needed).
 * Guard: cannot follow a blocked user; cannot follow someone who blocked you.
 */
function postFollow()
{
  global $pdo, $myId, $userModel;

  $targetId = (int) (getInput()['user_id'] ?? 0);
  if (!$targetId || $targetId === $myId) { badRequest('Invalid user'); return; }

  // Block guard
  $blockCheck = $pdo->prepare(
    'SELECT id FROM user_connections
     WHERE status = "blocked"
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
     LIMIT 1'
  );
  $blockCheck->execute([$myId, $targetId, $targetId, $myId]);
  if ($blockCheck->fetch()) { badRequest('Cannot follow this user'); return; }

  $pdo->prepare(
    'INSERT IGNORE INTO user_connections (requester_id, addressee_id, type, status)
     VALUES (?, ?, "follow", "accepted")'
  )->execute([$myId, $targetId]);

  logMessage("Follow: $myId → $targetId", 'social.log');
  echo json_encode(['success' => true, 'message' => 'Now following']);
}

/**
 * Unfollow a user.
 */
function postUnfollow()
{
  global $pdo, $myId;

  $targetId = (int) (getInput()['user_id'] ?? 0);
  if (!$targetId) { badRequest('user_id required'); return; }

  $pdo->prepare(
    'DELETE FROM user_connections
     WHERE requester_id = ? AND addressee_id = ? AND type = "follow"'
  )->execute([$myId, $targetId]);

  echo json_encode(['success' => true, 'message' => 'Unfollowed']);
}

// =============================================================================
// READ HANDLERS
// =============================================================================

/**
 * Get the full relationship status between me and another user.
 * Returns: none | friend_pending_out | friend_pending_in | friends | following | blocked_by_me | blocked_by_them
 */
function getStatus()
{
  global $pdo, $myId;

  $targetId = (int) ($_GET['user_id'] ?? 0);
  if (!$targetId) { badRequest('user_id required'); return; }

  // Check friend row (either direction)
  $stmt = $pdo->prepare(
    'SELECT requester_id, addressee_id, type, status FROM user_connections
     WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
     ORDER BY type ASC, created_at DESC'
  );
  $stmt->execute([$myId, $targetId, $targetId, $myId]);
  $rows = $stmt->fetchAll();

  $status = 'none';
  $isFollowing = false;

  foreach ($rows as $row) {
    if ($row['status'] === 'blocked') {
      $status = ((int)$row['requester_id'] === $myId) ? 'blocked_by_me' : 'blocked_by_them';
      break;
    }
    if ($row['type'] === 'friend') {
      if ($row['status'] === 'accepted') { $status = 'friends'; break; }
      if ($row['status'] === 'pending') {
        $status = ((int)$row['requester_id'] === $myId) ? 'friend_pending_out' : 'friend_pending_in';
      }
      if ($row['status'] === 'declined') { $status = 'none'; }
    }
    if ($row['type'] === 'follow' && $row['status'] === 'accepted' && (int)$row['requester_id'] === $myId) {
      $isFollowing = true;
    }
  }

  echo json_encode(['success' => true, 'status' => $status, 'is_following' => $isFollowing]);
}

/**
 * My friends list (accepted, either direction).
 */
function getFriends()
{
  global $pdo, $myId;

  $stmt = $pdo->prepare(
    'SELECT
       u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags,
       uc.created_at AS connected_since,
       uos.last_seen, uos.is_idle
     FROM user_connections uc
     JOIN users u ON u.id = IF(uc.requester_id = ?, uc.addressee_id, uc.requester_id)
     LEFT JOIN user_online_status uos ON uos.user_id = u.id
     WHERE uc.type = "friend" AND uc.status = "accepted"
       AND (uc.requester_id = ? OR uc.addressee_id = ?)
     ORDER BY u.username ASC'
  );
  $stmt->execute([$myId, $myId, $myId]);
  $friends = $stmt->fetchAll();

  // Enrich with online label and normalize avatars
  foreach ($friends as &$f) {
    $f = enrichOnline($f);
    $f = normalizeAvatar($f);
  }

  echo json_encode(['success' => true, 'friends' => $friends]);
}

/**
 * Pending requests sent TO me (inbox).
 */
function getRequestsIn()
{
  global $pdo, $myId;

  $stmt = $pdo->prepare(
    'SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags, uc.created_at AS requested_at
     FROM user_connections uc
     JOIN users u ON u.id = uc.requester_id
     WHERE uc.addressee_id = ? AND uc.type = "friend" AND uc.status = "pending"
     ORDER BY uc.created_at DESC'
  );
  $stmt->execute([$myId]);
  echo json_encode(['success' => true, 'requests' => $stmt->fetchAll()]);
}

/**
 * Pending requests I SENT (outbox).
 */
function getRequestsOut()
{
  global $pdo, $myId;

  $stmt = $pdo->prepare(
    'SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags, uc.created_at AS requested_at
     FROM user_connections uc
     JOIN users u ON u.id = uc.addressee_id
     WHERE uc.requester_id = ? AND uc.type = "friend" AND uc.status = "pending"
     ORDER BY uc.created_at DESC'
  );
  $stmt->execute([$myId]);
  echo json_encode(['success' => true, 'requests' => $stmt->fetchAll()]);
}

/**
 * Users who follow me.
 */
function getFollowers()
{
  global $pdo, $myId;

  $stmt = $pdo->prepare(
    'SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags, uc.created_at AS followed_at
     FROM user_connections uc
     JOIN users u ON u.id = uc.requester_id
     WHERE uc.addressee_id = ? AND uc.type = "follow" AND uc.status = "accepted"
     ORDER BY uc.created_at DESC'
  );
  $stmt->execute([$myId]);
  $followers = $stmt->fetchAll();
  echo json_encode(['success' => true, 'followers' => normalizeAvatars($followers)]);
}

/**
 * Users I follow.
 */
function getFollowing()
{
  global $pdo, $myId;

  $stmt = $pdo->prepare(
    'SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags, uc.created_at AS followed_at
     FROM user_connections uc
     JOIN users u ON u.id = uc.addressee_id
     WHERE uc.requester_id = ? AND uc.type = "follow" AND uc.status = "accepted"
     ORDER BY uc.created_at DESC'
  );
  $stmt->execute([$myId]);
  $following = $stmt->fetchAll();
  echo json_encode(['success' => true, 'following' => normalizeAvatars($following)]);
}

/**
 * Discover — users I am NOT connected to (neither friend nor follow, not blocked).
 * Returns up to 20 users ordered by recency.
 */
function getDiscover()
{
  global $pdo, $myId;

  // Get current user's tags
  $myStmt = $pdo->prepare('SELECT tags FROM users WHERE id = ? LIMIT 1');
  $myStmt->execute([$myId]);
  $myData = $myStmt->fetch();
  $myTags = $myData && $myData['tags'] ? json_decode($myData['tags'], true) : [];

  $stmt = $pdo->prepare(
    'SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags,
       (SELECT COUNT(*) FROM user_connections mf
        WHERE mf.type = "friend" AND mf.status = "accepted"
          AND (mf.requester_id = u.id OR mf.addressee_id = u.id)) AS friend_count
     FROM users u
     WHERE u.id != ?
       AND u.id NOT IN (
         SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END
         FROM user_connections
         WHERE (requester_id = ? OR addressee_id = ?)
           AND status != "declined"
       )
     LIMIT 100'
  );
  $stmt->execute([$myId, $myId, $myId, $myId]);
  $users = $stmt->fetchAll();

  // Calculate matching tags for each user
  $enrichedUsers = [];
  foreach ($users as $user) {
    // Normalize avatar and parse tags
    $user = normalizeAvatar($user);
    
    $userTags = $user['tags']; // Already an array after normalizeAvatar
    $matchingTags = array_intersect($myTags, $userTags);
    $user['matching_tags_count'] = count($matchingTags);
    $user['matching_tags'] = array_values($matchingTags);
    
    $enrichedUsers[] = $user;
  }

  // Sort by matching tags count (descending), then by friend count, then by recency
  usort($enrichedUsers, function($a, $b) {
    if ($a['matching_tags_count'] !== $b['matching_tags_count']) {
      return $b['matching_tags_count'] - $a['matching_tags_count'];
    }
    if ($a['friend_count'] !== $b['friend_count']) {
      return $b['friend_count'] - $a['friend_count'];
    }
    return 0;
  });

  // Limit to top 20 after sorting
  $enrichedUsers = array_slice($enrichedUsers, 0, 20);

  echo json_encode(['success' => true, 'users' => $enrichedUsers]);
}

/**
 * Search users by username prefix.
 */
function getSearch()
{
  global $pdo, $myId;

  $q = trim($_GET['q'] ?? '');
  if (strlen($q) < 2) {
    echo json_encode(['success' => true, 'users' => []]);
    return;
  }

  $stmt = $pdo->prepare(
    'SELECT u.id, u.username, u.first_name, u.last_name, u.avatar, u.bio, u.tags
     FROM users u
     WHERE u.id != ? AND u.username LIKE ?
     ORDER BY u.username ASC
     LIMIT 15'
  );
  $stmt->execute([$myId, '%' . $q . '%']);
  $users = $stmt->fetchAll();
  echo json_encode(['success' => true, 'users' => normalizeAvatars($users)]);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get existing connection row between two users for a given type.
 * Checks BOTH directions.
 *
 * @param PDO    $pdo
 * @param int    $myId
 * @param int    $targetId
 * @param string $type
 * @return array|false
 */
function getConnectionRow($pdo, $myId, $targetId, $type = 'friend')
{
  $stmt = $pdo->prepare(
    'SELECT * FROM user_connections
     WHERE type = ?
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
     LIMIT 1'
  );
  $stmt->execute([$type, $myId, $targetId, $targetId, $myId]);
  return $stmt->fetch();
}

/**
 * Parse JSON or POST body.
 * @return array
 */
function getInput(): array
{
  $json = json_decode(file_get_contents('php://input'), true);
  return is_array($json) ? $json : $_POST;
}

/**
 * Send a 400 JSON response.
 */
function badRequest(string $message): void
{
  http_response_code(400);
  echo json_encode(['success' => false, 'message' => $message]);
}

/**
 * Enrich a user row with computed online status label.
 */
function enrichOnline(array $user): array
{
  if (empty($user['last_seen'])) {
    $user['is_online'] = false;
    $user['online_label'] = 'Offline';
    return $user;
  }
  $diff = time() - strtotime($user['last_seen']);
  $user['is_online'] = $diff < 7;
  $user['is_idle']   = (bool)($user['is_idle'] ?? false) && $user['is_online'];

  if ($user['is_online']) {
    $user['online_label'] = $user['is_idle'] ? 'Idle' : 'Online';
  } elseif ($diff < 60) {
    $user['online_label'] = $diff . 's ago';
  } elseif ($diff < 3600) {
    $user['online_label'] = floor($diff / 60) . 'm ago';
  } elseif ($diff < 86400) {
    $user['online_label'] = floor($diff / 3600) . 'h ago';
  } else {
    $user['online_label'] = floor($diff / 86400) . 'd ago';
  }

  return $user;
}

/**
 * Normalize avatar field to ensure a default avatar if none exists.
 * Also parse tags from JSON string to array for frontend consumption.
 */
function normalizeAvatar(array $user): array
{
  if (empty($user['avatar'])) {
    $user['avatar'] = '/Assets/Img/default-avatar.png';
  }
  
  // Parse tags from JSON string to array
  if (isset($user['tags'])) {
    if (is_string($user['tags'])) {
      $user['tags'] = json_decode($user['tags'], true) ?: [];
    } elseif (!is_array($user['tags'])) {
      $user['tags'] = [];
    }
  } else {
    $user['tags'] = [];
  }
  
  return $user;
}

/**
 * Normalize avatar for an array of users.
 */
function normalizeAvatars(array $users): array
{
  return array_map('normalizeAvatar', $users);
}
