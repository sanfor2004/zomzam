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
    $stmt = $pdo->prepare("SELECT last_seen, is_idle FROM user_online_status WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $lastSeen = $row['last_seen'] ?? null;
    $isIdle = (bool)($row['is_idle'] ?? false);

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
    $isIdle = false;
    $offlineDuration = "unknown";
  }
} else {
  $isOnline = false;
  $isIdle = false;
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
<html id="zz-html-root" lang="en" class="scroll-smooth h-full bg-slate-50 dark:bg-[#111318]">

<head id="zz-head-main">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="description" content="<?php echo $pageDescription ?? 'zomzam.com App - Manage your account'; ?>">
  <title id="zz-page-title"><?php echo $pageTitle ?? 'App - zomzam.com'; ?></title>

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
  
  <!-- External Dependencies (Zenith-Tier Libraries) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>

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
          },
          animation: {
            'shimmer': 'shimmer 2s infinite linear',
          },
          keyframes: {
            shimmer: {
              '0%': { backgroundPosition: '-200% 0' },
              '100%': { backgroundPosition: '200% 0' },
            }
          }
        }
      }
    }
  </script>

  <!-- Additional Page Styles -->
  <?php if (isset($additionalCSS)): ?>
    <?php foreach ($additionalCSS as $css): ?>
      <?php 
        $filePath = $_SERVER['DOCUMENT_ROOT'] . $css;
        $version = file_exists($filePath) ? filemtime($filePath) : time();
      ?>
      <link rel="stylesheet" href="<?php echo $css; ?>?v=<?php echo $version; ?>">
    <?php endforeach; ?>
  <?php endif; ?>

  <style>
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .glass-header {
      position: relative;
      background: linear-gradient(to right, rgba(238, 87, 18, 0.12), rgba(255, 255, 255, 0.85)) !important;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      z-index: 100;
      /* Higher priority to ensure dropdowns are always on top */
    }

    html.dark .glass-header {
      background: linear-gradient(to right, rgba(238, 87, 18, 0.12), #111318) !important;
    }

    .glass-header::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
      opacity: 0.06;
      pointer-events: none;
      z-index: -1;
      /* Send to back of the header context */
      mix-blend-mode: overlay;
    }

    /* RTL Support for Topbar Gradient */
    html[dir="rtl"] .glass-header {
      background: linear-gradient(to right, rgba(238, 87, 18, 0.12), rgba(255, 255, 255, 0.85)) !important;
    }

    html[dir="rtl"].dark .glass-header {
      background: linear-gradient(to left, rgba(238, 87, 18, 0.12), #111318) !important;
    }

    /* Zenith Tree Lines - Simple Edition */
    #timeGroup > div,
    #moneyGroup > div,
    #communityGroup > div {
      border-left: 1.5px solid rgba(238, 87, 18, 0.2) !important;
      margin-left: 1.25rem !important;
      padding-left: 0.5rem !important;
      border-right: none !important;
    }

    html[dir="rtl"] #timeGroup > div,
    html[dir="rtl"] #moneyGroup > div,
    html[dir="rtl"] #communityGroup > div {
      border-left: none !important;
      border-right: 1.5px solid rgba(238, 87, 18, 0.2) !important;
      margin-left: 0 !important;
      margin-right: 1.25rem !important;
      padding-left: 0 !important;
      padding-right: 0.5rem !important;
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
      z-index: 1;
    }
  </style>
</head>

<body id="zz-body-root" class="h-full font-sans text-slate-900 dark:text-slate-100 flex flex-col md:flex-row overflow-hidden">

  <!-- Sidebar (Desktop) -->
  <aside id="zz-sidebar-main"
    class="hidden md:flex flex-col w-64 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 h-full flex-shrink-0 transition-all duration-300">

    <!-- Logo Area -->
    <div id="zz-sidebar-logo-area" class="h-20 flex items-center px-6 border-b border-slate-100 dark:border-slate-800/50">
      <a id="zz-sidebar-logo-link" href="/dashboard" class="flex items-center gap-3 group">
        <img id="zz-sidebar-logo-img" src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam.com"
          class="h-10 transition-transform group-hover:scale-105">
      </a>
    </div>

    <!-- Navigation Links -->
    <nav id="zz-sidebar-nav" class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
      <a id="zz-nav-dashboard" href="/dashboard"
        class="nav-link flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">
        <svg id="zz-nav-dashboard-svg" class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect id="zz-nav-dash-r1" x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect id="zz-nav-dash-r2" x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect id="zz-nav-dash-r3" x="14" y="14" width="7" height="7" rx="1"></rect>
          <rect id="zz-nav-dash-r4" x="3" y="14" width="7" height="7" rx="1"></rect>
        </svg>
        <zlang id="zz-nav-dash-text" key="nav_dashboard">App</zlang>
      </a>


      <!-- Time Management Group -->
      <div id="zz-nav-time-group-wrap" class="space-y-1">
        <button id="zz-nav-time-btn" onclick="toggleNavGroup('timeGroup')"
          class="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <zlang id="zz-nav-time-text" key="nav_time">Time Management</zlang>
          <svg id="timeGroup-icon" class="w-4 h-4 transition-transform duration-200 rotate-180" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2">
            <polyline id="zz-nav-time-poly" points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div id="timeGroup" class="block pr-3 py-1">
          <div id="zz-nav-time-sublist" class="ml-5 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
            <a id="zz-nav-time-exec" href="/time/execution"
              class="nav-link flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group">
              <svg id="zz-nav-time-exec-svg" class="w-4 h-4 flex-shrink-0 text-primary-400 group-hover:text-primary-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle id="zz-nav-time-exec-circle" cx="12" cy="12" r="10" />
                <polyline id="zz-nav-time-exec-poly" points="12 6 12 12 16 14" />
              </svg>
              <span id="zz-nav-time-exec-text">Pomodoro Timer</span>
            </a>
            <a id="zz-nav-time-tasks" href="/time/tasks"
              class="nav-link flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group">
              <svg id="zz-nav-time-tasks-svg" class="w-4 h-4 flex-shrink-0 text-amber-400 group-hover:text-amber-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path id="zz-nav-time-tasks-p1" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect id="zz-nav-time-tasks-r1" x="9" y="3" width="6" height="4" rx="1" />
                <line id="zz-nav-time-tasks-l1" x1="9" y1="12" x2="15" y2="12" />
                <line id="zz-nav-time-tasks-l2" x1="9" y1="16" x2="12" y2="16" />
              </svg>
              <span id="zz-nav-time-tasks-text">Task Board</span>
            </a>
            <a id="zz-nav-time-planning" href="/time/planning"
              class="nav-link flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group">
              <svg id="zz-nav-time-planning-svg" class="w-4 h-4 flex-shrink-0 text-purple-400 group-hover:text-purple-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path id="zz-nav-time-planning-p1" d="M12 2L2 7l10 5 10-5-10-5z" />
                <path id="zz-nav-time-planning-p2" d="M2 17l10 5 10-5" />
                <path id="zz-nav-time-planning-p3" d="M2 12l10 5 10-5" />
              </svg>
              <span id="zz-nav-time-planning-text">Dream Planning</span>
            </a>
            <a id="zz-nav-time-ideas" href="/time/ideas"
              class="nav-link flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group">
              <svg id="zz-nav-time-ideas-svg" class="w-4 h-4 flex-shrink-0 text-emerald-400 group-hover:text-emerald-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path id="zz-nav-time-ideas-p1" d="M9 18h6" />
                <path id="zz-nav-time-ideas-p2" d="M10 22h4" />
                <path id="zz-nav-time-ideas-p3"
                  d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.75 1.23 1.51 1.41 2.5Z" />
              </svg>
              <span id="zz-nav-time-ideas-text">Idea Capture</span>
            </a>
            <a id="zz-nav-time-tracker" href="/time/tracker"
              class="nav-link flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group">
              <svg id="zz-nav-time-tracker-svg" class="w-4 h-4 flex-shrink-0 text-blue-400 group-hover:text-blue-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path id="zz-nav-time-tracker-p1" d="M3 3v18h18" />
                <path id="zz-nav-time-tracker-p2" d="M18 17V9" />
                <path id="zz-nav-time-tracker-p3" d="M13 17V5" />
                <path id="zz-nav-time-tracker-p4" d="M8 17v-3" />
              </svg>
              <span id="zz-nav-time-tracker-text">Tracker</span>
            </a>
        </div>
      </div>
      <!-- Money Management Group -->
      <div id="zz-nav-money-group-wrap" class="space-y-1">
        <button id="zz-nav-money-btn" onclick="toggleNavGroup('moneyGroup')"
          class="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <zlang id="zz-nav-money-text" key="nav_money">Money Management</zlang>
          <svg id="moneyGroup-icon" class="w-4 h-4 transition-transform duration-200 rotate-180" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2">
            <polyline id="zz-nav-money-poly" points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div id="moneyGroup" class="block pr-3 py-1">
          <div id="zz-nav-money-sublist" class="ml-5 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
            <a id="zz-nav-money-dash" href="/money/dashboard"
              class="nav-link block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">Overview</a>
            <a id="zz-nav-money-exp" href="/money/expenses"
              class="nav-link block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">Expenses</a>
            <a id="zz-nav-money-inc" href="/money/income"
              class="nav-link block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">Income</a>
            <a id="zz-nav-money-acc" href="/money/accounts"
              class="nav-link block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">Accounts</a>
            <a id="zz-nav-money-lend" href="/money/lend"
              class="nav-link block px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">Lending</a>
          </div>
        </div>
      </div>
      <!-- Community Section -->
      <a id="zz-nav-community" href="/community"
        class="nav-link flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">
        <svg id="zz-nav-community-svg" class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path id="zz-nav-community-p1" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle id="zz-nav-community-c1" cx="9" cy="7" r="4"></circle>
          <path id="zz-nav-community-p2" d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path id="zz-nav-community-p3" d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <zlang id="zz-nav-community-text" key="nav_community">Community</zlang>
      </a>

      <!-- Global Settings Section -->
      <a id="zz-nav-settings" href="/settings"
        class="nav-link flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors">
        <svg id="zz-nav-settings-svg" class="w-5 h-5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path id="zz-nav-settings-p1" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle id="zz-nav-settings-c1" cx="12" cy="12" r="3"/>
        </svg>
        <zlang id="zz-nav-settings-text" key="nav_settings">Global Settings</zlang>
      </a>
    </nav>

    <!-- User Mini Profile -->
    <div id="zz-sidebar-user-section" class="relative border-t border-slate-100 dark:border-slate-800/50 overflow-hidden">
      <!-- Online Tracker / Announcement Section -->
      <div id="online-tracker-bg" class="absolute inset-0 z-0 pointer-events-none"
        style="background: linear-gradient(to top, <?php echo $isOnline ? ($isIdle ? 'rgba(251, 191, 36, 0.15)' : 'rgba(34, 197, 94, 0.15)') : 'rgba(100, 116, 139, 0.15)'; ?> 0%, transparent 100%);">
      </div>

      <div id="zz-sidebar-user-content" class="p-4 relative z-10">
        <div id="zz-sidebar-user-status-row" class="flex items-center justify-between mb-2 px-3">
          <div id="zz-sidebar-user-status-box" class="flex items-center gap-2">
            <div id="current-user-online-indicator"
              class="w-1.5 h-1.5 rounded-full <?php echo $isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'; ?>">
            </div>
            <span id="current-user-online-label"
              class="text-[9px] font-bold <?php echo $isOnline ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'; ?> uppercase tracking-wider">
              <?php echo $isOnline ? 'Online Mode' : 'Offline (' . $offlineDuration . ')'; ?>
            </span>
          </div>
        </div>
        <a id="zz-sidebar-profile-link" href="/u/<?php echo urlencode($currentUser['username']); ?>"
          class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group">
          <div id="zz-sidebar-avatar-box"
            class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-sm overflow-hidden border border-primary-500/20 group-hover:scale-105 transition-transform">
            <?php if (!empty($currentUser['avatar'])): ?>
              <img id="zz-sidebar-avatar-img" src="<?php echo htmlspecialchars($currentUser['avatar']); ?>?t=<?php echo time(); ?>" alt="Profile"
                class="w-full h-full object-cover">
            <?php else: ?>
              <span id="zz-sidebar-avatar-initial"><?php echo strtoupper(substr($currentUser['username'], 0, 1)); ?></span>
            <?php endif; ?>
          </div>
          <div id="zz-sidebar-user-info" class="flex-1 min-w-0">
            <p id="zz-sidebar-username"
              class="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-primary-500 transition-colors">
              <?php echo htmlspecialchars($currentUser['username']); ?>
            </p>
            <p id="zz-sidebar-user-email" class="text-xs text-slate-500 dark:text-slate-400 truncate">
              <?php echo htmlspecialchars($currentUser['email']); ?>
            </p>
          </div>
          <svg id="zz-sidebar-profile-chevron" class="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2">
            <path id="zz-sidebar-profile-chevron-p1" d="M9 18l6-6-6-6" />
          </svg>
        </a>
      </div>
    </div>
  </aside>

  <!-- Mobile Header -->
  <div id="zz-mobile-header"
    class="md:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
    <a id="zz-mobile-logo-link" href="/dashboard" class="flex items-center gap-2">
      <img id="zz-mobile-logo-img" src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam.com" class="h-8">
    </a>
    <button id="zz-mobile-menu-btn" onclick="document.getElementById('mobileMenu').classList.toggle('hidden')"
      class="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg">
      <svg id="zz-mobile-menu-svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path id="zz-mobile-menu-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  </div>

  <!-- Mobile Menu Overlay -->
  <div id="mobileMenu"
    class="hidden md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 z-50 shadow-xl">
    <nav id="zz-mobile-nav" class="px-4 py-4 space-y-2">
      <a id="zz-mobile-nav-dash" href="/dashboard" class="block px-3 py-2 text-sm font-medium text-slate-900 rounded-lg hover:bg-slate-50">
        <zlang id="zz-mobile-nav-dash-text" key="nav_dashboard">App</zlang>
      </a>
      <!-- Mobile Time Management Group -->
      <div id="zz-mobile-time-group-wrap" class="space-y-1">
        <button id="zz-mobile-time-btn" onclick="toggleNavGroup('mobileTimeGroup')"
          class="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <span>
            <zlang id="zz-mobile-time-text" key="nav_time">Time Management</zlang>
          </span>
          <svg id="mobileTimeGroup-icon" class="w-4 h-4 transition-transform duration-200 rotate-180"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline id="zz-mobile-time-poly" points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div id="mobileTimeGroup" class="block pr-3 py-1">
          <div id="zz-mobile-time-sublist" class="ml-5 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
            <a id="zz-mobile-nav-time-exec" href="/time/execution"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg id="zz-mobile-nav-time-exec-svg" class="w-4 h-4 flex-shrink-0 text-primary-400 group-hover:text-primary-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle id="zz-mobile-nav-time-exec-circle" cx="12" cy="12" r="10" />
                <polyline id="zz-mobile-nav-time-exec-poly" points="12 6 12 12 16 14" />
              </svg>Pomodoro Timer</a>
            <a id="zz-mobile-nav-time-tasks" href="/time/tasks"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg id="zz-mobile-nav-time-tasks-svg" class="w-4 h-4 flex-shrink-0 text-amber-400 group-hover:text-amber-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path id="zz-mobile-nav-time-tasks-p1" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect id="zz-mobile-nav-time-tasks-r1" x="9" y="3" width="6" height="4" rx="1" />
                <line id="zz-mobile-nav-time-tasks-l1" x1="9" y1="12" x2="15" y2="12" />
                <line id="zz-mobile-nav-time-tasks-l2" x1="9" y1="16" x2="12" y2="16" />
              </svg>Task Board</a>
            <a id="zz-mobile-nav-time-planning" href="/time/planning"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg id="zz-mobile-nav-time-planning-svg" class="w-4 h-4 flex-shrink-0 text-purple-400 group-hover:text-purple-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path id="zz-mobile-nav-time-planning-p1" d="M12 2L2 7l10 5 10-5-10-5z" />
                <path id="zz-mobile-nav-time-planning-p2" d="M2 17l10 5 10-5" />
                <path id="zz-mobile-nav-time-planning-p3" d="M2 12l10 5 10-5" />
              </svg>Dream Planning</a>
            <a id="zz-mobile-nav-time-ideas" href="/time/ideas"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg id="zz-mobile-nav-time-ideas-svg" class="w-4 h-4 flex-shrink-0 text-emerald-400 group-hover:text-emerald-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path id="zz-mobile-nav-time-ideas-p1" d="M9 18h6" />
                <path id="zz-mobile-nav-time-ideas-p2" d="M10 22h4" />
                <path id="zz-mobile-nav-time-ideas-p3"
                  d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.75 1.23 1.51 1.41 2.5Z" />
              </svg>Idea Capture</a>
            <a id="zz-mobile-nav-time-tracker" href="/time/tracker"
              class="relative flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition-colors group before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">
              <svg id="zz-mobile-nav-time-tracker-svg" class="w-4 h-4 flex-shrink-0 text-blue-400 group-hover:text-blue-500 transition-colors"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path id="zz-mobile-nav-time-tracker-p1" d="M3 3v18h18" />
                <path id="zz-mobile-nav-time-tracker-p2" d="M18 17V9" />
                <path id="zz-mobile-nav-time-tracker-p3" d="M13 17V5" />
                <path id="zz-mobile-nav-time-tracker-p4" d="M8 17v-3" />
              </svg>Tracker</a>
          </div>
        </div>
      </div>

      <!-- Mobile Money Management Group -->
      <div id="zz-mobile-money-group-wrap" class="space-y-1">
        <button id="zz-mobile-money-btn" onclick="toggleNavGroup('mobileMoneyGroup')"
          class="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <span>
            <zlang id="zz-mobile-money-text" key="nav_money">Money Management</zlang>
          </span>
          <svg id="mobileMoneyGroup-icon" class="w-4 h-4 transition-transform duration-200 rotate-180"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline id="zz-mobile-money-poly" points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div id="mobileMoneyGroup" class="block pr-3 py-1">
          <div id="zz-mobile-money-sublist" class="ml-5 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
            <a id="zz-mobile-money-dash" href="/money/dashboard"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Overview</a>
            <a id="zz-mobile-money-exp" href="/money/expenses"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Expenses</a>
            <a id="zz-mobile-money-inc" href="/money/income"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Income</a>
            <a id="zz-mobile-money-acc" href="/money/accounts"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Accounts</a>
            <a id="zz-mobile-money-lend" href="/money/lend"
              class="relative block px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-4 before:w-4 before:h-px before:bg-slate-200 dark:before:bg-slate-700">Lending</a>
          </div>
        </div>
      </div>
      <div id="zz-mobile-divider-1" class="border-t border-slate-100 dark:border-slate-800 my-2 pt-2"></div>

      <!-- Mobile Language Switcher -->
      <div id="zz-mobile-lang-section" class="px-3 py-2">
        <p id="zz-mobile-lang-label" class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Language</p>
        <div id="zz-mobile-lang-grid" class="grid grid-cols-2 gap-2">
          <button id="zz-mobile-lang-en" onclick="switchLanguage('en')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">English</button>
          <button id="zz-mobile-lang-ar" onclick="switchLanguage('ar')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">العربية</button>
          <button id="zz-mobile-lang-es" onclick="switchLanguage('es')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">Español</button>
          <button id="zz-mobile-lang-it" onclick="switchLanguage('it')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">Italiano</button>
          <button id="zz-mobile-lang-fr" onclick="switchLanguage('fr')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">Français</button>
          <button id="zz-mobile-lang-he" onclick="switchLanguage('he')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors">עברית</button>
          <button id="zz-mobile-lang-zh" onclick="switchLanguage('zh')"
            class="flex items-center justify-center py-2 px-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 transition-colors col-span-2">中文</button>
        </div>
      </div>
      <div id="zz-mobile-divider-2" class="border-t border-slate-100 dark:border-slate-800 my-2 pt-2"></div>
      
      <a id="zz-mobile-nav-community" href="/community"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50">
        <svg id="zz-mobile-community-svg" class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path id="zz-mobile-community-p1" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle id="zz-mobile-community-c1" cx="9" cy="7" r="4"></circle>
          <path id="zz-mobile-community-p2" d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path id="zz-mobile-community-p3" d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <zlang id="zz-mobile-community-text" key="nav_community">Community</zlang>
      </a>

      <a id="zz-mobile-nav-settings" href="/settings"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50">
        <svg id="zz-mobile-settings-svg" class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path id="zz-mobile-settings-p1" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle id="zz-mobile-settings-c1" cx="12" cy="12" r="3"/>
        </svg>
        <zlang id="zz-mobile-settings-text" key="nav_settings">Global Settings</zlang>
      </a>

      <button id="zz-mobile-logout-btn" onclick="handleLogout()"
        class="w-full text-left px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50">
        <zlang id="zz-mobile-logout-text" key="nav_logout">Logout</zlang>
      </button>
    </nav>
  </div>

  <!-- Main Content Area -->
  <div id="zz-main-content-wrap" class="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-[#111318]">
    <!-- Topbar (Desktop) -->
    <header id="zz-desktop-topbar" class="hidden md:flex glass-header h-20 items-center justify-between flex-shrink-0">
      <div id="zz-topbar-left" class="flex items-center h-full">
        <!-- Zenith Smoke Announcement Section -->
        <div id="zz-topbar-smoke-sec" class="smoke-section h-full flex items-center px-10 min-w-[320px]">

          <div id="zz-topbar-smoke-inner" class="relative z-10 flex items-center gap-5">
            <!-- Live Session Indicator -->
            <div id="global-timer-container"
              class="hidden flex items-center gap-3 bg-white/40 dark:bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/50 dark:border-white/10 shadow-glass">
              <div id="zz-global-timer-dot-wrap" class="relative w-2 h-2">
                <span id="zz-global-timer-ping" class="absolute inset-0 bg-primary-500 rounded-full animate-ping opacity-75"></span>
                <span id="zz-global-timer-dot" class="relative block w-2 h-2 bg-primary-500 rounded-full"></span>
              </div>
              <div id="zz-global-timer-text-box" class="flex flex-col">
                <span id="global-timer-task"
                  class="text-[9px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest leading-none mb-1">Focusing</span>
                <span id="global-timer-clock"
                  class="text-sm font-black text-slate-900 dark:text-white leading-none tabular-nums">00:00</span>
              </div>
              <a id="global-timer-link" href="/time/execution"
                class="ml-2 p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors text-primary-500">
                <svg id="zz-global-timer-svg" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path id="zz-global-timer-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7m0 0l-7 7m7-7H3">
                  </path>
                </svg>
              </a>
            </div>

            <!-- Announcement Text -->
            <div id="topbar-announcement" class="flex flex-col">
              <span id="zz-topbar-ann-label" class="text-[10px] font-bold text-primary-500 uppercase tracking-[0.2em] leading-none mb-1.5">Live
                Session</span>
              <p id="zz-topbar-ann-quote" class="text-xs font-semibold text-slate-400 dark:text-slate-500 italic">"Focus on what matters, ignore
                the rest."</p>
            </div>
          </div>
        </div>
      </div>

      <div id="zz-topbar-right" class="flex items-center gap-4 pl-4 pr-4">
        <!-- Language Switcher -->
        <div id="zz-topbar-lang-dropdown" class="relative group border-r border-slate-200 dark:border-slate-700 pr-4">
          <button id="zz-topbar-lang-btn"
            class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all bg-white dark:bg-slate-900 shadow-sm">
            <svg id="zz-topbar-lang-svg" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path id="zz-topbar-lang-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129">
              </path>
            </svg>
          </button>
          <div id="zz-topbar-lang-menu" class="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
            <div id="zz-topbar-lang-menu-inner"
              class="w-32 bg-white dark:bg-surface-dark rounded-xl shadow-glass border border-slate-100 dark:border-slate-800 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <button id="zz-lang-en" onclick="switchLanguage('en')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">English</button>
              <button id="zz-lang-ar" onclick="switchLanguage('ar')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">العربية</button>
              <button id="zz-lang-es" onclick="switchLanguage('es')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Español</button>
              <button id="zz-lang-it" onclick="switchLanguage('it')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Italiano</button>
              <button id="zz-lang-fr" onclick="switchLanguage('fr')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Français</button>
              <button id="zz-lang-he" onclick="switchLanguage('he')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">עברית</button>
              <button id="zz-lang-zh" onclick="switchLanguage('zh')"
                class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">中文</button>
            </div>
          </div>
        </div>

        <!-- Theme Toggle -->
        <button id="zz-theme-toggle" onclick="toggleTheme()"
          class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all bg-white dark:bg-slate-900 shadow-sm">
          <svg id="zz-theme-sun-svg" class="w-4 h-4 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path id="zz-theme-sun-path" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <svg id="zz-theme-moon-svg" class="w-4 h-4 hidden dark:block text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <circle id="zz-theme-moon-c1" cx="12" cy="12" r="5"></circle>
            <line id="zz-theme-moon-l1" x1="12" y1="1" x2="12" y2="3"></line>
            <line id="zz-theme-moon-l2" x1="12" y1="21" x2="12" y2="23"></line>
            <line id="zz-theme-moon-l3" x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line id="zz-theme-moon-l4" x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line id="zz-theme-moon-l5" x1="1" y1="12" x2="3" y2="12"></line>
            <line id="zz-theme-moon-l6" x1="21" y1="12" x2="23" y2="12"></line>
            <line id="zz-theme-moon-l7" x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line id="zz-theme-moon-l8" x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </button>

        <!-- Logout Button -->
        <button id="zz-topbar-logout" onclick="handleLogout()"
          class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 transition-all bg-white dark:bg-slate-900 shadow-sm">
          <svg id="zz-topbar-logout-svg" class="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path id="zz-topbar-logout-p1" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline id="zz-topbar-logout-poly" points="16 17 21 12 16 7"></polyline>
            <line id="zz-topbar-logout-l1" x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <main id="zz-main-view" class="flex-1 overflow-y-auto p-4 md:p-8">
      <div id="zz-view-container" class="max-w-6xl mx-auto h-full">
        <?php
        if (isset($content)) {
          echo $content;
        } else {
          echo '<div id="zz-fallback-view" class="bg-white rounded-2xl shadow-apple border border-slate-100 p-8 text-center">';
          echo '<h2 id="zz-fallback-title" class="text-2xl font-bold text-slate-900 mb-2">Dashboard</h2>';
          echo '<p id="zz-fallback-text" class="text-slate-500">Welcome to your pristine dashboard.</p>';
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
      <?php 
        $filePath = $_SERVER['DOCUMENT_ROOT'] . $js;
        $version = file_exists($filePath) ? filemtime($filePath) : time();
      ?>
      <script src="<?php echo $js; ?>?v=<?php echo $version; ?>"></script>
    <?php endforeach; ?>
  <?php endif; ?>

  <!-- Zenith Core Engine -->
  <script src="/Assets/Js/core.js?v=<?php echo filemtime(BASE_PATH . '/Assets/Js/core.js'); ?>"></script>

  <!-- Zenith Global Timer Engine -->
  <script src="/Assets/Js/global_timer.js?v=<?php echo file_exists(BASE_PATH . '/Assets/Js/global_timer.js') ? filemtime(BASE_PATH . '/Assets/Js/global_timer.js') : time(); ?>"></script>

  <!-- Zenith Stream Waiter Engine (SSE) -->
  <script
    src="/Assets/Js/stream_waiter.js?v=<?php echo filemtime(BASE_PATH . '/Assets/Js/stream_waiter.js'); ?>"></script>
</body>
</html>