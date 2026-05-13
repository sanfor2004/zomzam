<?php
/**
 * Zenith Stream Waiter - SSE Engine (v2)
 * 
 * Optimized for stability, lower reconnection frequency, and instant updates.
 */

// Disable all limits for long-running connection
set_time_limit(0);
ignore_user_abort(false);

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); 

require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$isLoggedIn = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
$userId = $_SESSION['user_id'] ?? null;
$viewingUserId = isset($_GET['viewing_user_id']) ? (int)$_GET['viewing_user_id'] : null;
$isIdle = isset($_GET['idle']) && $_GET['idle'] === '1';

// CRITICAL: Release the session lock so other pages can load!
session_write_close();

$userModel = new User();
$lastViewedStatus = null;
$sleepTime = $isIdle ? 12 : 2; // +10 seconds delay if idle

/**
 * Send an SSE message
 */
function sendSSE($name, $data) {
    echo "event: " . $name . "\n";
    echo "data: " . json_encode($data) . "\n\n";
    while (ob_get_level() > 0) ob_end_flush();
    flush();
}

/**
 * Send a Keep-Alive Ping (prevents browser/server timeouts)
 */
function sendPing() {
    echo ": ping\n\n";
    while (ob_get_level() > 0) ob_end_flush();
    flush();
}

// Initial connection message
sendSSE('order', [
    'order_name' => 'connection_established',
    'params' => ['timestamp' => date('Y-m-d H:i:s')]
]);

$loopCount = 0;
while (true) {
    // 1. Check if user is still connected
    if (connection_aborted()) break;

    // 2. Heartbeat: Update presence
    if ($isLoggedIn && $userId) {
        $userModel->updateOnlineStatus($userId, $isIdle ? 1 : 0);
    }

    $orders = [];

    // 3. Monitor Viewed User Status
    if ($viewingUserId) {
        $currentStatus = $userModel->getOnlineStatus($viewingUserId);
        if (json_encode($currentStatus) !== json_encode($lastViewedStatus)) {
            $orders[] = [
                'order_name' => 'update_viewed_user_status',
                'params' => $currentStatus
            ];
            $lastViewedStatus = $currentStatus;
        }
    }

    // 4. Check Message Queue
    if ($isLoggedIn && $userId) {
        $pdo = getConnection();
        $stmt = $pdo->prepare("SELECT stream_queue FROM user_online_status WHERE user_id = ?");
        $stmt->execute([$userId]);
        $queueRaw = $stmt->fetchColumn();

        if ($queueRaw) {
            $queuedOrders = json_decode($queueRaw, true);
            if (is_array($queuedOrders)) {
                foreach ($queuedOrders as $queuedOrder) {
                    $orders[] = $queuedOrder;
                }
            }
            $stmt = $pdo->prepare("UPDATE user_online_status SET stream_queue = NULL WHERE user_id = ?");
            $stmt->execute([$userId]);
        }
    }

    // 5. Send Gathered Orders
    foreach ($orders as $order) {
        sendSSE('order', $order);
    }

    // 6. Send Ping every 10 seconds to keep connection alive
    if ($loopCount % 5 === 0) {
        sendPing();
    }

    // Dynamic sleep: 2s (Active) or 12s (Idle)
    sleep($sleepTime);
    $loopCount++;

    // Reconnect every 15 minutes (Active) or ~90 mins (Idle)
    if ($loopCount > 450) {
        break;
    }
}
