<?php
require 'config.php';
$pdo = getConnection();
try {
    $pdo->exec("ALTER TABLE time_tasks ADD COLUMN completed_at DATETIME NULL DEFAULT NULL AFTER status");
    echo "Success: added completed_at";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
