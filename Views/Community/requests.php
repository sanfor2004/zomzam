<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Friend Requests — Community — zomzam.com';
$pageDescription = 'Manage your friend requests on Zomzam.';
$additionalJS    = ['/Assets/Js/community.js'];

ob_start();
?>

<!-- ══════════════════════════════════════════════════════════════════════
     Community: Friend Requests Page
     ════════════════════════════════════════════════════════════════════ -->

<style>
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

  .zz-btn-accept {
    background: #22c55e; color: white; border-color: #22c55e;
  }
  .zz-btn-accept:hover { background: #16a34a; }

  .zz-btn-decline {
    background: transparent; color: #ef4444; border-color: #ef4444;
  }
  .zz-btn-decline:hover { background: rgba(239,68,68,0.1); }

  .zz-btn-pending {
    background: rgba(100,116,139,0.1); color: #64748b;
    border-color: rgba(100,116,139,0.3);
  }
</style>

<!-- ── Page Wrapper ──────────────────────────────────────────────────────── -->
<div id="zz-community-page" class="p-4 md:p-8 space-y-6">
  <div id="zz-panel-requests" data-panel="requests" role="main">
    <div id="zz-requests-list" class="max-w-2xl space-y-3">
      <!-- Populated by community.js loadRequests() -->
    </div>
  </div>
</div>

<script>
  // Auto-initialize Requests view
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof loadRequests === 'function') {
      loadRequests();
    }
  });
</script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
