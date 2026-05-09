<?php
// Ensure user is authenticated
session_start();
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
  header('Location: /');
  exit;
}

$currentUser = [
  'id' => $_SESSION['user_id'] ?? 0,
  'username' => $_SESSION['username'] ?? 'User',
  'email' => $_SESSION['email'] ?? '',
  'role' => $_SESSION['role'] ?? 'user'
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="description" content="<?php echo $pageDescription ?? 'zomzam.com Dashboard - Manage your account'; ?>">
  <title><?php echo $pageTitle ?? 'Dashboard - zomzam.com'; ?></title>
  
  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/Assets/Img/favicon.ico">
  
  <!-- Preconnect for performance -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  
  <!-- Modern Typography -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <!-- Main Stylesheet -->
  <link rel="stylesheet" href="/Assets/Css/style.css">
  
  <!-- Additional Page Styles -->
  <?php if (isset($additionalCSS)): ?>
    <?php foreach ($additionalCSS as $css): ?>
      <link rel="stylesheet" href="<?php echo $css; ?>">
    <?php endforeach; ?>
  <?php endif; ?>
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary-color: #2563eb;
      --primary-dark: #1e40af;
      --primary-light: #3b82f6;
      --secondary-color: #64748b;
      --background-color: #f8fafc;
      --surface-color: #ffffff;
      --text-color: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --error-color: #ef4444;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      --radius: 0.5rem;
      --sidebar-width: 260px;
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--background-color);
      color: var(--text-color);
      line-height: 1.6;
    }

    .app-layout {
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: var(--sidebar-width);
      background: var(--surface-color);
      border-right: 1px solid var(--border-color);
      position: fixed;
      left: 0;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      z-index: 100;
      transition: var(--transition);
    }

    .sidebar-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-header .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary-color);
      text-decoration: none;
    }

    .sidebar-nav {
      padding: 1rem 0;
    }

    .sidebar-nav ul {
      list-style: none;
    }

    .sidebar-nav a {
      display: flex;
      align-items: center;
      padding: 0.75rem 1.5rem;
      color: var(--text-color);
      text-decoration: none;
      transition: var(--transition);
      font-weight: 500;
    }

    .sidebar-nav a:hover,
    .sidebar-nav a.active {
      background: var(--primary-color);
      color: white;
    }

    .sidebar-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 1.5rem;
      border-top: 1px solid var(--border-color);
      background: var(--surface-color);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--primary-color);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }

    .user-details {
      flex: 1;
    }

    .user-details .name {
      font-weight: 600;
      font-size: 0.875rem;
    }

    .user-details .email {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* Main Content Area */
    .main-wrapper {
      flex: 1;
      margin-left: var(--sidebar-width);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Bar */
    .topbar {
      background: var(--surface-color);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(10px);
      background: rgba(255, 255, 255, 0.9);
    }

    .topbar-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-color);
    }

    /* Main Content */
    .main-content {
      flex: 1;
      padding: 2rem;
    }

    .card {
      background: var(--surface-color);
      border-radius: var(--radius);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
    }

    .card-header {
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
    }

    /* Buttons */
    .btn {
      padding: 0.625rem 1.25rem;
      border-radius: var(--radius);
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: var(--transition);
      font-size: 0.875rem;
      text-decoration: none;
      display: inline-block;
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .btn-secondary {
      background: var(--secondary-color);
      color: white;
    }

    .btn-outline {
      background: transparent;
      color: var(--primary-color);
      border: 1px solid var(--primary-color);
    }

    .btn-outline:hover {
      background: var(--primary-color);
      color: white;
    }

    .btn-danger {
      background: var(--error-color);
      color: white;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
      }

      .sidebar.mobile-open {
        transform: translateX(0);
      }

      .main-wrapper {
        margin-left: 0;
      }

      .main-content {
        padding: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <a href="/" class="logo">zomzam.com</a>
      </div>

      <nav class="sidebar-nav">
        <ul>
          <li><a href="/Views/Landing/main.php" class="active">Dashboard</a></li>
          <li><a href="#profile">Profile</a></li>
          <li><a href="#settings">Settings</a></li>
          <?php if ($currentUser['role'] === 'admin'): ?>
            <li><a href="#admin">Admin Panel</a></li>
          <?php endif; ?>
        </ul>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">
            <?php echo strtoupper(substr($currentUser['username'], 0, 1)); ?>
          </div>
          <div class="user-details">
            <div class="name"><?php echo htmlspecialchars($currentUser['username']); ?></div>
            <div class="email"><?php echo htmlspecialchars($currentUser['email']); ?></div>
          </div>
        </div>
        <button class="btn btn-outline" style="width: 100%;" onclick="handleLogout()">Logout</button>
      </div>
    </aside>

    <!-- Main Content Wrapper -->
    <div class="main-wrapper">
      <!-- Top Bar -->
      <div class="topbar">
        <div class="topbar-content">
          <h1 class="page-title"><?php echo $pageTitle ?? 'Dashboard'; ?></h1>
          <div>
            <span style="color: var(--text-muted); font-size: 0.875rem;">
              Welcome back, <?php echo htmlspecialchars($currentUser['username']); ?>!
            </span>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <main class="main-content">
        <?php
        // This is where page content will be injected
        if (isset($content)) {
          echo $content;
        } else {
          // Default dashboard content
          echo '<div class="card">';
          echo '<div class="card-header">';
          echo '<h2 class="card-title">Dashboard</h2>';
          echo '</div>';
          echo '<p>Welcome to your dashboard! This is your main application area.</p>';
          echo '</div>';
        }
        ?>
      </main>
    </div>
  </div>

  <!-- Core JavaScript -->
  <script src="/Assets/Js/translator.js"></script>
  
  <!-- Additional Page Scripts -->
  <?php if (isset($additionalJS)): ?>
    <?php foreach ($additionalJS as $js): ?>
      <script src="<?php echo $js; ?>"></script>
    <?php endforeach; ?>
  <?php endif; ?>

  <script>
    // Logout handler
    async function handleLogout() {
      if (!confirm('Are you sure you want to logout?')) {
        return;
      }

      try {
        const response = await fetch('/Api_handler/auth.php?action=logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();
        
        if (result.success) {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Logout failed:', error);
        alert('Logout failed. Please try again.');
      }
    }

    // Mobile sidebar toggle
    function toggleSidebar() {
      document.querySelector('.sidebar').classList.toggle('mobile-open');
    }
  </script>
</body>
</html>
