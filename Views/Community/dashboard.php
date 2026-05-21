<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Community Dashboard — zomzam.com';
$pageDescription = 'Connect with friends, follow top performers, and grow your productivity circle on Zomzam.';
$additionalJS    = ['/Assets/Js/community.js'];

ob_start();
?>

<!-- ══════════════════════════════════════════════════════════════════════
     Community Dashboard — Overview & Quick Access
     ════════════════════════════════════════════════════════════════════ -->

<style>
  /* ── Component: Stats Card ─────────────────────────────────────────── */
  .zz-stats-card {
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(226,232,240,0.8);
    border-radius: 1.25rem;
    padding: 1.5rem;
    transition: transform 150ms cubic-bezier(0.4,0,0.2,1),
                box-shadow 150ms cubic-bezier(0.4,0,0.2,1),
                border-color 150ms;
  }
  .zz-stats-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px -8px rgba(238,87,18,0.12);
    border-color: rgba(238,87,18,0.25);
  }
  html.dark .zz-stats-card {
    background: rgba(17,19,24,0.8);
    border-color: rgba(51,65,85,0.6);
  }
  html.dark .zz-stats-card:hover { border-color: rgba(238,87,18,0.35); }

  /* ── Component: Quick Action Button ────────────────────────────────── */
  .zz-quick-action {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(226,232,240,0.8);
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
    text-decoration: none;
    transition: all 150ms cubic-bezier(0.4,0,0.2,1);
  }
  .zz-quick-action:hover {
    background: rgba(238,87,18,0.08);
    color: #EE5712;
    border-color: rgba(238,87,18,0.3);
    transform: translateX(4px);
  }
  html.dark .zz-quick-action {
    background: rgba(17,19,24,0.8);
    border-color: rgba(51,65,85,0.6);
    color: #94a3b8;
  }
  html.dark .zz-quick-action:hover {
    background: rgba(238,87,18,0.12);
    color: #EE5712;
  }
</style>

<!-- ── Page Wrapper ──────────────────────────────────────────────────────── -->
<div id="zz-community-dashboard" class="p-4 md:p-8 space-y-6">
  
  <!-- ── Welcome Banner ───────────────────────────────────────────────── -->
  <div class="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-8 text-white shadow-apple">
    <h1 class="text-3xl font-black mb-2">Welcome to Community</h1>
    <p class="text-primary-100 text-sm">Connect, collaborate, and grow with like-minded achievers.</p>
  </div>

  <!-- ── Stats Grid ───────────────────────────────────────────────────── -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="zz-stats-card">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white" id="stat-friends">-</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Friends</p>
        </div>
      </div>
    </div>

    <div class="zz-stats-card">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
          <svg class="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
        </div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white" id="stat-requests">-</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Requests</p>
        </div>
      </div>
    </div>

    <div class="zz-stats-card">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
        </div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white" id="stat-following">-</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Following</p>
        </div>
      </div>
    </div>

    <div class="zz-stats-card">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            <circle cx="10" cy="10" r="3"/>
          </svg>
        </div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">∞</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Discover</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Quick Actions ─────────────────────────────────────────────────── -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <a href="/community/friends" class="zz-quick-action">
      <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>
      <span>View All Friends</span>
      <svg class="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    </a>

    <a href="/community/requests" class="zz-quick-action">
      <svg class="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
      </svg>
      <span>Manage Friend Requests</span>
      <svg class="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    </a>

    <a href="/community/following" class="zz-quick-action">
      <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
      </svg>
      <span>See Who You're Following</span>
      <svg class="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    </a>

    <a href="/community/discover" class="zz-quick-action">
      <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        <circle cx="10" cy="10" r="3"/>
      </svg>
      <span>Discover New People</span>
      <svg class="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    </a>
  </div>
</div>

<script>
  // Load community stats
  async function loadCommunityStats() {
    try {
      // Load friends count
      const friendsRes = await fetch('/api/social?action=friends');
      const friendsData = await friendsRes.json();
      if (friendsData.success) {
        document.getElementById('stat-friends').textContent = friendsData.friends?.length || 0;
      }

      // Load requests count
      const requestsRes = await fetch('/api/social?action=requests_in');
      const requestsData = await requestsRes.json();
      if (requestsData.success) {
        document.getElementById('stat-requests').textContent = requestsData.requests?.length || 0;
      }

      // Load following count
      const followingRes = await fetch('/api/social?action=following');
      const followingData = await followingRes.json();
      if (followingData.success) {
        document.getElementById('stat-following').textContent = followingData.following?.length || 0;
      }
    } catch (e) {
      console.error('Error loading community stats:', e);
    }
  }

  // Auto-load stats on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCommunityStats);
  } else {
    loadCommunityStats();
  }
</script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
