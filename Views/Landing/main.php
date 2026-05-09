<?php
/**
 * Main Dashboard Page
 * 
 * This is the main authenticated landing page for logged-in users.
 */

require_once __DIR__ . '/../../config.php';

$pageTitle = 'Dashboard - zomzam.com';
$pageDescription = 'Your main dashboard';

// Start building page content
ob_start();
?>

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
  <!-- Welcome Card -->
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">Welcome Back!</h2>
    </div>
    <p style="color: var(--text-muted); margin-bottom: 1rem;">
      You're logged in as <strong><?php echo htmlspecialchars($_SESSION['username'] ?? 'User'); ?></strong>
    </p>
    <p style="color: var(--text-muted); font-size: 0.875rem;">
      Member since: <?php echo date('F j, Y'); ?>
    </p>
  </div>

  <!-- Quick Stats Card -->
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">Quick Stats</h2>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-muted);">Account Status</span>
        <span style="color: var(--success-color); font-weight: 600;">Active</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-muted);">Role</span>
        <span style="font-weight: 600; text-transform: capitalize;">
          <?php echo htmlspecialchars($_SESSION['role'] ?? 'user'); ?>
        </span>
      </div>
    </div>
  </div>

  <!-- Quick Actions Card -->
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">Quick Actions</h2>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <button class="btn btn-primary" style="width: 100%;" onclick="alert('Profile page coming soon!')">
        Edit Profile
      </button>
      <button class="btn btn-outline" style="width: 100%;" onclick="alert('Settings page coming soon!')">
        Settings
      </button>
    </div>
  </div>
</div>

<!-- Main Content Card -->
<div class="card">
  <div class="card-header">
    <h2 class="card-title">Getting Started</h2>
  </div>
  <div style="color: var(--text-muted); line-height: 1.8;">
    <h3 style="color: var(--text-color); font-size: 1.125rem; margin-bottom: 0.75rem;">Welcome to zomzam.com!</h3>
    <p style="margin-bottom: 1rem;">
      This is your main dashboard. Here's what you can do:
    </p>
    <ul style="list-style: none; padding-left: 0;">
      <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
        ✅ <strong>View your profile</strong> - See and edit your account information
      </li>
      <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
        ✅ <strong>Manage settings</strong> - Customize your experience
      </li>
      <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
        ✅ <strong>Update your password</strong> - Keep your account secure
      </li>
      <li style="padding: 0.5rem 0;">
        ✅ <strong>Access API endpoints</strong> - Build integrations with our RESTful API
      </li>
    </ul>
  </div>
</div>

<div class="card" style="margin-top: 1.5rem;">
  <div class="card-header">
    <h2 class="card-title">API Documentation</h2>
  </div>
  <p style="color: var(--text-muted); margin-bottom: 1rem;">
    Access our RESTful API to integrate with your applications. View the full API documentation:
  </p>
  <a href="/Api_handler/" class="btn btn-primary" target="_blank">View API Docs</a>
</div>

<?php
$content = ob_get_clean();

// Use the authenticated app layout
require_once __DIR__ . '/../app_layout.php';
?>
