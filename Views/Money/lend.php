<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Location: /');
    exit;
}

$pageTitle = 'Lending & Debt - zomzam.com';
$pageDescription = 'Track money you owe or are owed.';

ob_start();
?>

<div id="money-app" class="space-y-8">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Lending & Debt</h1>
      <p class="text-slate-500 dark:text-slate-400">Manage your outside money flow.</p>
    </div>
    <button onclick="openModal('modal-lend')" class="flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-primary-500/20 active:scale-95">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      Add Entry
    </button>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
    <!-- Owe Me -->
    <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-apple">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-black text-slate-900 dark:text-white">People Owe Me</h2>
        <span class="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-full">Total: EGP 0</span>
      </div>
      
      <div class="space-y-4">
        <p class="text-center py-8 text-slate-400 italic text-sm">No active lending found.</p>
      </div>
    </div>

    <!-- I Owe -->
    <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-apple">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-black text-slate-900 dark:text-white">I Owe People</h2>
        <span class="px-3 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-xs font-bold rounded-full">Total: EGP 0</span>
      </div>
      
      <div class="space-y-4">
        <p class="text-center py-8 text-slate-400 italic text-sm">You are debt free! 🎉</p>
      </div>
    </div>
  </div>
</div>

<script src="/Assets/Js/money_app.js"></script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
