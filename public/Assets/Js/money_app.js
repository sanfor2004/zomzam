/**
 * Money Management Module - Zomzam
 * Dragon-Tier Financial Engine
 */

const MoneyApp = (function() {
  const state = {
    accounts: [],
    categories: [],
    transactions: [],
    stats: { income: 0, expenses: {} },
    user_settings: { primary_currency: 'EGP', secondary_currency: 'USD' },
    display_currency: 'EGP',
    exchange_rate: 48.5, // 1 USD = 48.5 EGP
    show_secondary: false,
    filters: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    }
  };

  async function init() {
    console.log('MoneyApp initializing...');
    try {
      const initPromise = loadInitialData();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization Timeout')), 10000)
      );

      await Promise.race([initPromise, timeoutPromise]);
      
      populateSelects();
      renderDashboard();
      initEventListeners();
      console.log('MoneyApp initialized successfully.');
    } catch (e) {
      console.error('MoneyApp failed to initialize:', e);
      // Fallback UI or retry logic
      const containers = ['account-balances', 'budget-progress', 'recent-transactions'];
      containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="text-xs text-rose-500 p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl">Failed to load data. Please refresh.</p>';
      });
    }
  }

  async function api(action, body = {}) {
    try {
      const response = await fetch('/money/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
      });
      return await response.json();
    } catch (e) {
      console.error('API Error:', e);
      return { success: false, message: e.message };
    }
  }

  async function loadInitialData() {
    const res = await api('get_initial_data');
    if (res.success) {
      state.accounts = res.accounts;
      state.categories = res.categories;
      state.transactions = res.transactions;
      state.stats = res.stats;
      state.user_settings = res.user_settings || state.user_settings;
      state.display_currency = state.user_settings.primary_currency;
      
      // Update switcher UI
      const switcher = document.getElementById('currency-switcher');
      if (switcher) switcher.value = state.display_currency;
    } else {
      throw new Error(res.message || 'Failed to load initial data');
    }
  }

  function formatCurrency(amount, currency = 'EGP') {
    // If currency matches display_currency, just format
    // If not, we might want to convert, but usually we show the original
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  function convert(amount, from, to) {
    if (from === to) return amount;
    if (from === 'USD' && to === 'EGP') return amount * state.exchange_rate;
    if (from === 'EGP' && to === 'USD') return amount / state.exchange_rate;
    return amount;
  }

  function renderDashboard() {
    renderBalanceCards();
    renderBudgetProgress();
    renderLendSummary();
    renderRecentTransactions();
  }

  function renderBalanceCards() {
    const dashboardContainer = document.getElementById('account-balances');
    const accountsGrid = document.getElementById('accounts-grid');
    
    if (!dashboardContainer && !accountsGrid) return;

    const html = state.accounts.map(acc => `
      <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-apple transition-all group relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-500">
              ${getAccountIcon(acc.type)}
            </div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${acc.currency}</span>
          </div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">${acc.name}</p>
          <h3 class="text-2xl font-black text-slate-900 dark:text-white">${formatCurrency(acc.balance, acc.currency)}</h3>
          <div class="flex items-center justify-between mt-4">
            ${acc.last_four ? `<p class="text-[10px] text-slate-400 font-mono">•••• ${acc.last_four}</p>` : '<span></span>'}
            ${accountsGrid ? `<button class="text-[10px] font-bold text-primary-500 hover:underline">Edit Details</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    if (dashboardContainer) {
        dashboardContainer.innerHTML = html;
        if (window.gsap) gsap.from(dashboardContainer.children, { y: 20, opacity: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" });
    }
    if (accountsGrid) {
        accountsGrid.innerHTML = html;
        if (window.gsap) gsap.from(accountsGrid.children, { scale: 0.95, opacity: 0, duration: 0.4, stagger: 0.05, ease: "back.out(1.7)" });
    }
  }

  function getAccountIcon(type) {
    switch(type) {
      case 'bank': return '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>';
      case 'paypal': return '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v12z"/></svg>';
      default: return '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
    }
  }

  function renderBudgetProgress() {
    const container = document.getElementById('budget-progress');
    if (!container) return;

    const stats = state.stats || { income: 0, expenses: {} };
    const totalIncome = stats.income || 0;
    
    // Note: stats.income and stats.expenses are in EGP (system default)
    // We convert everything to display_currency
    const displayIncome = convert(totalIncome, 'EGP', state.display_currency);
    
    const needsLimit = displayIncome * 0.6;
    const wantsLimit = displayIncome * 0.2;
    const savingsLimit = displayIncome * 0.2;

    const needsSpent = convert(stats.expenses.need || 0, 'EGP', state.display_currency);
    const wantsSpent = convert(stats.expenses.want || 0, 'EGP', state.display_currency);
    const savingsSpent = convert(stats.expenses.saving || 0, 'EGP', state.display_currency);

    const remainingEGP = totalIncome - ((stats.expenses.need || 0) + (stats.expenses.want || 0) + (stats.expenses.saving || 0));
    
    const displayRemaining = state.show_secondary 
        ? convert(remainingEGP, 'EGP', state.user_settings.secondary_currency) 
        : convert(remainingEGP, 'EGP', state.display_currency);
        
    const displayCurrency = state.show_secondary ? state.user_settings.secondary_currency : state.display_currency;

    const types = [
        { label: 'Needs (60%)', limit: needsLimit, spent: needsSpent, color: 'bg-blue-500' },
        { label: 'Wants (20%)', limit: wantsLimit, spent: wantsSpent, color: 'bg-purple-500' },
        { label: 'Savings (20%)', limit: savingsLimit, spent: savingsSpent, color: 'bg-emerald-500' }
    ];

    container.innerHTML = types.map(type => {
        const percent = type.limit > 0 ? Math.min(100, (type.spent / type.limit) * 100) : 0;
        return `
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-bold text-slate-700 dark:text-slate-300">${type.label}</span>
              <span class="text-xs font-black text-slate-400">
                ${formatCurrency(type.spent, state.display_currency)} / ${formatCurrency(type.limit, state.display_currency)}
              </span>
            </div>
            <div class="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full ${type.color} rounded-full transition-all duration-1000" style="width: ${percent}%"></div>
            </div>
          </div>
        `;
    }).join('');

    const remEl = document.getElementById('remaining-budget');
    if (remEl) remEl.textContent = formatCurrency(displayRemaining, displayCurrency);
  }

  function renderLendSummary() {
    const oweMeEl = document.getElementById('lend-owe-me');
    const iOweEl = document.getElementById('lend-i-owe');
    if (!oweMeEl || !iOweEl) return;

    const lend = state.stats.lend || {};
    oweMeEl.textContent = formatCurrency(convert(lend.owe_me || 0, 'EGP', state.display_currency), state.display_currency);
    iOweEl.textContent = formatCurrency(convert(lend.i_owe || 0, 'EGP', state.display_currency), state.display_currency);
  }

  function renderRecentTransactions() {
    const dashboardContainer = document.getElementById('recent-transactions');
    const incomeContainer = document.getElementById('income-list');
    const expenseContainer = document.getElementById('expense-list');
    
    if (!dashboardContainer && !incomeContainer && !expenseContainer) return;

    const renderList = (transactions, container) => {
        if (transactions.length === 0) {
            container.innerHTML = '<p class="text-center py-8 text-slate-400">No entries found.</p>';
            return;
        }
        container.innerHTML = transactions.map(t => `
          <div class="transaction-item flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group">
            <div class="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm text-slate-500">
              ${getCategoryIcon(t.category_icon || 'circle')}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-slate-900 dark:text-white truncate">${t.description || t.category_name || 'Transaction'}</p>
              <p class="text-[10px] text-slate-400 uppercase tracking-widest">${t.account_name} • ${new Date(t.transaction_date).toLocaleDateString()}</p>
            </div>
            <div class="text-right flex flex-col items-end gap-1">
              <p class="text-sm font-black ${t.type === 'income' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}">
                ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, t.currency)}
              </p>
              <button onclick="MoneyApp.deleteTransaction(${t.id})" class="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-all">Delete</button>
            </div>
          </div>
        `).join('');

        if (window.gsap) gsap.from(container.querySelectorAll('.transaction-item'), { x: -10, opacity: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" });
    };

    if (dashboardContainer) renderList(state.transactions, dashboardContainer);
    if (incomeContainer) renderList(state.transactions.filter(t => t.type === 'income'), incomeContainer);
    if (expenseContainer) renderList(state.transactions.filter(t => t.type === 'expense'), expenseContainer);
  }

  function getCategoryIcon(name) {
    const icons = {
        'shield': '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        'heart': '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78v0z"/></svg>',
        'piggy-bank': '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1 .5-1.5 1-2V5z"/></svg>',
        'shopping-cart': '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
        'zap': '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        'dollar-sign': '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>'
    };
    return icons[name] || '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
  }

  function initEventListeners() {
    // Add transaction buttons
    document.getElementById('btn-save-income')?.addEventListener('click', () => handleSaveTransaction('income'));
    document.getElementById('btn-save-expense')?.addEventListener('click', () => handleSaveTransaction('expense'));
  }

  function populateSelects() {
    const accSelects = ['income-account', 'expense-account'];
    const catSelects = ['income-category', 'expense-category'];

    accSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = state.accounts.map(a => `<option value="${a.id}">${a.name} (${a.currency})</option>`).join('');
      }
    });

    catSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const type = id.startsWith('income') ? 'income' : '';
        const filtered = type ? state.categories.filter(c => c.type === type) : state.categories.filter(c => c.type !== 'income');
        el.innerHTML = filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    });
  }

  async function handleSaveTransaction(type) {
    const amount = document.getElementById(`${type}-amount`).value;
    const accountId = document.getElementById(`${type}-account`).value;
    const categoryId = document.getElementById(`${type}-category`).value;
    const description = document.getElementById(`${type}-desc`).value;

    if (!amount || amount <= 0) return alert('Please enter a valid amount');

    const res = await MoneyApp.addTransaction({
      type,
      amount,
      account_id: accountId,
      category_id: categoryId,
      description
    });

    if (res.success) {
      closeModal(`modal-${type}`);
      // Clear inputs
      document.getElementById(`${type}-amount`).value = '';
      document.getElementById(`${type}-desc`).value = '';
    } else {
      alert(res.message || 'Error saving transaction');
    }
  }

  return {
    init,
    updateCurrencySettings: async () => {
      const switcher = document.getElementById('currency-switcher');
      if (!switcher) return;
      const newPrimary = switcher.value;
      state.display_currency = newPrimary;
      state.user_settings.primary_currency = newPrimary;
      
      await api('update_settings', {
        primary_currency: state.user_settings.primary_currency,
        secondary_currency: state.user_settings.secondary_currency
      });
      renderDashboard();
    },
    saveGlobalSettings: async () => {
      const primary = document.getElementById('settings-primary-currency').value;
      const secondary = document.getElementById('settings-secondary-currency').value;
      
      state.user_settings.primary_currency = primary;
      state.user_settings.secondary_currency = secondary;
      state.display_currency = primary;
      
      const res = await api('update_settings', {
        primary_currency: primary,
        secondary_currency: secondary
      });
      
      if (res.success) {
        closeModal('modal-settings');
        // Update switcher if exists
        const switcher = document.getElementById('currency-switcher');
        if (switcher) switcher.value = primary;
        renderDashboard();
      }
    },
    toggleRemainingCurrency: () => {
      state.show_secondary = !state.show_secondary;
      renderBudgetProgress();
    },
    deleteTransaction: async (id) => {
      if (!confirm('Are you sure you want to delete this transaction? This will also revert the account balance.')) return;
      const res = await api('delete_transaction', { id });
      if (res.success) {
        await loadInitialData();
        renderDashboard();
      }
      return res;
    },
    addTransaction: async (data) => {
      const res = await api('add_transaction', data);
      if (res.success) {
        await loadInitialData();
        renderDashboard();
      }
      return res;
    }
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('money-app')) {
    MoneyApp.init();
  }
});
