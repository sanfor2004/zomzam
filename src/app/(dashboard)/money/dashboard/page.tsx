'use client';

import React, { useState } from 'react';
import { useMoney } from '@/context/MoneyContext';
import { useRouter } from 'next/navigation';
import { DollarSign, Settings, Plus, Minus, ArrowRight, X, TrendingUp, Shield, Heart, PiggyBank, Briefcase, ChevronRight, HelpCircle } from 'lucide-react';
import { Button, Select, Modal } from '@/components/ui';

export default function MoneyDashboardPage() {
  const router = useRouter();
  const {
    accounts,
    categories,
    transactions,
    stats,
    settings,
    displayCurrency,
    exchangeRate,
    isLoading,
    addTransaction,
    deleteTransaction,
    updateSettings,
    setDisplayCurrency,
    formatAmount,
  } = useMoney();

  // Modals state
  const [isIncomeOpen, setIsIncomeOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Form states
  const [amountInput, setAmountInput] = useState('');
  const [accountSelect, setAccountSelect] = useState('');
  const [categorySelect, setCategorySelect] = useState('');
  const [descInput, setDescInput] = useState('');
  const [dateInput, setDateInput] = useState(new Date().toISOString().substring(0, 10));

  const [settingsPrimary, setSettingsPrimary] = useState(settings.primary_currency);
  const [settingsSecondary, setSettingsSecondary] = useState(settings.secondary_currency);

  const [showSecondaryBudget, setShowSecondaryBudget] = useState(false);

  // Icon mapping helper
  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Briefcase className="w-5 h-5" />;
      case 'paypal': return <DollarSign className="w-5 h-5" />;
      default: return <DollarSign className="w-5 h-5" />;
    }
  };

  const getCategoryIcon = (iconName: string | null) => {
    switch (iconName) {
      case 'shield': return <Shield className="w-4 h-4" />;
      case 'heart': return <Heart className="w-4 h-4" />;
      case 'piggy-bank': return <PiggyBank className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  // Submit quick transaction
  const handleSaveTransaction = async (type: 'income' | 'expense') => {
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const accountId = parseInt(accountSelect || (accounts[0] ? accounts[0].id.toString() : '0'));
    const categoryId = categorySelect ? parseInt(categorySelect) : null;

    if (!accountId) {
      alert('Please select a valid account');
      return;
    }

    const selectedAccount = accounts.find(a => a.id === accountId);
    const curr = selectedAccount ? selectedAccount.currency : 'EGP';

    const success = await addTransaction({
      type,
      amount: amt,
      account_id: accountId,
      category_id: categoryId,
      description: descInput,
      date: dateInput,
      currency: curr,
    });

    if (success) {
      // Clear forms and close
      setAmountInput('');
      setDescInput('');
      setCategorySelect('');
      setAccountSelect('');
      setIsIncomeOpen(false);
      setIsExpenseOpen(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    const success = await updateSettings(settingsPrimary, settingsSecondary);
    if (success) {
      setIsSettingsOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Budget calculations
  const totalIncome = stats.income || 0;
  const displayIncome = totalIncome; // in EGP
  
  const needsLimit = displayIncome * 0.6;
  const wantsLimit = displayIncome * 0.2;
  const savingsLimit = displayIncome * 0.2;

  const needsSpent = stats.expenses.need || 0;
  const wantsSpent = stats.expenses.want || 0;
  const savingsSpent = stats.expenses.saving || 0;

  const remainingEGP = totalIncome - (needsSpent + wantsSpent + savingsSpent);

  const budgetItems = [
    { label: 'Needs (60%)', limit: needsLimit, spent: needsSpent, color: 'bg-blue-500' },
    { label: 'Wants (20%)', limit: wantsLimit, spent: wantsSpent, color: 'bg-purple-500' },
    { label: 'Savings (20%)', limit: savingsLimit, spent: savingsSpent, color: 'bg-emerald-500' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Financial Overview</h1>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            <span>Tracking your 60/20/20 rule progress.</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold uppercase tracking-wider text-[9px]">Display:</span>
              <Select
                value={displayCurrency}
                onChange={(val) => setDisplayCurrency(val)}
                options={['EGP', 'USD', 'EUR', 'GBP']}
                className="w-24"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setSettingsPrimary(settings.primary_currency);
              setSettingsSecondary(settings.secondary_currency);
              setIsSettingsOpen(true);
            }}
            variant="outline"
            size="icon"
            title="Money Settings"
            className="rounded-2xl"
          >
            <Settings className="w-5 h-5" />
          </Button>

          <Button
            onClick={() => {
              setAccountSelect(accounts[0] ? accounts[0].id.toString() : '');
              const filtered = categories.filter(c => c.type === 'income');
              setCategorySelect(filtered[0] ? filtered[0].id.toString() : '');
              setIsIncomeOpen(true);
            }}
            variant="success"
            className="text-xs font-bold h-11"
          >
            <Plus className="w-4 h-4 stroke-[3] mr-2" />
            Income
          </Button>

          <Button
            onClick={() => {
              setAccountSelect(accounts[0] ? accounts[0].id.toString() : '');
              const filtered = categories.filter(c => c.type !== 'income');
              setCategorySelect(filtered[0] ? filtered[0].id.toString() : '');
              setIsExpenseOpen(true);
            }}
            variant="secondary"
            className="text-xs font-bold h-11"
          >
            <Minus className="w-4 h-4 stroke-[3] mr-2" />
            Expense
          </Button>
        </div>
      </div>

      {/* Account Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-white dark:bg-[#1A1D24] rounded-3xl p-6 border border-slate-100 dark:border-slate-800/60 shadow-apple hover:shadow-apple-lg transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors pointer-events-none"></div>
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/20 flex items-center justify-center text-primary-500">
                    {getAccountIcon(acc.type)}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{acc.currency}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{acc.name}</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {formatAmount(acc.balance, acc.currency)}
                </h3>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                {acc.last_four ? (
                  <p className="text-[9px] text-slate-400 font-mono tracking-wider">•••• {acc.last_four}</p>
                ) : (
                  <span />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Budget Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Budget Allocation Progress bars */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple">
            <h2 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6">Budget Allocation</h2>
            
            <div className="space-y-6">
              {budgetItems.map((item) => {
                const percent = item.limit > 0 ? Math.min(100, (item.spent / item.limit) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-350">{item.label}</span>
                      <span className="text-[10px] font-black text-slate-400">
                        {formatAmount(item.spent)} / {formatAmount(item.limit)}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-full overflow-hidden border border-slate-100 dark:border-slate-850">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-850 flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Remaining Monthly Budget</span>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {formatAmount(showSecondaryBudget ? convertEGP(remainingEGP, settings.secondary_currency) : remainingEGP, showSecondaryBudget ? settings.secondary_currency : 'EGP')}
                </p>
                <button
                  onClick={() => setShowSecondaryBudget(!showSecondaryBudget)}
                  className="p-1 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-slate-400 hover:text-primary-500 transition-colors"
                  title="Toggle Display Currency"
                >
                  <ArrowRight className="w-4 h-4 rotate-45" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Tip Card */}
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl p-6 text-white shadow-lg shadow-primary-500/10">
            <TrendingUp className="w-8 h-8 mb-4 opacity-70" />
            <h3 className="text-base font-bold mb-1">Financial Mastery</h3>
            <p className="text-xs text-primary-50 opacity-90 leading-relaxed">
              Enforce the 60/20/20 rule: 60% for living needs, 20% for fun wants, and 20% dedicated strictly for savings and investment. Treat savings like a bill you MUST pay first.
            </p>
          </div>

          {/* Debts Summary */}
          <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-4">Lending Summary</h3>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-650 dark:text-slate-450">People Owe Me</span>
                <span className="text-xs font-black text-emerald-500">{formatAmount(stats.lend.owe_me || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-650 dark:text-slate-450">I Owe People</span>
                <span className="text-xs font-black text-rose-500">{formatAmount(stats.lend.i_owe || 0)}</span>
              </div>
              <button
                onClick={() => router.push('/money/lend')}
                className="w-full h-9 bg-slate-50 dark:bg-slate-900/30 text-[9px] font-black uppercase text-slate-450 tracking-widest hover:text-primary-500 hover:bg-slate-100/50 dark:hover:bg-slate-850 rounded-xl transition-all border border-slate-100 dark:border-slate-850 flex items-center justify-center gap-1.5"
              >
                Manage All
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Recent Transactions List (Right Columns) */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                <h2 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Recent Transactions
                </h2>
                <button
                  onClick={() => router.push('/money/expenses')}
                  className="text-xs font-bold text-primary-500 hover:text-primary-600 transition-colors"
                >
                  View Expenses
                </button>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {transactions.length === 0 ? (
                  <p className="text-center py-16 text-slate-400 italic text-xs">No entries found.</p>
                ) : (
                  transactions.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100/30 dark:border-slate-850/20 rounded-2xl group hover:border-slate-200 dark:hover:border-slate-750 transition-all hover:shadow-apple-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-450">
                          {getCategoryIcon(t.category_icon)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {t.description || t.category_name || 'Transaction'}
                          </p>
                          <span className="block text-[9px] text-slate-400 font-semibold uppercase tracking-tight">
                            {t.account_name} • {new Date(t.transaction_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-0.5">
                        <p className={`text-xs font-black ${t.type === 'income' ? 'text-emerald-500' : 'text-slate-850 dark:text-white'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatAmount(t.amount, t.currency)}
                        </p>
                        <button
                          onClick={() => deleteTransaction(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-[9px] font-black uppercase text-rose-500 hover:underline transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-150/40 dark:border-slate-850 flex items-center gap-3">
              <button
                onClick={() => router.push('/money/expenses')}
                className="flex-1 h-10 bg-slate-50 dark:bg-slate-900/30 text-xs font-bold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-150/50 dark:border-slate-850 rounded-xl transition-all uppercase tracking-wider"
              >
                Expenses
              </button>
              <button
                onClick={() => router.push('/money/income')}
                className="flex-1 h-10 bg-slate-50 dark:bg-slate-900/30 text-xs font-bold text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-150/50 dark:border-slate-850 rounded-xl transition-all uppercase tracking-wider"
              >
                Income
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
      >
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Primary Currency</label>
            <Select
              value={settingsPrimary}
              onChange={(val) => setSettingsPrimary(val)}
              options={[
                { value: 'EGP', label: 'EGP (Egyptian Pound)' },
                { value: 'USD', label: 'USD (US Dollar)' },
                { value: 'EUR', label: 'EUR (Euro)' },
                { value: 'GBP', label: 'GBP (British Pound)' },
              ]}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Secondary Currency</label>
            <Select
              value={settingsSecondary}
              onChange={(val) => setSettingsSecondary(val)}
              options={[
                { value: 'EGP', label: 'EGP (Egyptian Pound)' },
                { value: 'USD', label: 'USD (US Dollar)' },
                { value: 'EUR', label: 'EUR (Euro)' },
                { value: 'GBP', label: 'GBP (British Pound)' },
              ]}
            />
            <p className="text-[9px] text-slate-400 mt-2 font-semibold">Used for quick conversion and alternative displays.</p>
          </div>

          <Button
            onClick={handleSaveSettings}
            variant="primary"
            className="w-full h-12 text-xs font-black"
          >
            Save Changes
          </Button>
        </div>
      </Modal>

      {/* Quick Income Modal */}
      <Modal
        isOpen={isIncomeOpen}
        onClose={() => setIsIncomeOpen(false)}
        title="Add Income"
        className="max-w-lg"
      >
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">EGP</span>
              <input
                type="number"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full pl-14 pr-4 h-12 bg-slate-55 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-2xl text-xl font-black focus:outline-none focus:border-emerald-500 transition-all text-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Account</label>
              <Select
                value={accountSelect}
                onChange={(val) => setAccountSelect(val)}
                options={accounts.map(a => ({
                  value: a.id.toString(),
                  label: `${a.name} (${a.currency})`,
                }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
              <Select
                value={categorySelect}
                onChange={(val) => setCategorySelect(val)}
                options={categories.filter(c => c.type === 'income').map(c => ({
                  value: c.id.toString(),
                  label: c.name,
                }))}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
            <input
              type="text"
              placeholder="e.g. Salary, Bonus"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-white"
            />
          </div>

          <Button
            onClick={() => handleSaveTransaction('income')}
            variant="success"
            className="w-full h-12 text-xs font-black"
          >
            Save Income
          </Button>
        </div>
      </Modal>

      {/* Quick Expense Modal */}
      <Modal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        title="Add Expense"
        className="max-w-lg"
      >
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">EGP</span>
              <input
                type="number"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full pl-14 pr-4 h-12 bg-slate-55 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-2xl text-xl font-black focus:outline-none focus:border-primary-500 transition-all text-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Account</label>
              <Select
                value={accountSelect}
                onChange={(val) => setAccountSelect(val)}
                options={accounts.map(a => ({
                  value: a.id.toString(),
                  label: `${a.name} (${a.currency})`,
                }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
              <Select
                value={categorySelect}
                onChange={(val) => setCategorySelect(val)}
                options={categories.filter(c => c.type !== 'income').map(c => ({
                  value: c.id.toString(),
                  label: c.name,
                }))}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
            <input
              type="text"
              placeholder="e.g. Groceries, Netflix"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-white"
            />
          </div>

          <Button
            onClick={() => handleSaveTransaction('expense')}
            variant="secondary"
            className="w-full h-12 text-xs font-black"
          >
            Save Expense
          </Button>
        </div>
      </Modal>

    </div>
  );
}

// Quick helper to convert EGP to USD
function convertEGP(amount: number, toCurrency: string) {
  const exchangeRate = 48.5;
  if (toCurrency === 'USD') return amount / exchangeRate;
  return amount;
}
