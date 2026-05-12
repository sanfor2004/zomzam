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
      "SELECT id, username, first_name, last_name, email, role, avatar, bio, last_login_at, created_at 
       FROM {$this->table} WHERE id = ? LIMIT 1"
    );
    $stmt->execute([$userId]);
    return $stmt->fetch();
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
      "SELECT id, username, first_name, last_name, email, role, avatar, bio, last_login_at, created_at 
       FROM {$this->table} WHERE username = ? LIMIT 1"
    );
    $stmt->execute([$username]);
    return $stmt->fetch();
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
    return $stmt->fetch();
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

    $allowedFields = ['username', 'email', 'avatar', 'bio', 'first_name', 'last_name'];
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
    return $stmt->fetchAll();
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
}
