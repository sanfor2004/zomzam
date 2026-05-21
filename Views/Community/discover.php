<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Discover People — Community — zomzam.com';
$pageDescription = 'Discover new people to connect with on Zomzam.';
$additionalJS    = ['/Assets/Js/community.js'];

ob_start();
?>

<!-- ══════════════════════════════════════════════════════════════════════
     Community: Discover Page
     ════════════════════════════════════════════════════════════════════ -->

<style>
  /* ── Component: User Card ──────────────────────────────────────────── */
  .zz-user-card {
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(226,232,240,0.8);
    border-radius: 1.25rem;
    padding: 1.25rem;
    transition: transform 150ms cubic-bezier(0.4,0,0.2,1),
                box-shadow 150ms cubic-bezier(0.4,0,0.2,1),
                border-color 150ms;
  }
  .zz-user-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px -8px rgba(238,87,18,0.12);
    border-color: rgba(238,87,18,0.25);
  }
  html.dark .zz-user-card {
    background: rgba(17,19,24,0.8);
    border-color: rgba(51,65,85,0.6);
  }
  html.dark .zz-user-card:hover { border-color: rgba(238,87,18,0.35); }

  /* ── Component: Social Buttons ─────────────────────────────────────── */
  .zz-social-btn {
    display: inline-flex; align-items: center; gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.75rem; font-weight: 600;
    cursor: pointer;
    transition: all 150ms cubic-bezier(0.4,0,0.2,1);
    white-space: nowrap;
    border: 1.5px solid transparent;
  }
  .zz-social-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .zz-btn-add {
    background: #EE5712; color: white;
    border-color: #EE5712;
  }
  .zz-btn-add:hover { background: #df3c0b; border-color: #df3c0b; transform: scale(1.03); }

  .zz-btn-follow {
    background: transparent; color: #EE5712;
    border-color: #EE5712;
  }
  .zz-btn-follow:hover { background: rgba(238,87,18,0.08); transform: scale(1.03); }

  .zz-btn-view {
    background: rgba(100,116,139,0.08); color: #475569;
    border-color: rgba(100,116,139,0.2);
    width: 100%;
    justify-content: center;
  }
  .zz-btn-view:hover { background: rgba(238,87,18,0.08); color: #EE5712; border-color: rgba(238,87,18,0.3); }

  .zz-btn-unfriend {
    background: transparent; color: #ef4444;
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

  /* ── Component: User Tag ───────────────────────────────────────────── */
  .zz-user-tag {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    background: rgba(238,87,18,0.08);
    color: #EE5712;
    border: 1px solid rgba(238,87,18,0.15);
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    transition: all 150ms;
  }
  html.dark .zz-user-tag {
    background: rgba(238,87,18,0.12);
    border-color: rgba(238,87,18,0.2);
  }
  .zz-user-tag:hover {
    background: rgba(238,87,18,0.15);
  }
</style>

<!-- ── Page Wrapper ──────────────────────────────────────────────────────── -->
<div id="zz-community-page" class="p-4 md:p-8 space-y-6">
  <!-- Page Header -->
  <div class="flex items-center gap-3">
    <div class="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
      <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        <circle cx="10" cy="10" r="3"/>
      </svg>
    </div>
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Best for you</h1>
      <p class="text-xs text-slate-400">Discover people who share your interests</p>
    </div>
  </div>

  <div id="zz-panel-discover" data-panel="discover" role="main">
    <div id="zz-discover-grid"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Populated by community.js loadDiscover() -->
    </div>
  </div>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
