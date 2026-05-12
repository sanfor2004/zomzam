<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Location: /');
    exit;
}

$pageTitle = 'Income Tracking - zomzam.com';
$pageDescription = 'Track your revenue and money sources.';

ob_start();
?>

<div id="money-app" class="space-y-8">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Income Tracking</h1>
      <p class="text-slate-500 dark:text-slate-400">Total revenue this month: <span class="font-bold text-emerald-500">EGP 0</span></p>
    </div>
    <button onclick="openModal('modal-income')" class="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      Add Income
    </button>
  </div>

  <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-apple">
    <div id="income-list" class="space-y-4">
      <!-- Income list injected by JS -->
      <div class="animate-pulse space-y-4">
        <div class="h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl"></div>
        <div class="h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl"></div>
      </div>
    </div>
  </div>
</div>

<script src="/Assets/Js/money_app.js"></script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
