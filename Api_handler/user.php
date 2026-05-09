<?php

/**
 * User Profile API Endpoint
 * 
 * Handles user profile operations:
 * - GET /api_handler/user.php?action=profile&id={userId} - Get user profile
 * - POST /api_handler/user.php?action=update - Update user profile
 * - POST /api_handler/user.php?action=change_password - Change password
 * - DELETE /api_handler/user.php?action=delete - Delete account
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';

// Start session for authentication
session_start();

// Only allow authenticated requests
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
  http_response_code(401);
  echo json_encode(['success' => false, 'message' => 'Unauthorized. Please login first.']);
  exit;
}

// Get action parameter
$action = $_GET['action'] ?? $_POST['action'] ?? null;

if (!$action) {
  http_response_code(400);
  echo json_encode(['success' => false, 'message' => 'Action parameter is required']);
  exit;
}

// Initialize User model
$userModel = new User();

// Route to appropriate action
switch ($action) {
  case 'profile':
    handleGetProfile();
    break;

  case 'update':
    handleUpdateProfile();
    break;

  case 'change_password':
    handleChangePassword();
    break;

  case 'delete':
    handleDeleteAccount();
    break;

  default:
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    break;
}

/**
 * Get user profile
 */
function handleGetProfile()
{
  global $userModel;

  // Allow fetching own profile or other users (public data only)
  $userId = $_GET['id'] ?? $_SESSION['user_id'];

  $user = $userModel->getUserById($userId);

  if ($user) {
    http_response_code(200);
    echo json_encode([
      'success' => true,
      'user' => $user
    ]);
  } else {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'User not found']);
  }
}

/**
 * Update user profile
 */
function handleUpdateProfile()
{
  global $userModel;

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    return;
  }

  // Get input data
  $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

  // Only allow updating own profile
  $userId = $_SESSION['user_id'];

  // Prepare update data
  $updateData = [];
  $allowedFields = ['username', 'email', 'avatar', 'bio'];

  foreach ($allowedFields as $field) {
    if (isset($input[$field])) {
      $updateData[$field] = trim($input[$field]);
    }
  }

  if (empty($updateData)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No valid fields to update']);
    return;
  }

  // Update profile
  $result = $userModel->updateProfile($userId, $updateData);

  if ($result['success']) {
    // Update session data if username or email changed
    if (isset($updateData['username'])) {
      $_SESSION['username'] = $updateData['username'];
    }
    if (isset($updateData['email'])) {
      $_SESSION['email'] = $updateData['email'];
    }

    logMessage("User profile updated: {$_SESSION['username']} (ID: $userId)", 'user.log');
    http_response_code(200);
  } else {
    http_response_code(400);
  }

  echo json_encode($result);
}

/**
 * Change user password
 */
function handleChangePassword()
{
  global $userModel;

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    return;
  }

  // Get input data
  $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

  $currentPassword = $input['current_password'] ?? '';
  $newPassword = $input['new_password'] ?? '';

  if (empty($currentPassword) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Current and new passwords are required']);
    return;
  }

  // Change password
  $userId = $_SESSION['user_id'];
  $result = $userModel->changePassword($userId, $currentPassword, $newPassword);

  if ($result['success']) {
    logMessage("Password changed for user: {$_SESSION['username']} (ID: $userId)", 'auth.log');
    http_response_code(200);
  } else {
    http_response_code(400);
  }

  echo json_encode($result);
}

/**
 * Delete user account
 */
function handleDeleteAccount()
{
  global $userModel;

  if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    return;
  }

  // Get input data for password confirmation
  $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
  $password = $input['password'] ?? '';

  if (empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password confirmation required']);
    return;
  }

  // Verify password before deletion
  $userId = $_SESSION['user_id'];
  $user = $userModel->getUserById($userId);
  
  // We need to get the password hash separately
  $stmt = getConnection()->prepare("SELECT password FROM users WHERE id = ?");
  $stmt->execute([$userId]);
  $userPassword = $stmt->fetch();

  if (!$userPassword || !password_verify($password, $userPassword['password'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid password']);
    return;
  }

  // Delete account
  $result = $userModel->deleteUser($userId);

  if ($result['success']) {
    logMessage("Account deleted: {$_SESSION['username']} (ID: $userId)", 'user.log');
    
    // Destroy session
    session_destroy();
    
    http_response_code(200);
  } else {
    http_response_code(400);
  }

  echo json_encode($result);
}
