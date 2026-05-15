<?php
/**
 * Time Management - API Endpoint
 */
require_once __DIR__ . '/../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    http_response_code(401); echo json_encode(['success' => false]); exit;
}
if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
    http_response_code(403); exit;
}

$userId = $_SESSION['user_id'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $body['action'] ?? '';
$pdo    = getConnection();

try {
    switch ($action) {

        case 'load':
            $tasks = $pdo->prepare("SELECT * FROM time_tasks WHERE user_id = ? AND status != 'deleted' ORDER BY FIELD(priority,'urgent','medium','maybe','free'), created_at ASC");
            $tasks->execute([$userId]);

            $horizons = $pdo->prepare("SELECT * FROM time_horizons WHERE user_id = ? ORDER BY created_at ASC");
            $horizons->execute([$userId]);

            $ideas = $pdo->prepare("SELECT * FROM time_ideas WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
            $ideas->execute([$userId]);

            $user = $pdo->prepare("SELECT timezone, notifications_enabled FROM users WHERE id = ?");
            $user->execute([$userId]);
            $userRow = $user->fetch(PDO::FETCH_ASSOC);

            $taskRows     = $tasks->fetchAll(PDO::FETCH_ASSOC);
            $horizonRows  = $horizons->fetchAll(PDO::FETCH_ASSOC);
            $ideaRows     = $ideas->fetchAll(PDO::FETCH_ASSOC);

            $grouped = ['week' => [], 'month' => [], 'year' => []];
            foreach ($horizonRows as $h) { $grouped[$h['type']][] = $h; }

            echo json_encode([
                'success' => true, 
                'tasks' => $taskRows, 
                'horizons' => $grouped, 
                'ideas' => $ideaRows,
                'settings' => [
                    'timezone' => $userRow['timezone'] ?? 'UTC',
                    'notifications_enabled' => (bool)($userRow['notifications_enabled'] ?? false)
                ]
            ]);
            break;

        case 'update_task':
            $id       = (int)($body['id'] ?? 0);
            $title    = trim($body['title'] ?? '');
            $priority = in_array($body['priority'] ?? '', ['urgent','medium','maybe','free']) ? $body['priority'] : 'medium';
            $duration = max(5, (int)($body['duration_block'] ?? 25));
            $horizonId = !empty($body['horizon_id']) ? (int)$body['horizon_id'] : null;
            if (!$title) { echo json_encode(['success' => false, 'error' => 'Empty title']); break; }

            $stmt = $pdo->prepare("UPDATE time_tasks SET title = ?, priority = ?, duration_block = ?, horizon_id = ? WHERE id = ? AND user_id = ?");
            $stmt->execute([$title, $priority, $duration, $horizonId, $id, $userId]);
            
            $row = $pdo->prepare("SELECT * FROM time_tasks WHERE id = ?");
            $row->execute([$id]);
            echo json_encode(['success' => true, 'task' => $row->fetch(PDO::FETCH_ASSOC)]);
            break;

        case 'add_task':
            $title    = trim($body['title'] ?? '');
            $priority = in_array($body['priority'] ?? '', ['urgent','medium','maybe','free']) ? $body['priority'] : 'medium';
            $duration = max(5, (int)($body['duration_block'] ?? 25));
            $horizonId = !empty($body['horizon_id']) ? (int)$body['horizon_id'] : null;
            if (!$title) { echo json_encode(['success' => false, 'error' => 'Empty title']); break; }

            $stmt = $pdo->prepare("INSERT INTO time_tasks (user_id, horizon_id, title, priority, duration_block) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $horizonId, $title, $priority, $duration]);
            $id = $pdo->lastInsertId();

            $row = $pdo->prepare("SELECT * FROM time_tasks WHERE id = ?");
            $row->execute([$id]);
            echo json_encode(['success' => true, 'task' => $row->fetch(PDO::FETCH_ASSOC)]);
            break;

        case 'complete_task':
            $id = (int)($body['id'] ?? 0);
            $actual = isset($body['actual_duration']) ? (int)$body['actual_duration'] : null;
            $pdo->prepare("UPDATE time_tasks SET status='completed', completed_at=CURRENT_TIMESTAMP, actual_duration=? WHERE id = ? AND user_id = ?")->execute([$actual, $id, $userId]);
            echo json_encode(['success' => true]);
            break;

        case 'restore_task':
            $id = (int)($body['id'] ?? 0);
            $pdo->prepare("UPDATE time_tasks SET status='pending', completed_at=NULL WHERE id = ? AND user_id = ?")->execute([$id, $userId]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_task':
            $id = (int)($body['id'] ?? 0);
            $pdo->prepare("UPDATE time_tasks SET status='deleted' WHERE id = ? AND user_id = ?")->execute([$id, $userId]);
            echo json_encode(['success' => true]);
            break;

        case 'add_horizon':
            $type    = in_array($body['type'] ?? '', ['week','month','year']) ? $body['type'] : 'week';
            $content = trim($body['content'] ?? '');
            if (!$content) { echo json_encode(['success' => false]); break; }

            $stmt = $pdo->prepare("INSERT INTO time_horizons (user_id, type, content) VALUES (?, ?, ?)");
            $stmt->execute([$userId, $type, $content]);
            $id = $pdo->lastInsertId();

            $row = $pdo->prepare("SELECT * FROM time_horizons WHERE id = ?");
            $row->execute([$id]);
            echo json_encode(['success' => true, 'horizon' => $row->fetch(PDO::FETCH_ASSOC)]);
            break;

        case 'complete_horizon':
            $id = (int)($body['id'] ?? 0);
            $pdo->prepare("UPDATE time_horizons SET status='completed' WHERE id = ? AND user_id = ?")->execute([$id, $userId]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_horizon':
            $id = (int)($body['id'] ?? 0);
            $pdo->prepare("DELETE FROM time_horizons WHERE id = ? AND user_id = ?")->execute([$id, $userId]);
            echo json_encode(['success' => true]);
            break;

        case 'move_horizon':
            $id   = (int)($body['id'] ?? 0);
            $type = in_array($body['type'] ?? '', ['week','month','year']) ? $body['type'] : null;
            if (!$id || !$type) { echo json_encode(['success' => false]); break; }

            $pdo->prepare("UPDATE time_horizons SET type = ? WHERE id = ? AND user_id = ?")->execute([$type, $id, $userId]);
            echo json_encode(['success' => true]);
            break;


        case 'add_idea':
            $content   = trim($body['content'] ?? '');
            $taskId    = !empty($body['linked_task_id'])    ? (int)$body['linked_task_id']    : null;
            $horizonId = !empty($body['linked_horizon_id']) ? (int)$body['linked_horizon_id'] : null;
            if (!$content) { echo json_encode(['success' => false]); break; }

            $stmt = $pdo->prepare("INSERT INTO time_ideas (user_id, content, linked_task_id, linked_horizon_id) VALUES (?, ?, ?, ?)");
            $stmt->execute([$userId, $content, $taskId, $horizonId]);
            $id = $pdo->lastInsertId();

            $row = $pdo->prepare("SELECT * FROM time_ideas WHERE id = ?");
            $row->execute([$id]);
            echo json_encode(['success' => true, 'idea' => $row->fetch(PDO::FETCH_ASSOC)]);
            break;

        case 'delete_idea':
            $id = (int)($body['id'] ?? 0);
            $pdo->prepare("DELETE FROM time_ideas WHERE id = ? AND user_id = ?")->execute([$id, $userId]);
            echo json_encode(['success' => true]);
            break;

        case 'update_idea':
            $id = (int)($body['id'] ?? 0);
            $content = trim($body['content'] ?? '');
            $taskId    = !empty($body['linked_task_id'])    ? (int)$body['linked_task_id']    : null;
            $horizonId = !empty($body['linked_horizon_id']) ? (int)$body['linked_horizon_id'] : null;
            if (!$content) { echo json_encode(['success' => false]); break; }
            $pdo->prepare("UPDATE time_ideas SET content = ?, linked_task_id = ?, linked_horizon_id = ? WHERE id = ? AND user_id = ?")
                ->execute([$content, $taskId, $horizonId, $id, $userId]);
            echo json_encode(['success' => true]);
            break;


        case 'update_settings':
            $data = [];
            if (isset($body['timezone'])) {
                if (in_array($body['timezone'], DateTimeZone::listIdentifiers())) {
                    $data['timezone'] = $body['timezone'];
                }
            }
            if (isset($body['notifications_enabled'])) {
                $data['notifications_enabled'] = $body['notifications_enabled'] ? 1 : 0;
            }

            if (empty($data)) {
                echo json_encode(['success' => false, 'error' => 'No data to update']);
                break;
            }

            $userModel = new User();
            $result = $userModel->updateProfile($userId, $data);
            echo json_encode($result);
            break;

        default:
            echo json_encode(['success' => false, 'error' => 'Unknown action']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB error']);
}
