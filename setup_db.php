<?php

require_once __DIR__ . './config.php';

// Prevent accidental execution without the switch
if (php_sapi_name() !== 'cli' && ($_GET['run'] ?? '') !== 'yes') {
    die("<h1>Database Setup / Sync</h1><p>Run this script by appending <code>?run=yes</code> to the URL.</p>");
}

try {
    $pdo = getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Starting Database Sync...\n\n";

    // Disable foreign key checks temporarily
    $pdo->exec("SET NAMES utf8mb4;");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");

    // The desired schema converted to a structured PHP array
    $dbSetup = [
        'drops' => [],
        'tables' => [
            'users' => [
                'columns' => [
                    'id' => 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
                    'username' => 'VARCHAR(50) NOT NULL UNIQUE',
                    'email' => 'VARCHAR(255) NOT NULL UNIQUE',
                    'password' => 'VARCHAR(255) NOT NULL',
                    'role' => "ENUM('user','admin') NOT NULL DEFAULT 'user'",
                    'avatar' => 'VARCHAR(500) DEFAULT NULL',
                    'bio' => 'VARCHAR(500) DEFAULT NULL',
                    'last_active_at' => 'DATETIME DEFAULT NULL',
                    'created_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
                    'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
                ],
                'keys' => [
                    'INDEX `idx_email` (`email`)',
                    'INDEX `idx_username` (`username`)'
                ],
                'options' => 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
            ]
        ],
        'seeds' => []
    ];

    // 0. Drop obsolete tables
    $existingTablesStmt = $pdo->query("SHOW TABLES");
    $dbTables = [];
    while ($row = $existingTablesStmt->fetch(PDO::FETCH_NUM)) {
        $dbTables[] = $row[0];
    }
    foreach ($dbTables as $dbTableName) {
        if (!isset($dbSetup['tables'][$dbTableName])) {
            echo "[DROP] Obsolete table `$dbTableName`. Dropping...\n";
            try {
                $pdo->exec("DROP TABLE `$dbTableName`");
                echo "       [OK] Dropped table `$dbTableName`.\n";
            } catch (PDOException $e) {
                echo "       [ERROR] Failed to drop `$dbTableName`: " . $e->getMessage() . "\n";
            }
        }
    }

    // 1. Parse and Sync Tables
    foreach ($dbSetup['tables'] as $tableName => $tableData) {
        // Check if table exists
        $stmt = $pdo->query("SHOW TABLES LIKE '$tableName'");
        if ($stmt->rowCount() == 0) {
            // Build CREATE TABLE query
            $colDefs = [];
            foreach ($tableData['columns'] as $colName => $colDef) {
                $colDefs[] = "`$colName` $colDef";
            }
            $allDefs = array_merge($colDefs, $tableData['keys']);
            $createQuery = "CREATE TABLE IF NOT EXISTS `$tableName` (\n  " . implode(",\n  ", $allDefs) . "\n) " . $tableData['options'] . ";";

            $pdo->exec($createQuery);
            echo "[CREATE] Created table `$tableName`\n";
            continue;
        }

        // Table exists, perform checking
        echo "[SYNC] Checking `$tableName` for missing or changed columns...\n";
        $colsStmt = $pdo->query("SHOW COLUMNS FROM `$tableName`");
        $existingCols = [];
        while ($row = $colsStmt->fetch(PDO::FETCH_ASSOC)) {
            $existingCols[] = $row['Field'];
        }

        foreach ($tableData['columns'] as $colName => $colDef) {
            if (!in_array($colName, $existingCols)) {
                echo "   -> Missing column `$colName`. Adding...\n";
                $alterQuery = "ALTER TABLE `$tableName` ADD COLUMN `$colName` $colDef";
                try {
                    $pdo->exec($alterQuery);
                    echo "      [OK] Added `$colName`.\n";
                } catch (PDOException $e) {
                    if (strpos($e->getMessage(), '2006') !== false || strpos($e->getMessage(), '2013') !== false) {
                        try {
                            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
                            $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                            $pdo->exec("SET NAMES utf8mb4;");
                            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
                            $pdo->exec($alterQuery);
                            echo "      [OK] Added `$colName` (after reconnect).\n";
                        } catch (PDOException $e2) {
                            echo "      [ERROR] Failed to add `$colName`: " . $e2->getMessage() . "\n";
                        }
                    } else {
                        echo "      [ERROR] Failed to add `$colName`: " . $e->getMessage() . "\n";
                    }
                }
            } else {
                // Automatically modify column to match defined setup if anything changed (Types, Nullability, ENUMs)
                $cleanDef = preg_replace('/\bPRIMARY\s+KEY\b/i', '', $colDef);
                $cleanDef = preg_replace('/\bUNIQUE\b/i', '', $cleanDef);
                $modifyQuery = "ALTER TABLE `$tableName` MODIFY COLUMN `$colName` $cleanDef";

                try {
                    $pdo->exec($modifyQuery);
                } catch (PDOException $e) {
                    if (strpos($e->getMessage(), '2006') !== false || strpos($e->getMessage(), '2013') !== false) {
                        try {
                            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
                            $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                            $pdo->exec("SET NAMES utf8mb4;");
                            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
                            $pdo->exec($modifyQuery);
                        } catch (PDOException $e2) {
                            // Ignore safe modification errors
                        }
                    }
                    // Ignore safe modification errors
                }
            }
        }

        // Drop obsolete columns
        foreach ($existingCols as $existingCol) {
            if (!isset($tableData['columns'][$existingCol])) {
                echo "   -> Obsolete column `$existingCol`. Dropping...\n";
                $dropColQuery = "ALTER TABLE `$tableName` DROP COLUMN `$existingCol`";
                try {
                    $pdo->exec($dropColQuery);
                    echo "      [OK] Dropped `$existingCol`.\n";
                } catch (PDOException $e) {
                    if (strpos($e->getMessage(), '2006') !== false || strpos($e->getMessage(), '2013') !== false) {
                        try {
                            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
                            $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                            $pdo->exec("SET NAMES utf8mb4;");
                            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
                            $pdo->exec($dropColQuery);
                            echo "      [OK] Dropped `$existingCol` (after reconnect).\n";
                        } catch (PDOException $e2) {
                            echo "      [ERROR] Failed to drop `$existingCol`: " . $e2->getMessage() . "\n";
                        }
                    } else {
                        echo "      [ERROR] Failed to drop `$existingCol`: " . $e->getMessage() . "\n";
                    }
                }
            }
        }
    }

    // 3. Extract and run standalone Inserts (Seed data)
    foreach ($dbSetup['seeds'] as $insert) {
        try {
            $pdo->exec($insert);
            echo "\n[INSERT] Executed seed data insertion block.\n";
        } catch (PDOException $e) {
            echo "\n[ERROR] Seed data insertion failed: " . $e->getMessage() . "\n";
        }
    }

    // Re-enable foreign key checks
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

    echo "\nDatabase Sync Complete!";

} catch (PDOException $e) {
    die("\n[FATAL] Database Error: " . $e->getMessage());
}
