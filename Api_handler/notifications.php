<?php
/**
 * Notifications API Endpoint
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$myId = (int)$_SESSION['user_id'];
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$userModel = new User();

switch ($action) {
    case 'list':
        $notifications = $userModel->getNotifications($myId);
        echo json_encode(['success' => true, 'notifications' => $notifications]);
        break;

    case 'read_all':
        $success = $userModel->markAllNotificationsRead($myId);
        echo json_encode(['success' => $success]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
