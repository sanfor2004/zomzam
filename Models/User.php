<?php

/**
 * User Model
 * 
 * Handles all user-related database operations including authentication,
 * user management, and session handling.
 */
class User extends Base
{
  protected $table = 'users';

  /**
   * Register a new user
   * 
   * @param string $username - Unique username
   * @param string $email - Unique email address
   * @param string $password - Plain text password (will be hashed)
   * @return array - Success status and message/user data
   */
  public function register($username, $email, $password)
  {
    $this->ensureConnection();

    // Validate input
    if (empty($username) || empty($email) || empty($password)) {
      return ['success' => false, 'message' => 'All fields are required'];
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      return ['success' => false, 'message' => 'Invalid email format'];
    }

    // Validate password strength (minimum 8 characters)
    if (strlen($password) < 8) {
      return ['success' => false, 'message' => 'Password must be at least 8 characters'];
    }

    // Check if username already exists
    $checkUsername = $this->pdo->prepare("SELECT id FROM {$this->table} WHERE username = ? LIMIT 1");
    $checkUsername->execute([$username]);
    if ($checkUsername->fetch()) {
      return ['success' => false, 'message' => 'Username already exists'];
    }

    // Check if email already exists
    $checkEmail = $this->pdo->prepare("SELECT id FROM {$this->table} WHERE email = ? LIMIT 1");
    $checkEmail->execute([$email]);
    if ($checkEmail->fetch()) {
      return ['success' => false, 'message' => 'Email already exists'];
    }

    // Hash password using bcrypt
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    // Insert new user
    $insertStmt = $this->pdo->prepare(
      "INSERT INTO {$this->table} (username, email, password, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())"
    );

    try {
      $insertStmt->execute([$username, $email, $hashedPassword]);
      $userId = $this->pdo->lastInsertId();

      return [
        'success' => true,
        'message' => 'User registered successfully',
        'user' => [
          'id' => $userId,
          'username' => $username,
          'email' => $email
        ]
      ];
    } catch (PDOException $e) {
      logMessage("Registration failed for $email: " . $e->getMessage(), 'auth_errors.log');
      return ['success' => false, 'message' => 'Registration failed. Please try again.'];
    }
  }

  /**
   * Authenticate user with email/username and password
   * 
   * @param string $identifier - Username or email
   * @param string $password - Plain text password
   * @return array - Success status and user data/message
   */
  public function login($identifier, $password)
  {
    $this->ensureConnection();

    if (empty($identifier) || empty($password)) {
      return ['success' => false, 'message' => 'Username/Email and password are required'];
    }

    // Find user by username or email
    $stmt = $this->pdo->prepare(
      "SELECT * FROM {$this->table} WHERE username = ? OR email = ? LIMIT 1"
    );
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();

    if (!$user) {
      return ['success' => false, 'message' => 'Invalid credentials'];
    }

    // Verify password
    if (!password_verify($password, $user['password'])) {
      return ['success' => false, 'message' => 'Invalid credentials'];
    }

    // Update last login timestamp
    $updateStmt = $this->pdo->prepare(
      "UPDATE {$this->table} SET last_login_at = NOW() WHERE id = ?"
    );
    $updateStmt->execute([$user['id']]);

    // Remove sensitive data
    unset($user['password']);

    return [
      'success' => true,
      'message' => 'Login successful',
      'user' => $user
    ];
  }

  /**
   * Get user by ID
   * 
   * @param int $userId - User ID
   * @return array|null - User data or null if not found
   */
  public function getUserById($userId)
  {
    $this->ensureConnection();

    $stmt = $this->pdo->prepare(
      "SELECT id, username, first_name, last_name, email, role, avatar, bio, tags, last_login_at, created_at 
       FROM {$this->table} WHERE id = ? LIMIT 1"
    );
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    return $user ? $this->normalizeAvatar($user) : null;
  }

  /**
   * Get user by username
   * 
   * @param string $username - Username
   * @return array|null - User data or null if not found
   */
  public function getUserByUsername($username)
  {
    $this->ensureConnection();

    $stmt = $this->pdo->prepare(
      "SELECT id, username, first_name, last_name, email, role, avatar, bio, tags, last_login_at, created_at 
       FROM {$this->table} WHERE username = ? LIMIT 1"
    );
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    return $user ? $this->normalizeAvatar($user) : null;
  }

  /**
   * Get user by email
   * 
   * @param string $email - Email address
   * @return array|null - User data or null if not found
   */
  public function getUserByEmail($email)
  {
    $this->ensureConnection();

    $stmt = $this->pdo->prepare(
      "SELECT id, username, first_name, last_name, email, role, avatar, bio, last_login_at, created_at 
       FROM {$this->table} WHERE email = ? LIMIT 1"
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    return $user ? $this->normalizeAvatar($user) : null;
  }

  /**
   * Update user profile
   * 
   * @param int $userId - User ID
   * @param array $data - Associative array of fields to update
   * @return array - Success status and message
   */
  public function updateProfile($userId, $data)
  {
    $this->ensureConnection();

    $allowedFields = ['username', 'email', 'avatar', 'bio', 'first_name', 'last_name', 'timezone', 'notifications_enabled'];
    $updates = [];
    $params = [];

    foreach ($data as $field => $value) {
      if (in_array($field, $allowedFields)) {
        $updates[] = "$field = ?";
        $params[] = $value;
      }
    }

    if (empty($updates)) {
      return ['success' => false, 'message' => 'No valid fields to update'];
    }

    $params[] = $userId;
    $sql = "UPDATE {$this->table} SET " . implode(', ', $updates) . " WHERE id = ?";

    try {
      $stmt = $this->pdo->prepare($sql);
      $stmt->execute($params);
      return ['success' => true, 'message' => 'Profile updated successfully'];
    } catch (PDOException $e) {
      logMessage("Profile update failed for user $userId: " . $e->getMessage(), 'user_errors.log');
      return ['success' => false, 'message' => 'Update failed. Please try again.'];
    }
  }

  /**
   * Change user password
   * 
   * @param int $userId - User ID
   * @param string $currentPassword - Current password
   * @param string $newPassword - New password
   * @return array - Success status and message
   */
  public function changePassword($userId, $currentPassword, $newPassword)
  {
    $this->ensureConnection();

    // Get current password hash
    $stmt = $this->pdo->prepare("SELECT password FROM {$this->table} WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
      return ['success' => false, 'message' => 'User not found'];
    }

    // Verify current password
    if (!password_verify($currentPassword, $user['password'])) {
      return ['success' => false, 'message' => 'Current password is incorrect'];
    }

    // Validate new password
    if (strlen($newPassword) < 8) {
      return ['success' => false, 'message' => 'New password must be at least 8 characters'];
    }

    // Hash new password
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

    // Update password
    try {
      $updateStmt = $this->pdo->prepare("UPDATE {$this->table} SET password = ? WHERE id = ?");
      $updateStmt->execute([$hashedPassword, $userId]);
      return ['success' => true, 'message' => 'Password changed successfully'];
    } catch (PDOException $e) {
      logMessage("Password change failed for user $userId: " . $e->getMessage(), 'auth_errors.log');
      return ['success' => false, 'message' => 'Password change failed. Please try again.'];
    }
  }

  /**
   * Delete user account
   * 
   * @param int $userId - User ID
   * @return array - Success status and message
   */
  public function deleteUser($userId)
  {
    $this->ensureConnection();

    try {
      $stmt = $this->pdo->prepare("DELETE FROM {$this->table} WHERE id = ?");
      $stmt->execute([$userId]);
      return ['success' => true, 'message' => 'User deleted successfully'];
    } catch (PDOException $e) {
      logMessage("User deletion failed for user $userId: " . $e->getMessage(), 'user_errors.log');
      return ['success' => false, 'message' => 'Deletion failed. Please try again.'];
    }
  }

  /**
   * Get all users (admin function)
   * 
   * @param int $limit - Number of users to retrieve
   * @param int $offset - Offset for pagination
   * @return array - Array of users
   */
  public function getAllUsers($limit = 50, $offset = 0)
  {
    $this->ensureConnection();

    $stmt = $this->pdo->prepare(
      "SELECT id, username, email, role, avatar, last_active_at, created_at 
       FROM {$this->table} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?"
    );
    $stmt->execute([$limit, $offset]);
    $users = $stmt->fetchAll();
    return array_map([$this, 'normalizeAvatar'], $users);
  }

  /**
   * Count total users
   * 
   * @return int - Total number of users
   */
  public function countUsers()
  {
    $this->ensureConnection();

    $stmt = $this->pdo->query("SELECT COUNT(*) as total FROM {$this->table}");
    $result = $stmt->fetch();
    return $result['total'] ?? 0;
  }

  /**
   * Update user online status
   * 
   * @param int $userId - User ID
   * @return bool - Success status
   */
  public function updateOnlineStatus($userId, $isIdle = 0)
  {
    $this->ensureConnection();
    try {
      // Update user_online_status table
      // Atomic UPSERT - preserve stream_queue if updating last_seen and handle idle state
      $stmt = $this->pdo->prepare("INSERT INTO user_online_status (user_id, last_seen, is_idle) 
                            VALUES (?, NOW(), ?) 
                            ON DUPLICATE KEY UPDATE last_seen = NOW(), is_idle = ?");
      $stmt->execute([$userId, $isIdle, $isIdle]);

      // Update last_active_at in main table for redundant tracking
      $stmt = $this->pdo->prepare("UPDATE users SET last_active_at = NOW() WHERE id = ?");
      $stmt->execute([$userId]);
      return true;
    } catch (PDOException $e) {
      return false;
    }
  }

  /**
   * Push an order to the user's stream queue for SSE delivery
   * 
   * @param int $userId - Target user ID
   * @param string $orderName - Name of the function to execute on client
   * @param array $params - Parameters for the function
   */
  public function pushStreamOrder($userId, $orderName, $params = [])
  {
    $this->ensureConnection();
    try {
      // Get existing queue
      $stmt = $this->pdo->prepare("SELECT stream_queue FROM user_online_status WHERE user_id = ?");
      $stmt->execute([$userId]);
      $queueRaw = $stmt->fetchColumn();

      $queue = $queueRaw ? json_decode($queueRaw, true) : [];
      if (!is_array($queue))
        $queue = [];

      $queue[] = [
        'order_name' => $orderName,
        'params' => $params
      ];

      $stmt = $this->pdo->prepare("INSERT INTO user_online_status (user_id, stream_queue, last_seen) 
                                   VALUES (?, ?, NOW()) 
                                   ON DUPLICATE KEY UPDATE stream_queue = ?, last_seen = NOW()");
      $json = json_encode($queue);
      $stmt->execute([$userId, $json, $json]);
      return true;
    } catch (PDOException $e) {
      return false;
    }
  }

  /**
   * Get user online status
   * 
   * @param int $userId - User ID
   * @return array - Status information
   */
  public function getOnlineStatus($userId)
  {
    $this->ensureConnection();
    try {
      $stmt = $this->pdo->prepare("SELECT last_seen, is_idle FROM user_online_status WHERE user_id = ?");
      $stmt->execute([$userId]);
      $row = $stmt->fetch(PDO::FETCH_ASSOC);

      if (!$row) {
        return ['is_online' => false, 'last_seen' => null, 'is_idle' => false, 'label' => 'OFFLINE'];
      }

      $lastSeenRaw = $row['last_seen'];
      $isIdle = (bool)$row['is_idle'];

      $diff = time() - strtotime($lastSeenRaw);
      $isOnline = $diff < 7; // Use 7s for SSE buffer

      $label = "ONLINE";
      if (!$isOnline) {
        if ($diff < 60)
          $label = $diff . "S AGO";
        elseif ($diff < 3600)
          $label = floor($diff / 60) . "M AGO";
        elseif ($diff < 86400)
          $label = floor($diff / 3600) . "H AGO";
        else
          $label = floor($diff / 86400) . "D AGO";
      }

      return [
        'is_online' => $isOnline,
        'is_idle' => $isIdle && $isOnline, // Only show idle if actually online
        'last_seen' => $lastSeenRaw,
        'label' => $label,
        'diff' => $diff
      ];
    } catch (PDOException $e) {
      return ['is_online' => false, 'last_seen' => null, 'label' => 'UNKNOWN'];
    }
  }

  /**
   * Create a persistent notification and push via SSE
   */
  public function createNotification($userId, $type, $data)
  {
    $this->ensureConnection();
    try {
      $stmt = $this->pdo->prepare("INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)");
      $stmt->execute([$userId, $type, json_encode($data)]);
      $notificationId = $this->pdo->lastInsertId();

      // Push SSE order to update client UI instantly
      $this->pushStreamOrder($userId, 'new_notification', [
        'id' => $notificationId,
        'type' => $type,
        'data' => $data,
        'created_at' => date('Y-m-d H:i:s')
      ]);

      return $notificationId;
    } catch (PDOException $e) {
      return false;
    }
  }

  /**
   * Get notifications for a user
   */
  public function getNotifications($userId, $limit = 20)
  {
    $this->ensureConnection();
    try {
      $stmt = $this->pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?");
      $stmt->execute([$userId, $limit]);
      $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

      foreach ($rows as &$row) {
        $row['data'] = json_decode($row['data'], true);
      }
      return $rows;
    } catch (PDOException $e) {
      return [];
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  public function markAllNotificationsRead($userId)
  {
    $this->ensureConnection();
    try {
      $stmt = $this->pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0");
      $stmt->execute([$userId]);
      return true;
    } catch (PDOException $e) {
      return false;
    }
  }

  /**
   * Normalize avatar field to ensure default avatar if none exists
   * 
   * @param array $user - User data array
   * @return array - User data with normalized avatar
   */
  private function normalizeAvatar($user)
  {
    if (empty($user['avatar'])) {
      $user['avatar'] = '/Assets/Img/default-avatar.png';
    }
    return $user;
  }
}

