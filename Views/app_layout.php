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

// Fetch user details including first_name and last_name
$userModel = new User();
$userDetails = $userModel->getUserById($_SESSION['user_id']);

$currentUser = [
  'id' => $_SESSION['user_id'] ?? 0,
  'username' => $_SESSION['username'] ?? 'Guest',
  'email' => $_SESSION['email'] ?? '',
  'role' => $_SESSION['role'] ?? 'user',
  'avatar' => !empty($_SESSION['user_avatar']) ? $_SESSION['user_avatar'] : '/Assets/Img/default-avatar.png',
  'first_name' => $userDetails['first_name'] ?? '',
  'last_name' => $userDetails['last_name'] ?? ''
];

// Check if user needs to complete their profile
$needsProfileCompletion = empty($currentUser['first_name']) || empty($currentUser['last_name']);
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
            'in': 'fadeIn 0.3s ease-out',
            'out': 'fadeOut 0.3s ease-in'
          },
          keyframes: {
            shimmer: {
              '0%': { backgroundPosition: '-200% 0' },
              '100%': { backgroundPosition: '200% 0' },
            },
            fadeIn: {
              '0%': { opacity: '0', transform: 'scale(0.95)' },
              '100%': { opacity: '1', transform: 'scale(1)' }
            },
            fadeOut: {
              '0%': { opacity: '1', transform: 'scale(1)' },
              '100%': { opacity: '0', transform: 'scale(0.95)' }
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

    /* ── Zenith Global Scrollbar ── */
    /* Chrome / Safari / Edge */
    ::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(203, 213, 225, 0.7);
      border-radius: 99px;
    }
    html.dark ::-webkit-scrollbar-track {
      background: rgba(51, 65, 85, 0.7);
    }
    ::-webkit-scrollbar-thumb {
      background: #EE5712;
      border-radius: 99px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #df3c0b;
    }
    /* Firefox */
    * {
      scrollbar-width: thin;
      scrollbar-color: #EE5712 rgba(203, 213, 225, 0.7);
    }
    html.dark * {
      scrollbar-color: #EE5712 rgba(51, 65, 85, 0.7);
    }

    /* ── Notification Styles ── */
    .neon-blue-glow {
      color: #00f2ff;
      text-shadow: 0 0 8px rgba(0, 242, 255, 0.8);
      filter: drop-shadow(0 0 5px rgba(0, 242, 255, 0.5));
    }
    .notification-item {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .notification-item:hover {
      background-color: rgba(238, 87, 18, 0.05);

    }
    html.dark .notification-item:hover {
      background-color: rgba(238, 87, 18, 0.1);
    }
    .unread-dot {
      width: 8px;
      height: 8px;
      background-color: #EE5712;
      border-radius: 9999px;
      box-shadow: 0 0 10px #EE5712;
    }

    /* ── Social Action Undo Styles ── */
    .hover-show {
      display: none;
    }
    .zz-btn-pending:hover .hover-show {
      display: inline-block;
    }
    .zz-btn-pending:hover .hover-hide {
      display: none;
    }
    .zz-btn-pending {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    .zz-btn-pending:hover {
      background: rgba(239, 68, 68, 0.1) !important;
      color: #ef4444 !important;
      border-color: rgba(239, 68, 68, 0.3) !important;
    }

    /* ── Unfriend Button ── */
    .zz-btn-unfriend {
      background: transparent;
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zz-btn-unfriend:hover { 
      background: rgba(239, 68, 68, 0.1); 
      border-color: rgba(239, 68, 68, 0.5); 
      transform: scale(1.03); 
    }

    /* ── Zenith Confirmation Modal ── */
    .zz-confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .zz-confirm-overlay.show {
      opacity: 1;
    }
    .zz-confirm-modal {
      background: white;
      border-radius: 1rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      overflow: hidden;
      transform: scale(0.9) translateY(20px);
      opacity: 0;
      transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .zz-confirm-overlay.show .zz-confirm-modal {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    html.dark .zz-confirm-modal {
      background: #1a1d24;
      border: 1px solid rgba(51, 65, 85, 0.6);
    }
    .zz-confirm-header {
      padding: 1.5rem;
      border-bottom: 1px solid rgba(226, 232, 240, 0.8);
    }
    html.dark .zz-confirm-header {
      border-bottom-color: rgba(51, 65, 85, 0.6);
    }
    .zz-confirm-body {
      padding: 1.5rem;
    }
    .zz-confirm-footer {
      padding: 1rem 1.5rem;
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      border-top: 1px solid rgba(226, 232, 240, 0.8);
      background: rgba(248, 250, 252, 0.5);
    }
    html.dark .zz-confirm-footer {
      border-top-color: rgba(51, 65, 85, 0.6);
      background: rgba(15, 23, 42, 0.5);
    }
    .zz-confirm-btn {
      padding: 0.625rem 1.25rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
      border: none;
      outline: none;
    }
    .zz-confirm-btn:focus {
      outline: 2px solid rgba(238, 87, 18, 0.5);
      outline-offset: 2px;
    }
    .zz-confirm-btn-cancel {
      background: rgba(100, 116, 139, 0.1);
      color: #64748b;
    }
    .zz-confirm-btn-cancel:hover {
      background: rgba(100, 116, 139, 0.2);
      transform: translateY(-1px);
    }
    html.dark .zz-confirm-btn-cancel {
      background: rgba(148, 163, 184, 0.1);
      color: #94a3b8;
    }
    .zz-confirm-btn-confirm {
      background: #EE5712;
      color: white;
    }
    .zz-confirm-btn-confirm:hover {
      background: #df3c0b;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(238, 87, 18, 0.3);
    }
    .zz-confirm-btn-danger {
      background: #ef4444;
      color: white;
    }
    .zz-confirm-btn-danger:hover {
      background: #dc2626;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    /* ── Community Topbar Tabs ── */
    .zz-topbar-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.875rem;
      border-radius: 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
      white-space: nowrap;
      border: 1.5px solid transparent;
      background: rgba(255, 255, 255, 0.5);
      position: relative;
    }
    html.dark .zz-topbar-tab {
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.05);
    }
    .zz-topbar-tab:hover {
      background: rgba(238, 87, 18, 0.1);
      color: #EE5712;
      transform: translateY(-1px);
    }
    html.dark .zz-topbar-tab:hover {
      background: rgba(238, 87, 18, 0.15);
    }
    .zz-topbar-tab-active {
      background: rgba(238, 87, 18, 0.14) !important;
      color: #EE5712 !important;
      border-color: rgba(238, 87, 18, 0.3);
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(238, 87, 18, 0.12);
    }
    html.dark .zz-topbar-tab-active {
      background: rgba(238, 87, 18, 0.18) !important;
      box-shadow: 0 2px 4px rgba(238, 87, 18, 0.2);
    }
    .zz-topbar-tab-active:hover {
      transform: none;
    }
    .zz-topbar-tab svg {
      width: 1.125rem;
      height: 1.125rem;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .zz-topbar-tab:hover svg {
      transform: scale(1.1);
    }
    .zz-topbar-tab:active {
      transform: scale(0.98);
    }

    /* ── Enhanced Tooltips for Icon-Only Buttons ── */
    .zz-topbar-tab[title]:hover::after {
      content: attr(title);
      position: absolute;
      top: calc(100% + 0.5rem);
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95);
      color: white;
      padding: 0.375rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
      white-space: nowrap;
      z-index: 1000;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: tooltipFadeIn 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    html.dark .zz-topbar-tab[title]:hover::after {
      background: rgba(248, 250, 252, 0.95);
      color: #0f172a;
    }
    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    /* ── Search Autocomplete in Topbar ── */
    .zz-search-autocomplete {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 0.5rem;
      background: white;
      border: 1px solid rgba(226, 232, 240, 0.8);
      border-radius: 0.75rem;
      box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.15);
      max-height: 320px;
      overflow-y: auto;
      z-index: 110;
    }
    html.dark .zz-search-autocomplete {
      background: #1a1d24;
      border-color: rgba(51, 65, 85, 0.6);
    }
    .zz-search-autocomplete-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      cursor: pointer;
      transition: background-color 150ms;
      border-bottom: 1px solid rgba(226, 232, 240, 0.5);
      text-decoration: none;
      color: inherit;
    }
    .zz-search-autocomplete-item:last-child {
      border-bottom: none;
    }
    .zz-search-autocomplete-item:hover {
      background: rgba(238, 87, 18, 0.05);
      text-decoration: none;
    }
    html.dark .zz-search-autocomplete-item {
      border-bottom-color: rgba(51, 65, 85, 0.4);
    }
    html.dark .zz-search-autocomplete-item:hover {
      background: rgba(238, 87, 18, 0.1);
    }
    .zz-search-autocomplete-avatar {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      object-fit: cover;
      background: rgba(238, 87, 18, 0.1);
    }
    .zz-search-autocomplete-info {
      flex: 1;
      min-width: 0;
    }
    .zz-search-autocomplete-username {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    html.dark .zz-search-autocomplete-username {
      color: #f1f5f9;
    }
    .zz-search-autocomplete-email {
      font-size: 0.75rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
        <!-- Zenith Global Timer Section -->
        <div id="zz-topbar-timer-sec" class="h-full flex items-center px-10">

          <div id="zz-topbar-timer-inner" class="relative z-10 flex items-center gap-5">
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
          </div>
        </div>
      </div>

      <!-- Community Tabs (always visible - centered) -->
      <div id="zz-topbar-center" class="flex-1 flex items-center justify-center">
        <div id="zz-topbar-community-tabs" class="flex items-center gap-3">
          <a href="/community/dashboard" id="zz-tab-home" title="Community Home"
            class="zz-topbar-tab">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </a>

          <a href="/community/friends" id="zz-tab-friends" title="Friends"
            class="zz-topbar-tab">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </a>

          <a href="/community/requests" id="zz-tab-requests" title="Friend Requests"
            class="zz-topbar-tab">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span class="zz-inbox-badge hidden w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center"></span>
          </a>

          <a href="/community/following" id="zz-tab-following" title="Following"
            class="zz-topbar-tab">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </a>

          <a href="/community/discover" id="zz-tab-discover" title="Discover People"
            class="zz-topbar-tab">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              <circle cx="10" cy="10" r="3"/>
            </svg>
          </a>
        </div>
      </div>

      <div id="zz-topbar-right" class="flex items-center gap-4 pr-4">
        <!-- Community Search (always visible) -->
        <div class="relative flex-shrink-0 w-64 border-r border-slate-200 dark:border-slate-700 pr-4">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="zz-community-search-input"
            type="search"
            autocomplete="off"
            placeholder="Search users…"
            class="w-full pl-10 pr-4 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            aria-label="Search users"
          >
          <div id="zz-search-autocomplete" class="zz-search-autocomplete hidden"></div>
        </div>
        
        <!-- Notifications -->
        <div id="zz-topbar-notifications" class="relative group border-r border-slate-200 dark:border-slate-700 pr-4">
          <button id="zz-notification-btn" onclick="toggleNotifications()"
            class="relative flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all bg-white dark:bg-slate-900 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
            <span id="zz-notification-badge" class="hidden absolute top-0 right-0 w-6 h-6 bg-primary-500 text-white text-[12px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 transform translate-x-2 -translate-y-2 shadow-md">0</span>
          </button>
          
          <div id="zz-notification-dropdown" class="absolute right-0 top-full pt-2 hidden z-[110] w-80">
            <div class="bg-white dark:bg-surface-dark rounded-2xl shadow-glass border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <!-- Header -->
              <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <span class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Notifications</span>
                <button onclick="markAllNotificationsAsRead()" title="Mark all as read" class="p-1.5 text-slate-400 hover:text-primary-500 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </button>
              </div>
              <!-- List -->
              <div id="zz-notification-list" class="max-h-96 overflow-y-auto py-1">
                <div class="px-4 py-8 text-center">
                  <div class="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                  </div>
                  <p class="text-xs text-slate-500 italic">No new notifications</p>
                </div>
              </div>
              <!-- Footer -->
              <a href="/community" class="block py-2 text-[10px] font-bold text-center text-slate-400 dark:text-slate-500 uppercase tracking-widest border-t border-slate-100 dark:border-slate-800 hover:text-primary-500 transition-colors">View All Community</a>
            </div>
          </div>
        </div>

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
    <main id="zz-main-view" class="flex-1 overflow-y-auto">
      <?php
      if (isset($content)) {
        echo $content;
      } else {
        echo '<div id="zz-view-container" class="max-w-6xl mx-auto p-4 md:p-8">';
        echo '<div id="zz-fallback-view" class="bg-white rounded-2xl shadow-apple border border-slate-100 p-8 text-center">';
        echo '<h2 id="zz-fallback-title" class="text-2xl font-bold text-slate-900 mb-2">Dashboard</h2>';
        echo '<p id="zz-fallback-text" class="text-slate-500">Welcome to your pristine dashboard.</p>';
        echo '</div>';
        echo '</div>';
      }
      ?>
    </main>
  </div>

  <!-- Profile Completion Modal -->
  <?php if ($needsProfileCompletion): ?>
  <div id="zz-profile-complete-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in">
    <div class="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4 overflow-hidden" style="animation: fadeIn 0.3s ease-out;">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/20 dark:to-surface-dark">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center shadow-lg">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">Complete Your Profile</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Help us personalize your experience</p>
          </div>
        </div>
      </div>

      <!-- Form -->
      <form id="zz-profile-complete-form" class="px-6 py-6 space-y-4">
        <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token'] ?? ''; ?>">
        
        <div>
          <label for="zz-first-name-input" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            First Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="zz-first-name-input"
            name="first_name"
            required
            maxlength="100"
            placeholder="Enter your first name"
            class="w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          >
        </div>

        <div>
          <label for="zz-last-name-input" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Last Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="zz-last-name-input"
            name="last_name"
            required
            maxlength="100"
            placeholder="Enter your last name"
            class="w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          >
        </div>

        <div class="pt-2">
          <button
            type="submit"
            id="zz-profile-complete-btn"
            class="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>

        <p class="text-xs text-center text-slate-500 dark:text-slate-400">
          This information helps us personalize your experience
        </p>
      </form>
    </div>
  </div>

  <script>
    // Handle profile completion form submission
    document.getElementById('zz-profile-complete-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const btn = document.getElementById('zz-profile-complete-btn');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>';
      
      const formData = new FormData(e.target);
      
      try {
        const response = await fetch('/api/profile/update', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Close modal with animation
          const modal = document.getElementById('zz-profile-complete-modal');
          modal.style.animation = 'fadeOut 0.3s ease-in';
          setTimeout(() => {
            modal.remove();
            // Refresh to update UI with new name
            location.reload();
          }, 300);
        } else {
          btn.disabled = false;
          btn.textContent = originalText;
          alert(result.message || 'Failed to update profile. Please try again.');
        }
      } catch (error) {
        btn.disabled = false;
        btn.textContent = originalText;
        alert('Network error. Please check your connection and try again.');
      }
    });

    // Auto-focus first name input
    setTimeout(() => {
      document.getElementById('zz-first-name-input')?.focus();
    }, 400);
  </script>
  <?php endif; ?>

  <!-- Zenith Confirmation Modal (Global) -->
  <div id="zz-confirm-overlay" class="zz-confirm-overlay" style="display: none;">
    <div class="zz-confirm-modal">
      <div class="zz-confirm-header">
        <h3 id="zz-confirm-title" class="text-lg font-bold text-slate-900 dark:text-white"></h3>
      </div>
      <div class="zz-confirm-body">
        <p id="zz-confirm-message" class="text-sm text-slate-600 dark:text-slate-400"></p>
      </div>
      <div class="zz-confirm-footer">
        <button id="zz-confirm-cancel" class="zz-confirm-btn zz-confirm-btn-cancel">Cancel</button>
        <button id="zz-confirm-confirm" class="zz-confirm-btn zz-confirm-btn-confirm">Confirm</button>
      </div>
    </div>
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

  <!-- Zenith Notifications UI Controller -->
  <script>
    const NotificationsUI = {
      isOpen: false,
      unreadCount: 0,
      notifications: [],
      
      init() {
        this.fetchNotifications();
        
        // Listen to SSE new-notification event
        window.addEventListener('new-notification', (e) => {
          this.handleIncoming(e.detail);
        });

        // Listen to SSE social updates to retract notifications in real-time
        window.addEventListener('zz-social-update', (e) => {
          const { action, from_user_id } = e.detail;
          if (action === 'request_cancelled') {
            const initialCount = this.notifications.length;
            this.notifications = this.notifications.filter(n => {
              if (n.type === 'friend_request' && String(n.data?.from_user_id) === String(from_user_id)) {
                if (!n.is_read) {
                  this.unreadCount = Math.max(0, this.unreadCount - 1);
                }
                return false;
              }
              return true;
            });
            if (this.notifications.length !== initialCount) {
              this.render();
            }
          }
        });

        // Close dropdown on clicking outside
        document.addEventListener('click', (e) => {
          const dropdown = document.getElementById('zz-notification-dropdown');
          const btn = document.getElementById('zz-notification-btn');
          if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.classList.add('hidden');
            this.isOpen = false;
          }
        });
      },

      toggle() {
        const dropdown = document.getElementById('zz-notification-dropdown');
        if (!dropdown) return;
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
          dropdown.classList.remove('hidden');
          this.fetchNotifications();
        } else {
          dropdown.classList.add('hidden');
        }
      },

      async fetchNotifications() {
        try {
          const response = await fetch('/api/notifications?action=list');
          const res = await response.json();
          if (res.success) {
            this.notifications = res.notifications;
            this.unreadCount = this.notifications.filter(n => !n.is_read).length;
            this.render();
          }
        } catch (e) {
          console.error('Error fetching notifications:', e);
        }
      },

      async markAllRead() {
        try {
          const response = await fetch('/api/notifications?action=read_all', { method: 'POST' });
          const res = await response.json();
          if (res.success) {
            this.unreadCount = 0;
            this.notifications.forEach(n => n.is_read = 1);
            this.render();
            
            // Visual confirmation chime/glow animation on badge
            const badge = document.getElementById('zz-notification-badge');
            if (badge) {
              badge.classList.add('scale-0');
              setTimeout(() => badge.classList.add('hidden'), 200);
            }
          }
        } catch (e) {
          console.error('Error marking all as read:', e);
        }
      },

      playPopSound() {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          
          if (!window.zzAudioContext) {
            window.zzAudioContext = new AudioContextClass();
          }
          const audioCtx = window.zzAudioContext;
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
          
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          const now = audioCtx.currentTime;
          
          // Ultra-premium clean C5-A5-bass pop sweep (Stripe/Apple style chime pop)
          osc.frequency.setValueAtTime(523.25, now); // C5 start
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.04); // sweep up
          osc.frequency.exponentialRampToValueAtTime(150, now + 0.12); // impact drop
          
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.25, now + 0.02); // quick attack
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18); // smooth decay
          
          osc.start(now);
          osc.stop(now + 0.2);
        } catch (e) {
          console.warn('Audio Context sound play failed:', e);
        }
      },

      handleIncoming(notification) {
        this.playPopSound();
        this.unreadCount++;
        // Prepend to active list
        this.notifications.unshift({
          id: notification.id,
          type: notification.type,
          data: notification.data,
          is_read: 0,
          created_at: notification.created_at || new Date().toISOString()
        });
        
        this.render();
        
        // Dynamic pop effect on badge
        const badge = document.getElementById('zz-notification-badge');
        if (badge) {
          badge.classList.remove('hidden', 'scale-0');
          badge.classList.add('animate-bounce');
          setTimeout(() => badge.classList.remove('animate-bounce'), 1000);
        }
      },

      updateBadge() {
        const badge = document.getElementById('zz-notification-badge');
        if (!badge) return;
        if (this.unreadCount > 0) {
          badge.textContent = this.unreadCount;
          badge.classList.remove('hidden', 'scale-0');
        } else {
          badge.classList.add('hidden');
        }
      },

      render() {
        const container = document.getElementById('zz-notification-list');
        if (!container) return;
        
        this.updateBadge();

        if (this.notifications.length === 0) {
          container.innerHTML = `
            <div class="px-4 py-8 text-center">
              <div class="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
              </div>
              <p class="text-xs text-slate-500 italic">No new notifications</p>
            </div>`;
          return;
        }

        container.innerHTML = this.notifications.map(n => {
          let titleClass = 'text-slate-900 dark:text-white';
          
          let typeBadge = '';
          if (n.type === 'friend_request' || n.type === 'friend_accept') {
            typeBadge = `
              <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 border border-white dark:border-slate-900 flex items-center justify-center shadow-sm neon-blue-glow">
                <svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                </svg>
              </div>`;
          } else {
            typeBadge = `
              <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary-500 border border-white dark:border-slate-900 flex items-center justify-center shadow-sm text-white">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
              </div>`;
          }

          const initialsAvatar = `
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-white text-[11px] font-black uppercase border border-slate-200 dark:border-slate-700 shadow-sm">
              ${(n.data.from_username || 'U').charAt(0)}
            </div>`;

          const avatarContent = n.data.from_avatar 
            ? `<img class="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-100 dark:border-slate-800" src="${n.data.from_avatar}" alt="${n.data.from_username}">`
            : initialsAvatar;

          const avatar = `
            <div class="relative w-8 h-8 flex-shrink-0">
              ${avatarContent}
              ${typeBadge}
            </div>`;

          const unread = !n.is_read ? '<span class="unread-dot flex-shrink-0"></span>' : '';

          return `
            <div class="notification-item flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800/50">
              <div class="flex-shrink-0">
                ${avatar}
              </div>
              <div class="flex-grow min-w-0">
                <p class="text-xs ${titleClass} font-semibold leading-tight">
                  @${n.data.from_username}
                </p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ${n.data.message || ''}
                </p>
                <span class="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">
                  ${this.timeAgo(n.created_at)}
                </span>
              </div>
              ${unread}
            </div>`;
        }).join('');
      },

      timeAgo(dateStr) {
        if (!dateStr) return 'just now';
        // Handle ISO formats or standard MySQL timestamps cleanly
        const parsed = Date.parse(dateStr.replace(/-/g, '/'));
        const date = isNaN(parsed) ? new Date() : new Date(parsed);
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return "just now";
      }
    };

    // Global toggle helper
    function toggleNotifications() {
      NotificationsUI.toggle();
    }

    function markAllNotificationsAsRead() {
      NotificationsUI.markAllRead();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        NotificationsUI.init();
      });
    } else {
      NotificationsUI.init();
    }

    // Zenith Audio Unlocking Engine (unblocks browser autoplay restrictions)
    document.addEventListener('click', () => {
      if (window.zzAudioContext && window.zzAudioContext.state === 'suspended') {
        window.zzAudioContext.resume();
      }
    }, { once: true });

    // ── Community Tab Active State ──
    // Automatically highlight the active Community tab based on current URL
    document.addEventListener('DOMContentLoaded', () => {
      const currentPath = window.location.pathname;
      const tabMap = {
        '/community/dashboard': 'zz-tab-home',
        '/community/friends': 'zz-tab-friends',
        '/community/requests': 'zz-tab-requests',
        '/community/following': 'zz-tab-following',
        '/community/discover': 'zz-tab-discover'
      };

      // Remove all active states
      document.querySelectorAll('.zz-topbar-tab').forEach(tab => {
        tab.classList.remove('zz-topbar-tab-active');
      });

      // Add active state to matching tab
      const activeTabId = tabMap[currentPath];
      if (activeTabId) {
        const activeTab = document.getElementById(activeTabId);
        if (activeTab) {
          activeTab.classList.add('zz-topbar-tab-active');
        }
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Zenith Confirmation Modal System
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * Show a beautiful custom confirmation dialog
     * @param {Object} options - Configuration object
     * @param {string} options.title - Modal title
     * @param {string} options.message - Modal message
     * @param {string} [options.confirmText='Confirm'] - Confirm button text
     * @param {string} [options.cancelText='Cancel'] - Cancel button text
     * @param {string} [options.type='primary'] - 'primary' | 'danger'
     * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
     */
    window.zzConfirm = function(options) {
      return new Promise((resolve) => {
        const overlay = document.getElementById('zz-confirm-overlay');
        const title = document.getElementById('zz-confirm-title');
        const message = document.getElementById('zz-confirm-message');
        const confirmBtn = document.getElementById('zz-confirm-confirm');
        const cancelBtn = document.getElementById('zz-confirm-cancel');

        // Set content
        title.textContent = options.title || 'Confirm Action';
        message.textContent = options.message || 'Are you sure?';
        confirmBtn.textContent = options.confirmText || 'Confirm';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        // Set button style based on type
        confirmBtn.className = 'zz-confirm-btn ' + 
          (options.type === 'danger' ? 'zz-confirm-btn-danger' : 'zz-confirm-btn-confirm');

        // Show modal
        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
          overlay.classList.add('show');
        });

        // Focus confirm button by default
        setTimeout(() => confirmBtn.focus(), 300);

        // Close modal function
        const closeModal = (result) => {
          overlay.classList.remove('show');
          setTimeout(() => {
            overlay.style.display = 'none';
            resolve(result);
          }, 250);
        };

        // Event handlers
        const handleConfirm = () => {
          confirmBtn.removeEventListener('click', handleConfirm);
          cancelBtn.removeEventListener('click', handleCancel);
          overlay.removeEventListener('click', handleOverlayClick);
          document.removeEventListener('keydown', handleKeydown);
          closeModal(true);
        };

        const handleCancel = () => {
          confirmBtn.removeEventListener('click', handleConfirm);
          cancelBtn.removeEventListener('click', handleCancel);
          overlay.removeEventListener('click', handleOverlayClick);
          document.removeEventListener('keydown', handleKeydown);
          closeModal(false);
        };

        const handleOverlayClick = (e) => {
          if (e.target === overlay) {
            handleCancel();
          }
        };

        const handleKeydown = (e) => {
          if (e.key === 'Escape') {
            handleCancel();
          } else if (e.key === 'Enter') {
            handleConfirm();
          }
        };

        // Attach event listeners
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleKeydown);
      });
    };
  </script>
</body>
</html>