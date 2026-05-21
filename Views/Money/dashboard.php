<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Location: /');
    exit;
}

$pageTitle = 'Money Dashboard - zomzam.com';
$pageDescription = 'Overview of your financial health and budget.';

ob_start();
?>

<div id="zz-view-container" class="max-w-6xl mx-auto p-4 md:p-8">

<div id="money-app" class="space-y-8">
  <!-- Header & Quick Actions -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Financial Overview</h1>
      <div class="flex items-center gap-4 mt-1">
        <p class="text-slate-500 dark:text-slate-400">Tracking your 60/20/20 rule progress.</p>
        <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
           <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display:</span>
           <select id="currency-switcher" onchange="MoneyApp.updateCurrencySettings()" class="bg-transparent text-[10px] font-bold text-primary-500 focus:outline-none cursor-pointer">
              <option value="EGP">EGP</option>
              <option value="USD">USD</option>
           </select>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <button onclick="openModal('modal-settings')" class="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary-500 rounded-2xl transition-all border border-slate-200 dark:border-slate-700 active:scale-95" title="Settings">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      </button>
      <button onclick="openModal('modal-income')" class="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Income
      </button>
      <button onclick="openModal('modal-expense')" class="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl transition-all shadow-lg active:scale-95">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/></svg>
        Expense
      </button>
    </div>
  </div>

  <!-- Account Balances -->
  <div id="account-balances" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
    <!-- Skeleton loader -->
    <div class="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl"></div>
    <div class="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl"></div>
    <div class="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl"></div>
    <div class="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl"></div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Budget Progress (60/20/20) -->
    <div class="lg:col-span-1 space-y-6">
      <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-apple">
        <h2 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Budget Allocation</h2>
        
        <div id="budget-progress" class="space-y-8">
          <!-- JS will inject progress bars here -->
          <div class="animate-pulse space-y-8">
            <div class="h-8 bg-slate-50 dark:bg-slate-800 rounded-xl"></div>
            <div class="h-8 bg-slate-50 dark:bg-slate-800 rounded-xl"></div>
            <div class="h-8 bg-slate-50 dark:bg-slate-800 rounded-xl"></div>
          </div>
        </div>

        <div class="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800/50">
           <p class="text-[10px] text-slate-400 uppercase font-bold tracking-widest text-center">Remaining Monthly Budget</p>
           <div class="flex items-center justify-center gap-2 mt-2">
             <p id="remaining-budget" class="text-3xl font-black text-slate-900 dark:text-white text-center">EGP 0</p>
             <button onclick="MoneyApp.toggleRemainingCurrency()" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-primary-500 transition-colors" title="Toggle Currency">
               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
             </button>
           </div>
        </div>
      </div>

      <!-- Quick Tips -->
      <div class="bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl p-6 text-white shadow-xl shadow-primary-500/20">
        <svg class="w-8 h-8 mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z"/></svg>
        <h3 class="text-lg font-bold mb-1">Financial Tip</h3>
        <p class="text-sm text-primary-50 opacity-90">Avoid lifestyle creep. When your income increases, keep your "Needs" at 60% of your old income for a while.</p>
      </div>

      <!-- Lending Summary -->
      <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-apple">
        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Debts & Loans</h3>
        <div id="lend-summary" class="space-y-4">
           <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-slate-600 dark:text-slate-400">Owe Me</span>
              <span id="lend-owe-me" class="text-sm font-black text-emerald-500">EGP 0</span>
           </div>
           <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-slate-600 dark:text-slate-400">I Owe</span>
              <span id="lend-i-owe" class="text-sm font-black text-rose-500">EGP 0</span>
           </div>
           <a href="/money/lend" class="block w-full text-center py-2 mt-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-primary-500 transition-colors">Manage All</a>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="lg:col-span-2">
      <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-apple h-full">
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-sm font-black text-slate-400 uppercase tracking-widest">Recent Transactions</h2>
          <a href="/money/expenses" class="text-xs font-bold text-primary-500 hover:text-primary-600 transition-colors">View All</a>
        </div>
        
        <div id="recent-transactions" class="space-y-3">
          <!-- Transactions will be injected here -->
          <div class="animate-pulse space-y-4">
             <div class="h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl"></div>
             <div class="h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl"></div>
             <div class="h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<script src="/Assets/Js/money_app.js"></script>

<!-- Modals -->
<!-- Add Income Modal -->
<div id="modal-income" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
  <div class="bg-white dark:bg-[#1a1d24] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
    <div class="p-8">
      <div class="flex items-center justify-between mb-8">
        <h3 class="text-2xl font-black text-slate-900 dark:text-white">Add Income</h3>
        <button onclick="closeModal('modal-income')" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="space-y-6">
        <div>
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">EGP</span>
            <input id="income-amount" type="number" placeholder="0.00" class="w-full pl-14 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-2xl font-black focus:outline-none focus:border-emerald-500 transition-all">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Account</label>
            <select id="income-account" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 appearance-none">
              <!-- JS will populate -->
            </select>
          </div>
          <div>
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
            <select id="income-category" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 appearance-none">
              <!-- JS will populate -->
            </select>
          </div>
        </div>

        <div>
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Description (Optional)</label>
          <input id="income-desc" type="text" placeholder="e.g. Salary, Bonus" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500">
        </div>

        <button id="btn-save-income" class="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95">Save Income</button>
      </div>
    </div>
  </div>
</div>

<!-- Add Expense Modal -->
<div id="modal-expense" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
  <div class="bg-white dark:bg-[#1a1d24] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
    <div class="p-8">
      <div class="flex items-center justify-between mb-8">
        <h3 class="text-2xl font-black text-slate-900 dark:text-white">Add Expense</h3>
        <button onclick="closeModal('modal-expense')" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="space-y-6">
        <div>
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">EGP</span>
            <input id="expense-amount" type="number" placeholder="0.00" class="w-full pl-14 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-2xl font-black focus:outline-none focus:border-primary-500 transition-all">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Account</label>
            <select id="expense-account" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary-500 appearance-none">
              <!-- JS will populate -->
            </select>
          </div>
          <div>
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
            <select id="expense-category" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary-500 appearance-none">
              <!-- JS will populate -->
            </select>
          </div>
        </div>

        <div>
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Description (Optional)</label>
          <input id="expense-desc" type="text" placeholder="e.g. Groceries, Netflix" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary-500">
        </div>

        <button id="btn-save-expense" class="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-lg transition-all active:scale-95">Save Expense</button>
      </div>
    </div>
  </div>
</div>

<!-- Settings Modal -->
<div id="modal-settings" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
  <div class="bg-white dark:bg-[#1a1d24] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
    <div class="p-8">
      <div class="flex items-center justify-between mb-8">
        <h3 class="text-xl font-black text-slate-900 dark:text-white">Settings</h3>
        <button onclick="closeModal('modal-settings')" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="space-y-6">
        <div>
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Primary Currency</label>
          <select id="settings-primary-currency" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none">
             <option value="EGP">EGP (Egyptian Pound)</option>
             <option value="USD">USD (US Dollar)</option>
             <option value="EUR">EUR (Euro)</option>
             <option value="GBP">GBP (British Pound)</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Secondary Currency</label>
          <select id="settings-secondary-currency" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none">
             <option value="EGP">EGP (Egyptian Pound)</option>
             <option value="USD" selected>USD (US Dollar)</option>
             <option value="EUR">EUR (Euro)</option>
             <option value="GBP">GBP (British Pound)</option>
          </select>
          <p class="text-[10px] text-slate-400 mt-2">Used for quick conversion and alternate displays.</p>
        </div>
        
        <button onclick="MoneyApp.saveGlobalSettings()" class="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl shadow-lg shadow-primary-500/20 transition-all active:scale-95">Save Changes</button>
      </div>
    </div>
  </div>
</div>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
