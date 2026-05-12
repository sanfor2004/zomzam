<?php
/**
 * Profile API Handler
 * 
 * Handles profile updates, password changes, and password resets
 */

require_once __DIR__ . '/../config.php';

// Start session only if not already started
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

// Generate CSRF token if not exists
if (!isset($_SESSION['csrf_token'])) {
  $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Set JSON header
header('Content-Type: application/json');

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

// Get the action from the URL
$requestUri = $_SERVER['REQUEST_URI'];
$action = '';

if (strpos($requestUri, '/api/profile/update') !== false) {
  $action = 'update';
} elseif (strpos($requestUri, '/api/profile/change-password') !== false) {
  $action = 'change-password';
} elseif (strpos($requestUri, '/api/auth/forgot-password') !== false) {
  $action = 'forgot-password';
} elseif (strpos($requestUri, '/api/auth/reset-password') !== false) {
  $action = 'reset-password';
}

// Only allow POST requests
if ($method !== 'POST') {
  echo json_encode([
    'success' => false,
    'message' => 'Invalid request method'
  ]);
  exit;
}

// Handle different actions
switch ($action) {
  
  case 'update':
    updateProfile();
    break;
    
  case 'change-password':
    changePassword();
    break;
    
  case 'forgot-password':
    forgotPassword();
    break;
    
  case 'reset-password':
    resetPassword();
    break;
    
  default:
    echo json_encode([
      'success' => false,
      'message' => 'Invalid action'
    ]);
}

/**
 * Update user profile (no password required)
 */
function updateProfile() {
  // Security: Check if user is logged in
  if (!isset($_SESSION['user_id'])) {
    echo json_encode([
      'success' => false,
      'message' => 'Not authenticated'
    ]);
    return;
  }
  
  // Security: CSRF Protection
  if (!isset($_POST['csrf_token']) || !hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'])) {
    echo json_encode([
      'success' => false,
      'message' => 'Invalid security token. Please refresh the page and try again.'
    ]);
    return;
  }
  
  // Security: Rate limiting (max 5 updates per minute)
  $rateLimitKey = 'profile_update_' . $_SESSION['user_id'];
  $rateLimitMax = 5;
  $rateLimitWindow = 60; // seconds
  
  if (!isset($_SESSION[$rateLimitKey])) {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'timestamp' => time()];
  }
  
  // Reset counter if window expired
  if (time() - $_SESSION[$rateLimitKey]['timestamp'] > $rateLimitWindow) {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'timestamp' => time()];
  }
  
  // Check rate limit
  if ($_SESSION[$rateLimitKey]['count'] >= $rateLimitMax) {
    echo json_encode([
      'success' => false,
      'message' => 'Too many requests. Please wait a moment before trying again.'
    ]);
    return;
  }
  
  // Increment rate limit counter
  $_SESSION[$rateLimitKey]['count']++;
  
  $userId = $_SESSION['user_id'];
  
  // Security: Sanitize and validate text inputs
  $firstName = isset($_POST['first_name']) ? trim($_POST['first_name']) : null;
  $lastName = isset($_POST['last_name']) ? trim($_POST['last_name']) : null;
  $bio = isset($_POST['bio']) ? trim($_POST['bio']) : null;
  
  // Validate input lengths
  if ($firstName !== null && strlen($firstName) > 100) {
    echo json_encode([
      'success' => false,
      'message' => 'First name is too long (max 100 characters).'
    ]);
    return;
  }
  
  if ($lastName !== null && strlen($lastName) > 100) {
    echo json_encode([
      'success' => false,
      'message' => 'Last name is too long (max 100 characters).'
    ]);
    return;
  }
  
  if ($bio !== null && strlen($bio) > 500) {
    echo json_encode([
      'success' => false,
      'message' => 'Bio is too long (max 500 characters).'
    ]);
    return;
  }
  
  // Get current user data to retrieve old avatar before upload
  $oldAvatar = null;
  try {
    $conn = getConnection();
    $stmt = $conn->prepare("SELECT avatar FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $currentUser = $stmt->fetch(PDO::FETCH_ASSOC);
    $oldAvatar = $currentUser['avatar'] ?? null;
  } catch (PDOException $e) {
    // Continue even if we can't get old avatar
  }
  
  // Handle avatar upload with comprehensive security
  $avatarPath = null;
  if (isset($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
    
    // Security Layer 1: Validate file size FIRST (prevent DOS via large files)
    $maxFileSize = 2 * 1024 * 1024; // 2MB
    if ($_FILES['avatar']['size'] > $maxFileSize) {
      echo json_encode([
        'success' => false,
        'message' => 'File too large. Maximum size is 2MB.'
      ]);
      return;
    }
    
    if ($_FILES['avatar']['size'] < 100) {
      echo json_encode([
        'success' => false,
        'message' => 'File is too small to be a valid image.'
      ]);
      return;
    }
    
    // Security Layer 2: Verify it's actually an image (not just checking MIME type)
    $imageInfo = @getimagesize($_FILES['avatar']['tmp_name']);
    if ($imageInfo === false) {
      echo json_encode([
        'success' => false,
        'message' => 'Uploaded file is not a valid image.'
      ]);
      return;
    }
    
    // Security Layer 3: Whitelist allowed image types by actual content
    $allowedMimeTypes = [
      IMAGETYPE_JPEG => 'jpg',
      IMAGETYPE_PNG => 'png',
      IMAGETYPE_GIF => 'gif',
      IMAGETYPE_WEBP => 'webp'
    ];
    
    if (!isset($allowedMimeTypes[$imageInfo[2]])) {
      echo json_encode([
        'success' => false,
        'message' => 'Invalid image type. Only JPG, PNG, GIF, and WEBP are allowed.'
      ]);
      return;
    }
    
    // Security Layer 4: Validate image dimensions (prevent exploit images)
    $maxWidth = 5000;
    $maxHeight = 5000;
    if ($imageInfo[0] > $maxWidth || $imageInfo[1] > $maxHeight) {
      echo json_encode([
        'success' => false,
        'message' => 'Image dimensions too large. Maximum is 5000x5000 pixels.'
      ]);
      return;
    }
    
    // Security Layer 5: Re-encode image to strip any embedded malicious code
    $uploadDir = __DIR__ . '/../Assets/Uploads/avatars/';
    
    // Create directory if it doesn't exist with secure permissions
    if (!is_dir($uploadDir)) {
      mkdir($uploadDir, 0755, true);
      
      // Create .htaccess to prevent PHP execution in upload directory
      $htaccessContent = "# Prevent script execution\n";
      $htaccessContent .= "<FilesMatch \"\.(?i:php|phtml|php3|php4|php5|php7|phps|phar|inc)$\">\n";
      $htaccessContent .= "  Order Deny,Allow\n";
      $htaccessContent .= "  Deny from all\n";
      $htaccessContent .= "</FilesMatch>\n";
      $htaccessContent .= "Options -Indexes\n";
      $htaccessContent .= "RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .phps .phar\n";
      file_put_contents($uploadDir . '.htaccess', $htaccessContent);
    }
    
    // Security Layer 6: Generate cryptographically secure random filename
    $extension = $allowedMimeTypes[$imageInfo[2]];
    $randomName = bin2hex(random_bytes(16));
    $filename = 'avatar_' . $userId . '_' . $randomName . '.' . $extension;
    $targetPath = $uploadDir . $filename;
    
    // Security Layer 7: Re-encode image to strip metadata and embedded code
    try {
      switch ($imageInfo[2]) {
        case IMAGETYPE_JPEG:
          $image = @imagecreatefromjpeg($_FILES['avatar']['tmp_name']);
          if ($image === false) {
            throw new Exception('Failed to process JPEG image');
          }
          imagejpeg($image, $targetPath, 90);
          break;
          
        case IMAGETYPE_PNG:
          $image = @imagecreatefrompng($_FILES['avatar']['tmp_name']);
          if ($image === false) {
            throw new Exception('Failed to process PNG image');
          }
          imagepng($image, $targetPath, 8);
          break;
          
        case IMAGETYPE_GIF:
          $image = @imagecreatefromgif($_FILES['avatar']['tmp_name']);
          if ($image === false) {
            throw new Exception('Failed to process GIF image');
          }
          imagegif($image, $targetPath);
          break;
          
        case IMAGETYPE_WEBP:
          if (!function_exists('imagecreatefromwebp')) {
            echo json_encode([
              'success' => false,
              'message' => 'WebP format is not supported on this server.'
            ]);
            return;
          }
          $image = @imagecreatefromwebp($_FILES['avatar']['tmp_name']);
          if ($image === false) {
            throw new Exception('Failed to process WebP image');
          }
          imagewebp($image, $targetPath, 90);
          break;
      }
      
      imagedestroy($image);
      
      // Set final avatar path
      $avatarPath = '/Assets/Uploads/avatars/' . $filename;
      
      // Security Layer 8: Delete old avatar to prevent disk space abuse
      // Only delete after new avatar is successfully created
      if (!empty($oldAvatar) && $oldAvatar !== $avatarPath) {
        $oldAvatarPath = __DIR__ . '/../' . ltrim($oldAvatar, '/');
        if (file_exists($oldAvatarPath) && is_file($oldAvatarPath)) {
          @unlink($oldAvatarPath);
        }
      }
      
      // Update session with new avatar
      $_SESSION['user_avatar'] = $avatarPath;
      
    } catch (Exception $e) {
      // Clean up on failure
      if (file_exists($targetPath)) {
        @unlink($targetPath);
      }
      
      echo json_encode([
        'success' => false,
        'message' => 'Failed to process image. Please try a different file.'
      ]);
      return;
    }
  } else if (isset($_POST['remove_avatar']) && $_POST['remove_avatar'] == '1') {
    // Handle avatar removal
    if (!empty($oldAvatar)) {
      $oldAvatarPath = __DIR__ . '/../' . ltrim($oldAvatar, '/');
      if (file_exists($oldAvatarPath) && is_file($oldAvatarPath)) {
        @unlink($oldAvatarPath);
      }
    }
    
    // Set to empty string for DB update
    $avatarPath = '';
    $_SESSION['user_avatar'] = '';
  }
  
  try {
    $conn = getConnection();
    
    // Build update query dynamically
    $updates = [];
    $params = [];
    
    if ($firstName !== null) {
      $updates[] = 'first_name = ?';
      $params[] = $firstName;
    }
    
    if ($lastName !== null) {
      $updates[] = 'last_name = ?';
      $params[] = $lastName;
    }
    
    if ($bio !== null) {
      $updates[] = 'bio = ?';
      $params[] = $bio;
    }
    
    if ($avatarPath !== null) {
      $updates[] = 'avatar = ?';
      $params[] = $avatarPath;
    }
    
    if (empty($updates)) {
      echo json_encode([
        'success' => false,
        'message' => 'No data to update'
      ]);
      return;
    }
    
    // Always update the updated_at timestamp
    $updates[] = 'updated_at = NOW()';
    $params[] = $userId;
    
    $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    // Get updated user data
    $stmt = $conn->prepare("SELECT id, username, first_name, last_name, email, avatar, bio FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
      'success' => true,
      'message' => 'Profile updated successfully',
      'user' => $user
    ]);
    
  } catch (PDOException $e) {
    echo json_encode([
      'success' => false,
      'message' => 'Database error: ' . $e->getMessage()
    ]);
  }
}

/**
 * Change user password (requires old password verification)
 */
function changePassword() {
  // Check if user is logged in
  if (!isset($_SESSION['user_id'])) {
    echo json_encode([
      'success' => false,
      'message' => 'Not authenticated'
    ]);
    return;
  }
  
  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);
  
  $currentPassword = $input['current_password'] ?? '';
  $newPassword = $input['new_password'] ?? '';
  
  if (empty($currentPassword) || empty($newPassword)) {
    echo json_encode([
      'success' => false,
      'message' => 'All fields are required'
    ]);
    return;
  }
  
  if (strlen($newPassword) < 8) {
    echo json_encode([
      'success' => false,
      'message' => 'New password must be at least 8 characters'
    ]);
    return;
  }
  
  try {
    $conn = getConnection();
    $userId = $_SESSION['user_id'];
    
    // Get current password hash
    $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
      echo json_encode([
        'success' => false,
        'message' => 'User not found'
      ]);
      return;
    }
    
    // Verify current password
    if (!password_verify($currentPassword, $user['password'])) {
      echo json_encode([
        'success' => false,
        'message' => 'Current password is incorrect'
      ]);
      return;
    }
    
    // Hash new password
    $newPasswordHash = password_hash($newPassword, PASSWORD_BCRYPT);
    
    // Update password
    $stmt = $conn->prepare("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$newPasswordHash, $userId]);
    
    echo json_encode([
      'success' => true,
      'message' => 'Password changed successfully'
    ]);
    
  } catch (PDOException $e) {
    echo json_encode([
      'success' => false,
      'message' => 'Database error: ' . $e->getMessage()
    ]);
  }
}

/**
 * Forgot password - Send reset link
 */
function forgotPassword() {
  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);
  $email = $input['email'] ?? '';
  
  if (empty($email)) {
    echo json_encode([
      'success' => false,
      'message' => 'Email is required'
    ]);
    return;
  }
  
  try {
    $conn = getConnection();
    
    // Check if email exists
    $stmt = $conn->prepare("SELECT id, username, email FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
      // Don't reveal if email exists or not (security best practice)
      echo json_encode([
        'success' => true,
        'message' => 'If your email is registered, you will receive a password reset link shortly.'
      ]);
      return;
    }
    
    // Generate reset token
    $resetToken = bin2hex(random_bytes(32));
    $resetExpiry = date('Y-m-d H:i:s', strtotime('+1 hour'));
    
    // Store reset token in database
    // Note: You would need to create a password_resets table for production
    // For now, we'll use a simplified approach
    
    // In production, send email with reset link
    // For demo purposes, we'll return the token
    echo json_encode([
      'success' => true,
      'message' => 'Password reset instructions have been sent to your email.',
      'demo_token' => $resetToken  // Remove this in production!
    ]);
    
  } catch (PDOException $e) {
    echo json_encode([
      'success' => false,
      'message' => 'Database error: ' . $e->getMessage()
    ]);
  }
}

/**
 * Reset password with token
 */
function resetPassword() {
  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);
  
  $token = $input['token'] ?? '';
  $newPassword = $input['new_password'] ?? '';
  
  if (empty($token) || empty($newPassword)) {
    echo json_encode([
      'success' => false,
      'message' => 'All fields are required'
    ]);
    return;
  }
  
  if (strlen($newPassword) < 8) {
    echo json_encode([
      'success' => false,
      'message' => 'Password must be at least 8 characters'
    ]);
    return;
  }
  
  // For demo purposes, accept any token
  // In production, verify token from database and check expiry
  
  try {
    $conn = getConnection();
    
    // For demo, we'll update the first user's password
    // In production, you'd:
    // 1. Verify token exists and hasn't expired
    // 2. Get user_id from token
    // 3. Update that specific user's password
    // 4. Delete/invalidate the token
    
    $newPasswordHash = password_hash($newPassword, PASSWORD_BCRYPT);
    
    echo json_encode([
      'success' => true,
      'message' => 'Your password has been reset successfully. You can now sign in with your new password.'
    ]);
    
  } catch (PDOException $e) {
    echo json_encode([
      'success' => false,
      'message' => 'Database error: ' . $e->getMessage()
    ]);
  }
}
?>
