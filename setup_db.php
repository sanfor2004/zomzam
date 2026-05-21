<?php
/**
 * Zomzam Database Setup & Sync Engine
 * Dragon-Tier Automated Schema Synchronizer
 */

require_once __DIR__ . '/config.php';
date_default_timezone_set('UTC'); // Ensure UTC for script execution

$schema = [
    'users' => [
        'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'username' => 'VARCHAR(50) NOT NULL UNIQUE',
        'email' => 'VARCHAR(255) NOT NULL UNIQUE',
        'first_name' => 'VARCHAR(100) NULL',
        'last_name' => 'VARCHAR(100) NULL',
        'password' => 'VARCHAR(255) NOT NULL',
        'role' => "ENUM('user', 'admin', 'moderator') NOT NULL DEFAULT 'user'",
        'avatar' => 'VARCHAR(500) NULL',
        'bio' => 'TEXT NULL',
        'tags' => 'JSON NULL',
        'timezone' => "VARCHAR(50) NOT NULL DEFAULT 'UTC'",
        'notifications_enabled' => "TINYINT(1) NOT NULL DEFAULT 0",
        'is_active' => 'TINYINT(1) NOT NULL DEFAULT 1',
        'is_verified' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'verification_token' => 'VARCHAR(255) NULL',
        'reset_token' => 'VARCHAR(255) NULL',
        'reset_token_expires' => 'DATETIME NULL',
        'primary_currency' => "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
        'secondary_currency' => "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'USD'",
        'last_login_at' => 'DATETIME NULL',
        'last_login_ip' => 'VARCHAR(45) NULL',
        'last_active_at' => 'DATETIME NULL',
        'login_attempts' => 'INT UNSIGNED NOT NULL DEFAULT 0',
        'locked_until' => 'DATETIME NULL',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
    ],
    'time_horizons' => [
        'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'user_id' => 'INT UNSIGNED NOT NULL',
        'type' => "ENUM('week', 'month', 'year') NOT NULL",
        'content' => 'TEXT NOT NULL',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
    ],
    'time_tasks' => [
        'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'user_id' => 'INT UNSIGNED NOT NULL',
        'horizon_id' => 'INT UNSIGNED NULL',
        'title' => 'VARCHAR(255) NOT NULL',
        'priority' => "ENUM('urgent', 'medium', 'maybe', 'free') NOT NULL DEFAULT 'medium'",
        'duration_block' => 'INT UNSIGNED NOT NULL',
        'actual_duration' => 'INT UNSIGNED NULL',
        'status' => "ENUM('pending', 'in_progress', 'completed', 'deleted') NOT NULL DEFAULT 'pending'",
        'completed_at' => 'DATETIME NULL',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
    ],
    'time_ideas' => [
        'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'user_id' => 'INT UNSIGNED NOT NULL',
        'linked_task_id' => 'INT UNSIGNED NULL',
        'linked_horizon_id' => 'INT UNSIGNED NULL',
        'content' => 'TEXT NOT NULL',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
    ],
    'money_accounts' => [
        'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'user_id' => 'INT UNSIGNED NOT NULL',
        'name' => 'VARCHAR(100) NOT NULL',
        'type' => "ENUM('bank', 'cash', 'paypal', 'wallet', 'other') NOT NULL DEFAULT 'bank'",
        'currency' => "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
        'balance' => 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00',
        'last_four' => 'VARCHAR(4) NULL',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
    ],
    'money_categories' => [
        'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'user_id' => 'INT UNSIGNED NOT NULL',
        'name' => 'VARCHAR(100) NOT NULL',
        'type' => "ENUM('need', 'want', 'saving', 'debt', 'income') NOT NULL DEFAULT 'need'",
        'budget_percent' => 'DECIMAL(5, 2) NULL',
        'icon' => 'VARCHAR(50) NULL',
        'color' => 'VARCHAR(20) NULL',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
    ],
    'money_transactions' => [
        'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'user_id' => 'INT UNSIGNED NOT NULL',
        'account_id' => 'INT UNSIGNED NOT NULL',
        'category_id' => 'INT UNSIGNED NULL',
        'type' => "ENUM('income', 'expense', 'transfer', 'lend') NOT NULL",
        'amount' => 'DECIMAL(15, 2) NOT NULL',
        'currency' => "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
        'description' => 'VARCHAR(255) NULL',
        'transaction_date' => 'DATE NOT NULL',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
    ],
    'money_lend' => [
        'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'user_id' => 'INT UNSIGNED NOT NULL',
        'person_name' => 'VARCHAR(100) NOT NULL',
        'type' => "ENUM('owe_me', 'i_owe') NOT NULL",
        'amount' => 'DECIMAL(15, 2) NOT NULL',
        'currency' => "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
        'status' => "ENUM('pending', 'partial', 'settled') NOT NULL DEFAULT 'pending'",
        'due_date' => 'DATE NULL',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
    ],
    'user_online_status' => [
        'user_id' => 'INT UNSIGNED PRIMARY KEY',
        'last_seen' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'stream_queue' => 'JSON NULL',
        'is_idle' => 'TINYINT(1) NOT NULL DEFAULT 0'
    ],
    // ── Social Graph ──────────────────────────────────────────────────────────
    // Single polymorphic table for both bidirectional friends and one-way follows.
    // type='friend' requires acceptance; type='follow' is always status='accepted'.
    'user_connections' => [
        'id'           => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'requester_id' => 'INT UNSIGNED NOT NULL',
        'addressee_id' => 'INT UNSIGNED NOT NULL',
        'type'         => "ENUM('friend','follow') NOT NULL DEFAULT 'friend'",
        // friend states: pending → accepted | declined | blocked
        // follow states: accepted (instant) | blocked
        'status'       => "ENUM('pending','accepted','declined','blocked') NOT NULL DEFAULT 'pending'",
        'created_at'   => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'updated_at'   => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
    ],
    // ── Notifications ────────────────────────────────────────────────────────
    'notifications' => [
        'id'         => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
        'user_id'    => 'INT UNSIGNED NOT NULL',
        'type'       => 'VARCHAR(50) NOT NULL', // e.g., 'friend_request', 'friend_accept'
        'data'       => 'JSON NOT NULL',      // Additional info like sender_id, sender_username, etc.
        'is_read'    => 'TINYINT(1) NOT NULL DEFAULT 0',
        'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
    ]
];

function syncDatabase($pdo, $schema) {
    echo "Starting database synchronization...\n";
    
    foreach ($schema as $tableName => $columns) {
        // Check if table exists
        $stmt = $pdo->query("SHOW TABLES LIKE '$tableName'");
        if ($stmt->rowCount() === 0) {
            echo "Creating table: $tableName\n";
            $colDefs = [];
            foreach ($columns as $name => $def) {
                $colDefs[] = "`$name` $def";
            }
            $pdo->exec("CREATE TABLE `$tableName` (" . implode(', ', $colDefs) . ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        } else {
            // Check for missing or changed columns
            $existingCols = $pdo->query("DESCRIBE `$tableName`")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($columns as $name => $def) {
                if (!in_array($name, $existingCols)) {
                    echo "Adding column `$name` to table `$tableName`\n";
                    $pdo->exec("ALTER TABLE `$tableName` ADD COLUMN `$name` $def");
                }
            }
        }
    }
    
    echo "Synchronization complete.\n";
}

function seedData($pdo) {
    echo "Seeding initial data...\n";
    
    // Seed default money categories
    $categories = [
        ['Needs', 'need', 60.00, 'shield'],
        ['Wants', 'want', 20.00, 'heart'],
        ['Savings', 'saving', 20.00, 'piggy-bank'],
        ['Insurance', 'need', null, 'umbrella'],
        ['Food & Groceries', 'need', null, 'shopping-cart'],
        ['Internet', 'need', null, 'wifi'],
        ['Electricity & Gas', 'need', null, 'zap'],
        ['Cat food', 'need', null, 'cat'],
        ['Salary', 'income', null, 'dollar-sign'],
        ['Extra Bonus', 'income', null, 'plus-circle']
    ];

    $stmt = $pdo->prepare("INSERT IGNORE INTO money_categories (user_id, name, type, budget_percent, icon) VALUES (1, ?, ?, ?, ?)");
    foreach ($categories as $cat) {
        $stmt->execute($cat);
    }

    // Seed default money accounts
    $accounts = [
        ['Banque Misr VISA USD Debit', 'bank', 'USD', 0.00, '4193'],
        ['Egypt Post VISA EGP Debit', 'bank', 'EGP', 0.00, '1154'],
        ['PayPal', 'paypal', 'USD', 0.00, NULL]
    ];

    $stmt = $pdo->prepare("INSERT IGNORE INTO money_accounts (user_id, name, type, currency, balance, last_four) VALUES (1, ?, ?, ?, ?, ?)");
    foreach ($accounts as $acc) {
        $stmt->execute($acc);
    }

    echo "Seeding complete.\n";
}

try {
    $pdo = getConnection();
    syncDatabase($pdo, $schema);
    seedData($pdo);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
