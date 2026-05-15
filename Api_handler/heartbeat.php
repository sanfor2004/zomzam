<?php
/**
 * Zenith-Tier Heartbeat API Engine
 * 
 * Handles real-time heartbeats and live data retrieval for users and guests.
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';

// Start session if not started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$response = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'data' => [
        'user_status' => null,
        'notifications' => [
            'count' => 0,
            'items' => []
        ]
    ]
];

try {
    $userModel = new User();
    
    // 1. Handle Heartbeat (if logged in)
    $isLoggedIn = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
    $currentUserId = $_SESSION['user_id'] ?? null;
    
    // Parse input
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $isIdle = isset($input['idle']) ? (int)$input['idle'] : null;

    if ($isLoggedIn && $currentUserId) {
        $userModel->updateOnlineStatus($currentUserId, $isIdle ?? 0);
    }

    // 2. Fetch target user status (if viewing_user_id provided)
    $viewingUserId = $input['viewing_user_id'] ?? $_GET['viewing_user_id'] ?? null;
    
    if ($viewingUserId) {
        $response['data']['user_status'] = $userModel->getOnlineStatus((int)$viewingUserId);
    }

    // 3. Fetch notifications placeholder
    if ($isLoggedIn) {
        // Future: Fetch real notifications from database
        $response['data']['notifications']['count'] = 0;
    }

    echo json_encode($response);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal Server Error',
        'error' => (defined('ENVIRONMENT') && ENVIRONMENT === 'development') ? $e->getMessage() : null
    ]);
}
