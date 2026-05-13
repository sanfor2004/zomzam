<?php
// Start session
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

// Ensure user is authenticated
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
  header('Location: /');
  exit;
}

// Track user online status
if (isset($_SESSION['user_id'])) {
  try {
    $pdo = getConnection();

    // We don't update here anymore, let the JS heartbeat handle it for real-time accuracy
    // But we update once on page load to ensure they are immediately marked online
    $stmt = $pdo->prepare("INSERT INTO user_online_status (user_id, last_seen) 
                          VALUES (?, NOW()) 
                          ON DUPLICATE KEY UPDATE last_seen = NOW()");
    $stmt->execute([$_SESSION['user_id']]);

    // Fetch status
    $stmt = $pdo->prepare("SELECT last_seen FROM user_online_status WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $lastSeen = $stmt->fetchColumn();

    $diff = time() - strtotime($lastSeen);
    $isOnline = $diff < 5; // 5 seconds threshold for testing

    $offlineDuration = "a while ago";
    if ($lastSeen) {
      if ($diff < 60)
        $offlineDuration = "just now";
      elseif ($diff < 3600)
        $offlineDuration = floor($diff / 60) . "m ago";
      elseif ($diff < 86400)
        $offlineDuration = floor($diff / 3600) . "h ago";
      else
        $offlineDuration = floor($diff / 86400) . "d ago";
    }
  } catch (Exception $e) {
    $isOnline = false;
    $offlineDuration = "unknown";
  }
} else {
  $isOnline = false;
  $offlineDuration = "";
}

$currentUser = [
  'id' => $_SESSION['user_id'] ?? 0,
  'username' => $_SESSION['username'] ?? 'Guest',
  'email' => $_SESSION['email'] ?? '',
  'role' => $_SESSION['role'] ?? 'user',
  'avatar' => $_SESSION['user_avatar'] ?? ''
];
?>
<!DOCTYPE html>
<html lang="en" class="scroll-smooth h-full bg-slate-50 dark:bg-[#111318]">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="description" content="<?php echo $pageDescription ?? 'zomzam.com App - Manage your account'; ?>">
  <title><?php echo $pageTitle ?? 'App - zomzam.com'; ?></title>

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/Assets/Img/favicon.ico">

  <!-- Preconnect for performance -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Modern Typography (Inter for pristine UI) -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
    rel="stylesheet">

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    // Theme initialization - Default to dark mode
    if (localStorage.getItem('theme') === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'dark');
    }

    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          },
          colors: {
            primary: {
              50: '#fff0eb',
              100: '#ffdcd1',
              200: '#ffbfa8',
              300: '#ff9874',
              400: '#ff6633',
              500: '#EE5712', // Zomzam Orange
              600: '#df3c0b',
              700: '#b92b0b',
              800: '#94240e',
              900: '#77200e',
            },
            surface: {
              light: '#ffffff',
              dark: '#111318',
              hover: '#f8fafc',
            }
          },
          boxShadow: {
            'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
            'apple': '0 4px 24px -6px rgba(0, 0, 0, 0.08)',
          }
        }
      }
    }
  </script>

  <!-- Additional Page Styles -->
  <?php if (isset($additionalCSS)): ?>
    <?php foreach ($additionalCSS as $css): ?>
      <link rel="stylesheet" href="<?php echo $css; ?>">
    <?php endforeach; ?>
  <?php endif; ?>

  <style>
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .glass-header {
      background: rgba(255, 255, 255, 0.85) !important;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .dark .glass-header {
      background: rgba(255, 255, 255, 0.05) !important;
      /* Keep it subtle glass in dark mode, but not solid dark */
    }

    .nav-link-active {
      color: #EE5712 !important;
      background-color: rgba(238, 87, 18, 0.1) !important;
      font-weight: 600;
    }

    .nav-link-active svg {
      stroke: #EE5712 !important;
    }

    /* Smoke & Noise Zenith Effect - Creative Version */
    .smoke-section {
      position: relative;
      background: linear-gradient(to right, rgba(238, 87, 18, 0.12), transparent);
      overflow: hidden;
    }

    .smoke-section::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
      opacity: 0.08;
      pointer-events: none;
      z-index: 2;
      mix-blend-mode: overlay;
    }

    .dark .smoke-section {
      background: linear-gradient(to right, rgba(238, 87, 18, 0.12), #1d1f23);
    }

    /* RTL Support for Announcement Section */
    html[dir="rtl"] .smoke-section {
      background: linear-gradient(to left, rgba(238, 87, 18, 0.12), transparent);
    }

    html[dir="rtl"] .dark .smoke-section {
      background: linear-gradient(to left, rgba(238, 87, 18, 0.12), #1d1f23);
    }
  </style>
</head>

<body class="h-full font-sans text-slate-900 dark:text-slate-100 flex flex-col md:flex-row overflow-hidden">

  <!-- Sidebar (Desktop) -->
  <aside
    class="hidden md:flex flex-col w-64 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 h-full flex-shrink-0 transition-all duration-300">

    <!-- Logo Area -->
    <div class="h-20 flex items-center px-6 border-b border-slate-100 dark:border-slate-800/50">
      <a href="/dashboard" class="flex items-center gap-3 group">
        <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam.com"
          class="h-8 transition-transform group-hover:scale-105">
      </a>
    </div>

    <!-- Navigation Links -->
    <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
      <a href="/dashboard"
        class="nav-link flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">
        <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        </svg>
        <zlang key="nav_dashboard">App</zlang>
      </a>


      <!-- Time Management Group -->
      <div class="space-y-1">
        <button onclick="toggleNavGroup('timeGroup')"
          class="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <zlang key="nav_time">Time Management</zlang>
          <svg id="timeGroup-icon" class="w-4 h-4 transition-transform duration-200 rotate-180" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div id="timeGroup" class="block pr-3 py-1">
          <div class="ml-5 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
            <a href="/time/execution"
              class="nav-link relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-primary-400 group-hover:text-primary-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Pomodoro Timer
            </a>
            <a href="/time/tasks"
              class="nav-link relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-amber-400 group-hover:text-amber-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <line x1="9" y1="12" x2="15" y2="12" />
                <line x1="9" y1="16" x2="12" y2="16" />
              </svg>
              Task Board
            </a>
            <a href="/time/planning"
              class="nav-link relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-purple-400 group-hover:text-purple-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Dream Planning
            </a>
            <a href="/time/ideas"
              class="nav-link relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-emerald-400 group-hover:text-emerald-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path
                  d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.75 1.23 1.51 1.41 2.5Z" />
              </svg>
              Idea Capture
            </a>
            <a href="/time/tracker"
              class="nav-link relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-blue-400 group-hover:text-blue-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
              Tracker
            </a>
          </div>
        </div>
      </div>

      <!-- Money Management Group -->
      <div class="space-y-1">
        <button onclick="toggleNavGroup('moneyGroup')"
          class="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <zlang key="nav_money">Money Management</zlang>
          <svg id="moneyGroup-icon" class="w-4 h-4 transition-transform duration-200 rotate-180" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div id="moneyGroup" class="block pr-3 py-1">
          <div class="ml-5 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
            <a href="/money/dashboard"
              class="nav-link relative block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Overview</a>
            <a href="/money/expenses"
              class="nav-link relative block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Expenses</a>
            <a href="/money/income"
              class="nav-link relative block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Income</a>
            <a href="/money/accounts"
              class="nav-link relative block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Accounts</a>
            <a href="/money/lend"
              class="nav-link relative block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Lending</a>
          </div>
        </div>
      </div>
      <!-- Community Section -->
      <a href="/community"
        class="nav-link flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">
        <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <zlang key="nav_community">Community</zlang>
      </a>
    </nav>

    <!-- User Mini Profile -->
    <div class="relative border-t border-slate-100 dark:border-slate-800/50 overflow-hidden">
      <!-- Online Tracker / Announcement Section -->
      <div class="absolute inset-0 z-0 pointer-events-none"
        style="background: linear-gradient(to top, <?php echo $isOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)'; ?> 0%, transparent 100%);">
      </div>

      <div class="p-4 relative z-10">
        <div class="flex items-center justify-between mb-2 px-3">
          <div class="flex items-center gap-2">
            <div id="current-user-online-indicator"
              class="w-1.5 h-1.5 rounded-full <?php echo $isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'; ?>">
            </div>
            <span id="current-user-online-label"
              class="text-[9px] font-bold <?php echo $isOnline ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'; ?> uppercase tracking-wider">
              <?php echo $isOnline ? 'Online Mode' : 'Offline (' . $offlineDuration . ')'; ?>
            </span>
          </div>
        </div>
        <a href="/u/<?php echo urlencode($currentUser['username']); ?>"
          class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group">
          <div
            class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-sm overflow-hidden border border-primary-500/20 group-hover:scale-105 transition-transform">
            <?php if (!empty($currentUser['avatar'])): ?>
              <img src="<?php echo htmlspecialchars($currentUser['avatar']); ?>?t=<?php echo time(); ?>" alt="Profile"
                class="w-full h-full object-cover">
            <?php else: ?>
              <?php echo strtoupper(substr($currentUser['username'], 0, 1)); ?>
            <?php endif; ?>
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-primary-500 transition-colors">
              <?php echo htmlspecialchars($currentUser['username']); ?>
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
              <?php echo htmlspecialchars($currentUser['email']); ?>
            </p>
          </div>
          <svg class="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>
      </div>
  </aside>

  <!-- Mobile Header -->
  <div
    class="md:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
    <a href="/dashboard" class="flex items-center gap-2">
      <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam.com" class="h-6">
    </a>
    <button onclick="document.getElementById('mobileMenu').classList.toggle('hidden')"
      class="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg">
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  </div>

  <!-- Mobile Menu Overlay -->
  <div id="mobileMenu"
    class="hidden md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 z-50 shadow-xl">
    <nav class="px-4 py-4 space-y-2">
      <a href="/dashboard" class="block px-3 py-2 text-sm font-medium text-slate-900 rounded-lg hover:bg-slate-50">
        <zlang key="nav_dashboard">App</zlang>
      </a>
      <!-- Mobile Time Management Group -->
      <div class="space-y-1">
        <button onclick="toggleNavGroup('mobileTimeGroup')"
          class="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <span>
            <zlang key="nav_time">Time Management</zlang>
          </span>
          <svg id="mobileTimeGroup-icon" class="w-4 h-4 transition-transform duration-200 rotate-180"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div id="mobileTimeGroup" class="block pr-3 py-1">
          <div class="ml-5 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
            <a href="/time/execution"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-primary-400 group-hover:text-primary-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>Pomodoro Timer</a>
            <a href="/time/tasks"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-amber-400 group-hover:text-amber-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <line x1="9" y1="12" x2="15" y2="12" />
                <line x1="9" y1="16" x2="12" y2="16" />
              </svg>Task Board</a>
            <a href="/time/planning"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-purple-400 group-hover:text-purple-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>Dream Planning</a>
            <a href="/time/ideas"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-emerald-400 group-hover:text-emerald-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path
                  d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.75 1.23 1.51 1.41 2.5Z" />
              </svg>Idea Capture</a>
            <a href="/time/tracker"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg class="w-4 h-4 flex-shrink-0 text-blue-400 group-hover:text-blue-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>Tracker</a>
          </div>
        </div>
      </div>

      <!-- Mobile Money Management Group -->
      <div class="space-y-1">
        <button onclick="toggleNavGroup('mobileMoneyGroup')"
          class="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <span>
            <zlang key="nav_money">Money Management</zlang>
          </span>
          <svg id="mobileMoneyGroup-icon" class="w-4 h-4 transition-transform duration-200 rotate-180"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div id="mobileMoneyGroup" class="block pr-3 py-1">
          <div class="ml-5 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
            <a href="/money/dashboard"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Overview</a>
            <a href="/money/expenses"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Expenses</a>
            <a href="/money/income"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Income</a>
            <a href="/money/accounts"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Accounts</a>
            <a href="/money/lend"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Lending</a>
          </div>
        </div>
      </div>
      <div class="border-t border-slate-100 dark:border-slate-800 my-2 pt-2"></div>

      <!-- Mobile Language Switcher -->
      <div class="px-3 py-2">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Language</p>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="switchLanguage('en')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">English</button>
          <button onclick="switchLanguage('ar')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">العربية</button>
          <button onclick="switchLanguage('es')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">Español</button>
          <button onclick="switchLanguage('it')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">Italiano</button>
          <button onclick="switchLanguage('fr')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">Français</button>
          <button onclick="switchLanguage('he')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">עברית</button>
          <button onclick="switchLanguage('zh')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors col-span-2">中文</button>
        </div>
      </div>

      <div class="border-t border-slate-100 dark:border-slate-800 my-2 pt-2"></div>
      <button onclick="handleLogout()"
        class="w-full text-left px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50">
        <zlang key="nav_logout">Logout</zlang>
      </button>
    </nav>
  </div>

  <!-- Main Content Area -->
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-[#111318]">
    <!-- Topbar (Desktop) -->
    <header class="hidden md:flex glass-header h-20 items-center justify-between flex-shrink-0 z-40">
      <div class="flex items-center h-full">
        <!-- Zenith Smoke Announcement Section -->
        <div class="smoke-section h-full flex items-center px-10 min-w-[320px]">

          <div class="relative z-10 flex items-center gap-5">
            <!-- Live Session Indicator -->
            <div id="global-timer-container"
              class="hidden flex items-center gap-3 bg-white/40 dark:bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/50 dark:border-white/10 shadow-glass">
              <div class="relative w-2 h-2">
                <span class="absolute inset-0 bg-primary-500 rounded-full animate-ping opacity-75"></span>
                <span class="relative block w-2 h-2 bg-primary-500 rounded-full"></span>
              </div>
              <div class="flex flex-col">
                <span id="global-timer-task"
                  class="text-[9px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest leading-none mb-1">Focusing</span>
                <span id="global-timer-clock"
                  class="text-sm font-black text-slate-900 dark:text-white leading-none tabular-nums">00:00</span>
              </div>
              <a id="global-timer-link" href="/time/execution"
                class="ml-2 p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors text-primary-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7m0 0l-7 7m7-7H3">
                  </path>
                </svg>
              </a>
            </div>

            <!-- Announcement Text -->
            <div id="topbar-announcement" class="flex flex-col">
              <span class="text-[10px] font-bold text-primary-500 uppercase tracking-[0.2em] leading-none mb-1.5">Live
                Session</span>
              <p class="text-xs font-semibold text-slate-400 dark:text-slate-500 italic">"Focus on what matters, ignore
                the rest."</p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 pl-4 pr-4">
        <!-- Language Switcher -->
        <div class="relative group border-r border-slate-200 dark:border-slate-700 pr-4">
          <button
            class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all bg-white dark:bg-slate-900 shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129">
              </path>
            </svg>
          </button>
          <div class="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
            <div
              class="w-32 bg-white dark:bg-surface-dark rounded-xl shadow-glass border border-slate-100 dark:border-slate-800 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <button onclick="switchLanguage('en')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">English</button>
              <button onclick="switchLanguage('ar')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">العربية</button>
              <button onclick="switchLanguage('es')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Español</button>
              <button onclick="switchLanguage('it')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Italiano</button>
              <button onclick="switchLanguage('fr')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Français</button>
              <button onclick="switchLanguage('he')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">עברית</button>
              <button onclick="switchLanguage('zh')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">中文</button>
            </div>
          </div>
        </div>

        <!-- Theme Toggle -->
        <button onclick="toggleTheme()"
          class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all bg-white dark:bg-slate-900 shadow-sm">
          <svg class="w-4 h-4 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <svg class="w-4 h-4 hidden dark:block text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </button>

        <!-- Logout Button -->
        <button onclick="handleLogout()"
          class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 transition-all bg-white dark:bg-slate-900 shadow-sm">
          <svg class="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <main class="flex-1 overflow-y-auto p-4 md:p-8">
      <div class="max-w-6xl mx-auto h-full">
        <?php
        if (isset($content)) {
          echo $content;
        } else {
          echo '<div class="bg-white rounded-2xl shadow-apple border border-slate-100 p-8 text-center">';
          echo '<h2 class="text-2xl font-bold text-slate-900 mb-2">Dashboard</h2>';
          echo '<p class="text-slate-500">Welcome to your pristine dashboard.</p>';
          echo '</div>';
        }
        ?>
      </div>
    </main>
  </div>

  <!-- Core JavaScript -->
  <script
    src="/Assets/Js/translator.js?v=<?php echo filemtime($_SERVER['DOCUMENT_ROOT'] . '/Assets/Js/translator.js'); ?>"
    zlangu="en"></script>

  <?php if (isset($additionalJS)): ?>
    <?php foreach ($additionalJS as $js): ?>
      <script src="<?php echo $js; ?>"></script>
    <?php endforeach; ?>
  <?php endif; ?>

  <!-- Zenith Stream Waiter Engine (SSE) -->
  <script
    src="/Assets/Js/stream_waiter.js?v=<?php echo filemtime(BASE_PATH . '/Assets/Js/stream_waiter.js'); ?>"></script>

  <script>
    function handleLogout() {
      if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/logout';
      }
    }

    function toggleTheme() {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // Toggle Accordion Navigation Groups
    function toggleNavGroup(groupId) {
      const group = document.getElementById(groupId);
      const icon = document.getElementById(groupId + '-icon');
      if (group.classList.contains('hidden')) {
        group.classList.remove('hidden');
        icon.classList.add('rotate-180');
      } else {
        group.classList.add('hidden');
        icon.classList.remove('rotate-180');
      }
    }

    // Modal Handlers
    function openModal(id) {
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeModal(id) {
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
      }
    }

    // Global Timer Sync
    function syncGlobalTimer() {
      const saved = localStorage.getItem('zomzam_pomodoro');
      const container = document.getElementById('global-timer-container');
      const clock = document.getElementById('global-timer-clock');
      const taskEl = document.getElementById('global-timer-task');
      const linkEl = document.getElementById('global-timer-link');

      if (!saved) {
        if (container) container.classList.add('hidden');
        return;
      }

      try {
        const data = JSON.parse(saved);
        if (!data.isRunning) {
          if (container) container.classList.add('hidden');
          return;
        }

        // Hide redirect button if already on the execution page
        if (linkEl) {
          if (window.location.pathname === '/time/execution') {
            linkEl.classList.add('hidden');
          } else {
            linkEl.classList.remove('hidden');
          }
        }

        // Calculate actual remaining time if it was running
        const elapsed = Math.floor((Date.now() - data.lastUpdate) / 1000);
        const remaining = Math.max(0, data.remaining - elapsed);

        if (remaining <= 0) {
          if (container) container.classList.add('hidden');
          return;
        }

        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;

        if (container) container.classList.remove('hidden');
        if (clock) clock.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (taskEl) taskEl.textContent = data.taskName || (data.isBreak ? 'Break' : 'Focusing');
      } catch (e) {
        if (container) container.classList.add('hidden');
      }
    }

    setInterval(syncGlobalTimer, 1000);
    document.addEventListener('DOMContentLoaded', syncGlobalTimer);

    // Listen for local updates (same tab) and cross-tab updates
    window.addEventListener('pomodoroUpdate', syncGlobalTimer);
    window.addEventListener('storage', (e) => {
      if (e.key === 'zomzam_pomodoro') syncGlobalTimer();
    });

    // Active Link Highlighting
    document.addEventListener('DOMContentLoaded', () => {
      const currentPath = window.location.pathname;
      const navLinks = document.querySelectorAll('.nav-link, #mobileMenu a');

      navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
          link.classList.add('nav-link-active');

          // Auto-expand parent accordion if active link is inside
          const parentGroup = link.closest('[id$="Group"]');
          if (parentGroup) {
            parentGroup.classList.remove('hidden');
            const icon = document.getElementById(parentGroup.id + '-icon');
            if (icon) icon.classList.add('rotate-180');
          }
        }
      });
    });
  </script>
</body>

</html>