<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="description" content="<?php echo $pageDescription ?? 'Welcome to zomzam.com - Modern Web Application'; ?>">
  <title><?php echo $pageTitle ?? 'zomzam.com'; ?></title>
  
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
      --secondary-color: #64748b;
      --background-color: #ffffff;
      --surface-color: #f8fafc;
      --text-color: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --error-color: #ef4444;
      --success-color: #10b981;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      --radius: 0.5rem;
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--background-color);
      color: var(--text-color);
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .public-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Navigation */
    .navbar {
      background: var(--background-color);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 0;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
      background: rgba(255, 255, 255, 0.9);
    }

    .navbar .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .navbar .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary-color);
      text-decoration: none;
    }

    .navbar .nav-links {
      display: flex;
      gap: 2rem;
      list-style: none;
      align-items: center;
    }

    .navbar .nav-links a {
      color: var(--text-color);
      text-decoration: none;
      font-weight: 500;
      transition: var(--transition);
    }

    .navbar .nav-links a:hover {
      color: var(--primary-color);
    }

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

    .btn-outline {
      background: transparent;
      color: var(--primary-color);
      border: 1px solid var(--primary-color);
    }

    .btn-outline:hover {
      background: var(--primary-color);
      color: white;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      padding: 2rem 0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    /* Footer */
    .footer {
      background: var(--surface-color);
      border-top: 1px solid var(--border-color);
      padding: 2rem 0;
      margin-top: auto;
    }

    .footer .container {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    @media (max-width: 768px) {
      .navbar .nav-links {
        gap: 1rem;
      }
      
      .container {
        padding: 0 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="public-layout">
    <!-- Navigation -->
    <nav class="navbar">
      <div class="container">
        <a href="/" class="logo">zomzam.com</a>
        <ul class="nav-links">
          <li><a href="/">Home</a></li>
          <?php if (isset($_SESSION['logged_in']) && $_SESSION['logged_in']): ?>
            <li><a href="/Views/Landing/main.php">Dashboard</a></li>
            <li><a href="#" onclick="handleLogout()">Logout</a></li>
          <?php else: ?>
            <li><a href="#login" class="btn btn-outline">Login</a></li>
            <li><a href="#register" class="btn btn-primary">Sign Up</a></li>
          <?php endif; ?>
        </ul>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <div class="container">
        <?php
        // This is where page content will be injected
        if (isset($content)) {
          echo $content;
        } else {
          // Default content placeholder
          echo '<div style="text-align: center; padding: 4rem 0;">';
          echo '<h1 style="font-size: 3rem; margin-bottom: 1rem;">Welcome to zomzam.com</h1>';
          echo '<p style="color: var(--text-muted); font-size: 1.125rem;">Modern web application built with excellence</p>';
          echo '</div>';
        }
        ?>
      </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="container">
        <p>&copy; <?php echo date('Y'); ?> zomzam.com. All rights reserved.</p>
      </div>
    </footer>
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
      }
    }
  </script>
</body>
</html>
