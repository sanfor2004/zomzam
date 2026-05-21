<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Community — zomzam.com';
$pageDescription = 'Connect with friends, follow top performers, and grow your productivity circle on Zomzam.';
$additionalJS    = ['/Assets/Js/community.js'];
$showCommunityTabs = true; // Enable community tabs in main topbar

ob_start();
?>

<!-- ══════════════════════════════════════════════════════════════════════
     Community Page — Zenith-Tier Social Graph UI
     Sections: Friends | Requests | Following | Discover | Search
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

  /* ── Component: Request Card ───────────────────────────────────────── */
  .zz-request-card {
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(226,232,240,0.8);
    border-radius: 1rem;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    transition: border-color 150ms;
  }
  html.dark .zz-request-card {
    background: rgba(17,19,24,0.8);
    border-color: rgba(51,65,85,0.6);
  }

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

  .zz-btn-following {
    background: rgba(238,87,18,0.1); color: #EE5712;
    border-color: rgba(238,87,18,0.3);
  }
  .zz-btn-following:hover { background: rgba(239,68,68,0.1); color: #ef4444; border-color: #ef4444; }

  .zz-btn-pending {
    background: rgba(100,116,139,0.1); color: #64748b;
    border-color: rgba(100,116,139,0.3);
  }

  .zz-btn-view {
    background: rgba(100,116,139,0.08); color: #475569;
    border-color: rgba(100,116,139,0.2);
    width: 100%;
    justify-content: center;
  }
  .zz-btn-view:hover { background: rgba(238,87,18,0.08); color: #EE5712; border-color: rgba(238,87,18,0.3); }

  .zz-btn-accept {
    background: #22c55e; color: white; border-color: #22c55e;
  }
  .zz-btn-accept:hover { background: #16a34a; }

  .zz-btn-decline {
    background: transparent; color: #ef4444; border-color: #ef4444;
  }
  .zz-btn-decline:hover { background: rgba(239,68,68,0.1); }

  /* ── Component: Tabs ───────────────────────────────────────────────── */
  .zz-tab {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-size: 0.8125rem; font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.4,0,0.2,1);
    white-space: nowrap;
    border: 1.5px solid transparent;
    background: none;
    position: relative;
  }
  .zz-tab:hover { 
    background: rgba(238,87,18,0.08); 
    color: #EE5712;
    transform: translateY(-1px);
  }
  .zz-tab.tab-active {
    background: rgba(238,87,18,0.14);
    color: #EE5712;
    border-color: rgba(238,87,18,0.3);
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(238,87,18,0.12);
  }
  .zz-tab.tab-active:hover {
    transform: none;
  }
  .zz-tab svg {
    width: 0.875rem;
    height: 0.875rem;
    transition: transform 200ms cubic-bezier(0.4,0,0.2,1);
  }
  .zz-tab:hover svg {
    transform: scale(1.1);
  }
  .zz-tab:active {
    transform: scale(0.98);
  }
  html.dark .zz-tab { color: #94a3b8; }
  html.dark .zz-tab:hover { 
    color: #EE5712;
    background: rgba(238,87,18,0.12);
  }
  html.dark .zz-tab.tab-active {
    background: rgba(238,87,18,0.16);
    box-shadow: 0 2px 4px rgba(238,87,18,0.2);
  }

  /* ── Search Input ──────────────────────────────────────────────────── */
  .zz-search-input {
    width: 100%;
    padding: 0.75rem 1.25rem 0.75rem 3rem;
    border-radius: 9999px;
    border: 1.5px solid rgba(226,232,240,0.8);
    background: rgba(255,255,255,0.8);
    backdrop-filter: blur(8px);
    font-size: 0.875rem;
    color: #0f172a;
    transition: border-color 200ms, box-shadow 200ms;
    outline: none;
  }
  .zz-search-input:focus {
    border-color: rgba(238,87,18,0.5);
    box-shadow: 0 0 0 3px rgba(238,87,18,0.1);
  }
  html.dark .zz-search-input {
    background: rgba(17,19,24,0.8);
    border-color: rgba(51,65,85,0.6);
    color: #f1f5f9;
  }
</style>

<!-- ── Page Wrapper ──────────────────────────────────────────────────────── -->
<div id="zz-community-page" class="space-y-6">

  <!-- ── Panel: Friends ────────────────────────────────────────────────── -->
  <div id="zz-panel-friends" data-panel="friends" role="tabpanel" aria-labelledby="zz-tab-friends">
    <div id="zz-friends-grid"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Populated by community.js loadFriends() -->
    </div>
  </div>

  <!-- ── Panel: Requests ───────────────────────────────────────────────── -->
  <div id="zz-panel-requests" data-panel="requests" role="tabpanel" aria-labelledby="zz-tab-requests" class="hidden">
    <div id="zz-requests-list" class="max-w-2xl space-y-3">
      <!-- Populated by community.js loadRequests() -->
    </div>
  </div>

  <!-- ── Panel: Following ──────────────────────────────────────────────── -->
  <div id="zz-panel-following" data-panel="following" role="tabpanel" aria-labelledby="zz-tab-following" class="hidden">
    <div id="zz-following-grid"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Populated by community.js loadFollowing() -->
    </div>
  </div>

  <!-- ── Panel: Discover ───────────────────────────────────────────────── -->
  <div id="zz-panel-discover" data-panel="discover" role="tabpanel" aria-labelledby="zz-tab-discover" class="hidden">
    <div id="zz-discover-grid"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Populated by community.js loadDiscover() -->
    </div>
  </div>

  <!-- ── Search Results ────────────────────────────────────────────────── -->
  <div id="zz-search-results" class="hidden">
    <div id="zz-search-results-grid"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Populated by community.js runSearch() -->
    </div>
  </div>

</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
