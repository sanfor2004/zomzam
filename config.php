<?php

/**
 * Config File and Models Handler
 **/
require_once __DIR__ . './models/Base.php';
require_once __DIR__ . './models/User.php';

// Set default timezone
date_default_timezone_set('Africa/Cairo');

define('ENVIRONMENT', 'development'); // development | production

$isDev = ENVIRONMENT === 'development';

// ============================================================================
// ERROR REPORTING
// ============================================================================
if ($isDev) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
} else {
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/logs/php_errors.log');
}

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================
if ($isDev) {
    // Development Database
    define('DB_HOST', '127.0.0.1');
    define('DB_NAME', 'zomzam_test');
    define('DB_USER', 'root');
    define('DB_PASS', '');
    define('DB_CHARSET', 'utf8mb4');
} else {
    // Production Database
    define('DB_HOST', '92.113.22.154');
    define('DB_NAME', 'u415550448_LeagueData');
    define('DB_USER', 'u415550448_user');
    define('DB_PASS', 'v>H2uh=!QL8');
    define('DB_CHARSET', 'utf8mb4');
}

// ============================================================================
// APPLICATION SETTINGS
// ============================================================================
define('SITE_NAME', 'zomzam.com');
define('SITE_URL', $isDev ? 'http://localhost.zomzam/' : 'https://zomzam.com/');
define('BASE_PATH', __DIR__);

// ============================================================================
// FILE PATHS
// ============================================================================
define('VIEWS_PATH', __DIR__ . '/Views');
define('MODELS_PATH', __DIR__ . '/Models');
define('ASSETS_PATH', __DIR__ . '/Assets');
define('API_PATH', __DIR__ . '/ApiHandler');
define('LOGS_PATH', __DIR__ . '/Logs');

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================
define('CSRF_ENABLED', true);
define('CSRF_TOKEN_LENGTH', 32);
define('SESSION_COOKIE_NAME', 'ZOMZAM_SESSION');
define('SESSION_COOKIE_LIFETIME', 0); // 0 = session cookie
define('SESSION_COOKIE_PATH', '/');
define('SESSION_COOKIE_DOMAIN', $isDev ? 'localhost.zomzam' : 'zomzam.com');
define('SESSION_COOKIE_SECURE', !$isDev);
define('SESSION_COOKIE_HTTPONLY', true);
define('SESSION_COOKIE_SAMESITE', 'Lax');

// ============================================================================
// FEATURES CONFIGURATION
// ============================================================================
define('FEATURE_SUMMONER_TRACKING', true);
define('FEATURE_MATCH_HISTORY', true);
define('FEATURE_LEAGUE_ANALYSIS', true);
define('FEATURE_CHAMPION_BUILDS', true);
define('FEATURE_REALTIME_GAME', true);
define('FEATURE_SUMMONER_ALERTS', true);

// ============================================================================
// NOTIFICATIONS CONFIGURATION
// ============================================================================
define('NOTIFICATION_EMAIL_ENABLED', true);
define('NOTIFICATION_EMAIL_HOST', 'smtp.example.com');
define('NOTIFICATION_EMAIL_PORT', 587);
define('NOTIFICATION_EMAIL_USERNAME', 'your-email@example.com');
define('NOTIFICATION_EMAIL_PASSWORD', 'your-password');
define('NOTIFICATION_EMAIL_ENCRYPTION', 'tls');
define('NOTIFICATION_EMAIL_FROM', 'your-email@example.com');
define('NOTIFICATION_EMAIL_FROM_NAME', 'zomzam.com');

// ============================================================================
// DEBUG CONFIGURATION
// ============================================================================
define('DEBUG_LOG_ENABLED', $isDev);
define('DEBUG_LOG_FILE', __DIR__ . '/logs/debug.log');
define('DEBUG_LOG_LEVEL', 'info'); // info | debug | error | all

// ============================================================================
// MISCELLANEOUS CONFIGURATION
// ============================================================================
define('MAX_MATCHES_PER_SUMMONER', 20);
define('MAX_SUMMONERS_PER_USER', 10);
define('MAX_CHAMPIONS_PER_BUILD', 6);
define('MAX_ITEMS_PER_BUILD', 6);
define('MAX_RUNES_PER_BUILD', 10);
define('MAX_SUMMONER_NAME_LENGTH', 16);


// ============================================================================
// DATABASE CONNECTION
// ============================================================================
function getConnection()
{
    static $pdo = null;

    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => false, // Disable persistent for better connection management
                PDO::ATTR_TIMEOUT => 30, // Connection timeout
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET SESSION wait_timeout=600, interactive_timeout=600", // 10 minutes
            ];
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            if (DEBUG_LOG_ENABLED) {
                die('Database connection failed: ' . $e->getMessage());
            } else {
                die('Database connection failed. Please try again later.');
            }
        }
    }

    return $pdo;
}


function getConnectionI()
{
    $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($mysqli->connect_error) {
        die('Database connection failed: ' . $mysqli->connect_error);
    }
    
    // Set connection timeout settings
    $mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 30);
    $mysqli->query("SET SESSION wait_timeout=600");
    $mysqli->query("SET SESSION interactive_timeout=600");
    
    return $mysqli;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Debug output (only in development)
 */
function debug($data, $label = '')
{
    if (!DEBUG_LOG_ENABLED)
        return;

    echo '<pre style="background: #f4f4f4; border: 1px solid #ddd; padding: 10px; margin: 10px 0;">';
    if ($label)
        echo "<strong>$label:</strong>\n";
    print_r($data);
    echo '</pre>';
}

/**
 * Log message to file
 */
function logMessage($message, $file = 'app.log')
{
    $logDir = BASE_PATH . '/Logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }

    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] $message\n";
    file_put_contents("$logDir/$file", $logEntry, FILE_APPEND);
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Check if current user is authenticated
 * @return bool True if user is logged in, false otherwise
 */
function isAuthenticated()
{
    // Start session if not started
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    // Check if session user exists
    if (isset($_SESSION['user']) && !empty($_SESSION['user'])) {
        return true;
    }

    // Check if session cookie exists
    if (!isset($_COOKIE[SESSION_COOKIE_NAME])) {
        return false;
    }

    try {
        $auth = new Auth();
        $session = $auth->validateSession($_COOKIE[SESSION_COOKIE_NAME]);

        if ($session) {
            $_SESSION['user'] = $session;
            return true;
        }
    } catch (Exception $e) {
        if (DEBUG_LOG_ENABLED) {
            logMessage("Auth check failed: " . $e->getMessage(), 'auth.log');
        }
    }

    return false;
}

/**
 * Get current authenticated user data
 * @return array|null User data array or null if not authenticated
 */
function getCurrentUser()
{
    if (!isAuthenticated()) {
        return null;
    }

    return $_SESSION['user'] ?? null;
}

/**
 * Require authentication - redirect to signin if not authenticated
 * @param string|null $redirectUrl URL to redirect to after signin (defaults to current page)
 * @return array User data if authenticated
 */
function requireAuth($redirectUrl = null)
{
    if (!isAuthenticated()) {
        // Determine redirect URL
        if ($redirectUrl === null) {
            $redirectUrl = $_SERVER['REQUEST_URI'] ?? '/';
        }

        // Build signin URL with redirect parameter
        $signinUrl = '/auth/signin';
        if ($redirectUrl !== '/auth/signin') {
            $signinUrl .= '?redirect=' . urlencode($redirectUrl);
        }

        // Redirect to signin page
        header("Location: $signinUrl");
        exit;
    }

    return getCurrentUser();
}

/**
 * Require admin role - return 403 if not admin
 * @return array User data if authenticated and admin
 */
function requireAdmin()
{
    $user = getCurrentUser();

    if (!$user) {
        // Not logged in - redirect to signin
        $redirectUrl = $_SERVER['REQUEST_URI'] ?? '/admin';
        header("Location: /auth/signin?redirect=" . urlencode($redirectUrl));
        exit;
    }

    // Check if user has admin role
    if (!isset($user['role']) || $user['role'] !== 'admin') {
        // Logged in but not admin - redirect to 403 error page
        header("Location: /403");
        exit;
    }

    return $user;
}

/**
 * Check if current user has specific role
 * @param string $role Role to check (user, member, supporter, moderator, admin)
 * @return bool True if user has the role, false otherwise
 */
function hasRole($role)
{
    $user = getCurrentUser();
    
    if (!$user || !isset($user['role'])) {
        return false;
    }

    return $user['role'] === $role;
}

/**
 * Check if current user has minimum role level
 * @param string $minRole Minimum required role
 * @return bool True if user meets minimum role requirement
 */
function hasMinRole($minRole)
{
    $user = getCurrentUser();
    
    if (!$user || !isset($user['role'])) {
        return false;
    }

    // Role hierarchy (higher number = more permissions)
    $roleHierarchy = [
        'user' => 1,
        'member' => 2,
        'supporter' => 3,
        'moderator' => 4,
        'admin' => 5
    ];

    $userRoleLevel = $roleHierarchy[$user['role']] ?? 0;
    $minRoleLevel = $roleHierarchy[$minRole] ?? 999;

    return $userRoleLevel >= $minRoleLevel;
}

/**
 * API Authentication Check - for use in API endpoints
 * Returns JSON error response if not authenticated
 * @return array User data if authenticated
 */
function checkApiAuth()
{
    // Get authorization from header or cookie
    $headers = getallheaders();
    $token = null;

    // Check Authorization header first (Bearer token)
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
    }
    // Fall back to session cookie
    elseif (isset($_COOKIE[SESSION_COOKIE_NAME])) {
        $token = $_COOKIE[SESSION_COOKIE_NAME];
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode([
            'error' => 'Unauthorized',
            'message' => 'Authentication required'
        ]);
        exit;
    }

    try {
        $auth = new Auth();
        $session = $auth->validateSession($token);

        if (!$session) {
            http_response_code(401);
            echo json_encode([
                'error' => 'Unauthorized',
                'message' => 'Invalid or expired session'
            ]);
            exit;
        }

        return $session;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Internal Server Error',
            'message' => 'Authentication check failed'
        ]);
        exit;
    }
}

/**
 * API Admin Check - for use in admin API endpoints
 * Returns JSON error response if not admin
 * @return array User data if authenticated and admin
 */
function checkApiAdmin()
{
    $user = checkApiAuth();

    if (!isset($user['role']) || $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode([
            'error' => 'Forbidden',
            'message' => 'Admin access required'
        ]);
        exit;
    }

    return $user;
}