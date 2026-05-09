<?php

/**
 * Authentication API Endpoint
 * 
 * Handles user authentication operations:
 * - POST /api_handler/auth.php?action=register - Register new user
 * - POST /api_handler/auth.php?action=login - Login user
 * - POST /api_handler/auth.php?action=logout - Logout user
 * - GET /api_handler/auth.php?action=check - Check authentication status
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';

// Start session for authentication
session_start();

// Only allow POST and GET requests
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['POST', 'GET'])) {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method not allowed']);
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
  case 'register':
    handleRegister();
    break;

  case 'login':
    handleLogin();
    break;

  case 'logout':
    handleLogout();
    break;

  case 'check':
    handleCheck();
    break;

  default:
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    break;
}

/**
 * Handle user registration
 */
function handleRegister()
{
  global $userModel;

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    return;
  }

  // Get input data
  $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
  
  $username = trim($input['username'] ?? '');
  $email = trim($input['email'] ?? '');
  $password = $input['password'] ?? '';

  // Register user
  $result = $userModel->register($username, $email, $password);

  if ($result['success']) {
    http_response_code(201);
    
    // Automatically log in the user
    $_SESSION['user_id'] = $result['user']['id'];
    $_SESSION['username'] = $result['user']['username'];
    $_SESSION['email'] = $result['user']['email'];
    $_SESSION['role'] = 'user';
    $_SESSION['logged_in'] = true;

    logMessage("New user registered: $username (ID: {$result['user']['id']})", 'auth.log');
  } else {
    http_response_code(400);
  }

  echo json_encode($result);
}

/**
 * Handle user login
 */
function handleLogin()
{
  global $userModel;

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    return;
  }

  // Get input data
  $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
  
  $identifier = trim($input['identifier'] ?? $input['username'] ?? $input['email'] ?? '');
  $password = $input['password'] ?? '';

  // Authenticate user
  $result = $userModel->login($identifier, $password);

  if ($result['success']) {
    // Set session data
    $_SESSION['user_id'] = $result['user']['id'];
    $_SESSION['username'] = $result['user']['username'];
    $_SESSION['email'] = $result['user']['email'];
    $_SESSION['role'] = $result['user']['role'];
    $_SESSION['logged_in'] = true;

    // Regenerate session ID for security
    session_regenerate_id(true);

    logMessage("User logged in: {$result['user']['username']} (ID: {$result['user']['id']})", 'auth.log');
    http_response_code(200);
  } else {
    http_response_code(401);
  }

  echo json_encode($result);
}

/**
 * Handle user logout
 */
function handleLogout()
{
  if (isset($_SESSION['user_id'])) {
    $userId = $_SESSION['user_id'];
    $username = $_SESSION['username'] ?? 'Unknown';
    
    logMessage("User logged out: $username (ID: $userId)", 'auth.log');
  }

  // Destroy all session data
  $_SESSION = [];
  
  // Destroy the session cookie
  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
      session_name(),
      '',
      time() - 42000,
      $params['path'],
      $params['domain'],
      $params['secure'],
      $params['httponly']
    );
  }

  // Destroy the session
  session_destroy();

  http_response_code(200);
  echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
}

/**
 * Check authentication status
 */
function handleCheck()
{
  global $userModel;

  if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true && isset($_SESSION['user_id'])) {
    // Get fresh user data
    $user = $userModel->getUserById($_SESSION['user_id']);

    if ($user) {
      http_response_code(200);
      echo json_encode([
        'success' => true,
        'authenticated' => true,
        'user' => $user
      ]);
    } else {
      // User no longer exists
      session_destroy();
      http_response_code(200);
      echo json_encode([
        'success' => true,
        'authenticated' => false,
        'message' => 'Session expired'
      ]);
    }
  } else {
    http_response_code(200);
    echo json_encode([
      'success' => true,
      'authenticated' => false
    ]);
  }
}
