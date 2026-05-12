<?php
require_once __DIR__ . '/../../config.php';

if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$userId = $_SESSION['user_id'];
session_write_close(); // Release session lock

$pdo = getConnection();

$action = $_GET['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input');
    $body = json_decode($rawBody, true) ?? [];
    $action = $body['action'] ?? $action;
}

header('Content-Type: application/json');

try {
    switch ($action) {
        case 'get_initial_data':
            // Fetch user currency settings
            $stmt = $pdo->prepare("SELECT primary_currency, secondary_currency FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $userSettings = $stmt->fetch(PDO::FETCH_ASSOC);

            // Fetch accounts
            $stmt = $pdo->prepare("SELECT * FROM money_accounts WHERE user_id = ?");
            $stmt->execute([$userId]);
            $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch categories
            $stmt = $pdo->prepare("SELECT * FROM money_categories WHERE user_id = ?");
            $stmt->execute([$userId]);
            $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch budget stats for current month
            $currentMonth = date('Y-m-01');
            $nextMonth = date('Y-m-01', strtotime('+1 month'));

            // Total Income this month
            $stmt = $pdo->prepare("SELECT SUM(amount) FROM money_transactions WHERE user_id = ? AND type = 'income' AND transaction_date >= ? AND transaction_date < ?");
            $stmt->execute([$userId, $currentMonth, $nextMonth]);
            $totalIncome = (float)$stmt->fetchColumn();

            // Expenses by category type
            $stmt = $pdo->prepare("
                SELECT c.type, SUM(t.amount) as total 
                FROM money_transactions t
                JOIN money_categories c ON t.category_id = c.id
                WHERE t.user_id = ? AND t.type = 'expense' AND t.transaction_date >= ? AND t.transaction_date < ?
                GROUP BY c.type
            ");
            $stmt->execute([$userId, $currentMonth, $nextMonth]);
            $expenseStats = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // Fetch recent transactions
            $stmt = $pdo->prepare("
                SELECT t.*, c.name as category_name, c.icon as category_icon, a.name as account_name 
                FROM money_transactions t
                LEFT JOIN money_categories c ON t.category_id = c.id
                LEFT JOIN money_accounts a ON t.account_id = a.id
                WHERE t.user_id = ? 
                ORDER BY t.transaction_date DESC, t.created_at DESC 
                LIMIT 20
            ");
            $stmt->execute([$userId]);
            $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'user_settings' => $userSettings,
                'accounts' => $accounts,
                'categories' => $categories,
                'transactions' => $transactions,
                'stats' => [
                    'income' => $totalIncome,
                    'expenses' => $expenseStats
                ]
            ]);
            break;

        case 'update_settings':
            $primary = $body['primary_currency'] ?? 'EGP';
            $secondary = $body['secondary_currency'] ?? 'USD';
            
            $stmt = $pdo->prepare("UPDATE users SET primary_currency = ?, secondary_currency = ? WHERE id = ?");
            $stmt->execute([$primary, $secondary, $userId]);
            
            echo json_encode(['success' => true]);
            break;

        case 'add_transaction':
            $type = $body['type']; // income, expense, transfer
            $accountId = (int)$body['account_id'];
            $categoryId = isset($body['category_id']) ? (int)$body['category_id'] : null;
            $amount = (float)$body['amount'];
            $currency = $body['currency'] ?? 'EGP';
            $description = $body['description'] ?? '';
            $date = $body['date'] ?? date('Y-m-d');

            $pdo->beginTransaction();

            // Insert transaction
            $stmt = $pdo->prepare("
                INSERT INTO money_transactions (user_id, account_id, category_id, type, amount, currency, description, transaction_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$userId, $accountId, $categoryId, $type, $amount, $currency, $description, $date]);
            $transactionId = $pdo->lastInsertId();

            // Update account balance
            $balanceChange = ($type === 'income') ? $amount : -$amount;
            $stmt = $pdo->prepare("UPDATE money_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?");
            $stmt->execute([$balanceChange, $accountId, $userId]);

            $pdo->commit();

            echo json_encode(['success' => true, 'id' => $transactionId]);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
