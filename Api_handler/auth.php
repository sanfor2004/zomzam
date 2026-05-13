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
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

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
  
  $username = str_replace(' ', '_', trim($input['username'] ?? ''));
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
    $_SESSION['user_avatar'] = '';
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
  $remember = filter_var($input['remember'] ?? false, FILTER_VALIDATE_BOOLEAN);

  // Authenticate user
  $result = $userModel->login($identifier, $password);

  if ($result['success']) {
    // Set session data
    $_SESSION['user_id'] = $result['user']['id'];
    $_SESSION['username'] = $result['user']['username'];
    $_SESSION['email'] = $result['user']['email'];
    $_SESSION['role'] = $result['user']['role'];
    $_SESSION['user_avatar'] = $result['user']['avatar'] ?? '';
    $_SESSION['logged_in'] = true;

    // Handle "Remember Me" functionality
    if ($remember) {
      // Extend session cookie lifetime to 30 days
      $cookieLifetime = 30 * 24 * 60 * 60; // 30 days in seconds
      
      // Update session cookie parameters
      $params = session_get_cookie_params();
      setcookie(
        session_name(),
        session_id(),
        time() + $cookieLifetime,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
      );
      
      // Store remember flag in session
      $_SESSION['remember_me'] = true;
      $_SESSION['remember_expire'] = time() + $cookieLifetime;
      
      logMessage("User {$result['user']['username']} logged in with Remember Me (30 days)", 'auth.log');
    } else {
      // Standard session (expires when browser closes)
      $_SESSION['remember_me'] = false;
      logMessage("User logged in: {$result['user']['username']} (ID: {$result['user']['id']})", 'auth.log');
    }

    // Regenerate session ID for security
    session_regenerate_id(true);

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
  
  // Destroy the session cookie (including remember me cookies)
  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
      session_name(),
      '',
      time() - 86400, // Set to past time to delete
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
