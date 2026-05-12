<?php
/**
 * Landing Page - Public Entry Point
 * 
 * Welcome page with login and registration forms
 */

require_once __DIR__ . '/../../config.php';

// Start session only if not already started
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

// Check if user is logged in
$isLoggedIn = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;

// If logged in, redirect to dashboard
if ($isLoggedIn) {
  header('Location: /dashboard');
  exit;
}

$pageTitle = 'Welcome - zomzam.com';
$pageDescription = 'Modern, secure web application';

// Start building page content
ob_start();
?>

<!-- Empty Landing Page Content -->
<div class="empty-landing-container" style="min-height: calc(100vh - 160px); display: flex; align-items: center; justify-content: center;">
    <!-- Content will be injected here later -->
</div>

<?php
$content = ob_get_clean();

// Use the public layout (no authentication required)
require_once __DIR__ . '/../public_layout.php';
?>
