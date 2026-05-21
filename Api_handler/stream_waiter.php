<?php
/**
 * Zenith Stream Waiter - SSE Engine (v2)
 * 
 * Optimized for stability, lower reconnection frequency, and instant updates.
 */

// Disable all limits for long-running connection
set_time_limit(0);
ignore_user_abort(false);

// Turn off output buffering completely to prevent server buffering
while (ob_get_level() > 0) {
    ob_end_clean();
}

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); 
header('Content-Encoding: none'); 

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
$lastPingTime = time();

/**
 * Send an SSE message
 */
function sendSSE($name, $data) {
    echo "event: " . $name . "\n";
    echo "data: " . json_encode($data) . "\n\n";
    if (ob_get_level() > 0) {
        ob_flush();
    }
    flush();
}

/**
 * Send a Keep-Alive Ping (prevents browser/server timeouts)
 */
function sendPing() {
    echo ": ping\n\n";
    if (ob_get_level() > 0) {
        ob_flush();
    }
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

    // 2. Heartbeat: Fetch current state from DB
    $currentIdle = 0;
    if ($isLoggedIn && $userId) {
        $pdo = getConnection();
        $stmt = $pdo->prepare("SELECT is_idle FROM user_online_status WHERE user_id = ?");
        $stmt->execute([$userId]);
        $currentIdle = (int)$stmt->fetchColumn();
        
        // Refresh presence timestamp
        $userModel->updateOnlineStatus($userId, $currentIdle);
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

    // 6. Send Ping every 20 seconds to keep connection alive (Independent of sleep)
    if (time() - $lastPingTime >= 20) {
        sendPing();
        $lastPingTime = time();
    }

    // Dynamic sleep: 2s (Active) or 5s (Idle)
    // We reduced idle sleep from 12s to 5s for better responsiveness
    $sleepTime = ($currentIdle === 1) ? 5 : 2;
    sleep($sleepTime);
    $loopCount++;

    // Reconnect safety break (approx 30 mins)
    if ($loopCount > 900) {
        break;
    }
}
