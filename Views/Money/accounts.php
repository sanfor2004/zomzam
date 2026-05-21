<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Location: /');
    exit;
}

$pageTitle = 'Bank Accounts - zomzam.com';
$pageDescription = 'Manage your bank accounts and digital wallets.';

ob_start();
?>

<div id="zz-view-container" class="max-w-6xl mx-auto p-4 md:p-8">

<div id="money-app" class="space-y-8">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Bank Accounts</h1>
      <p class="text-slate-500 dark:text-slate-400">Manage your connected wallets and banks.</p>
    </div>
    <button onclick="openModal('modal-account')" class="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl transition-all shadow-lg active:scale-95">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      Add Account
    </button>
  </div>

  <div id="accounts-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <!-- Accounts will be injected here by JS -->
    <div class="h-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl"></div>
    <div class="h-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl"></div>
    <div class="h-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl"></div>
  </div>
</div>

<script src="/Assets/Js/money_app.js"></script>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
