'use client';

import React, { useRef, useState } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useMoney } from '@/context/MoneyContext';
import { useRouter } from 'next/navigation';
import { DollarSign, Settings, Plus, Minus, ArrowRight, X, TrendingUp, Shield, Heart, PiggyBank, Briefcase, ChevronRight, HelpCircle } from 'lucide-react';
import { Button, Select, Modal, NumberInput } from '@/components/ui';

export default function MoneyDashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
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
  usePageEntrance(containerRef, [isLoading]);

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

  // Donut chart logic: if all categories are 0 spent, make them equal size (33.33% each)
  const totalSpent = needsSpent + wantsSpent + savingsSpent;
  let needsPercent = 60;
  let wantsPercent = 20;
  let savingsPercent = 20;

  if (totalSpent === 0) {
    needsPercent = 33.333;
    wantsPercent = 33.333;
    savingsPercent = 33.333;
  } else {
    needsPercent = (needsSpent / totalSpent) * 100;
    wantsPercent = (wantsSpent / totalSpent) * 100;
    savingsPercent = (savingsSpent / totalSpent) * 100;
  }

  const wantsAngle = (needsPercent / 100) * 360;
  const savingsAngle = ((needsPercent + wantsPercent) / 100) * 360;

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto space-y-8">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Title + display-currency selector, Settings / Income / Expense buttons
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-entrance="title" className="text-2xl font-black text-white tracking-tight">Financial Overview</h1>
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ACCOUNT BALANCES GRID
          Contains: Per-account balance cards (icon, currency, name, last-4)
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            data-entrance="card"
            className="bg-[#1A1D24] rounded-3xl p-6 border border-slate-800/60 shadow-apple hover:shadow-apple-lg transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors pointer-events-none"></div>
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-primary-950/20 flex items-center justify-center text-primary-500">
                    {getAccountIcon(acc.type)}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{acc.currency}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{acc.name}</p>
                <h3 className="text-2xl font-black text-white tracking-tight">
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

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: LEFT COLUMN — BUDGET, TIP, LENDING
            Contains: 60/20/20 budget allocation donut + legend, financial-mastery
            tip card, lending summary card
            ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[340px]">
            <h2 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-4">Budget Allocation</h2>

            {/* SVG Donut Chart */}
            <div className="relative flex items-center justify-center h-44">
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 160 160">
                <defs>
                  {/* Diagonal striped pattern for Needs */}
                  <pattern id="stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#EE5712" strokeWidth="2.5" />
                  </pattern>
                </defs>
                {/* Background Ring */}
                <circle 
                  cx="80" 
                  cy="80" 
                  r="62" 
                  stroke="rgba(226, 232, 240, 0.2)" 
                  strokeWidth="18" 
                  fill="transparent" 
                />
                
                {/* Needs Segment - Striped Pattern */}
                <circle 
                  cx="80" 
                  cy="80" 
                  r="62" 
                  stroke="url(#stripes)" 
                  strokeWidth="18" 
                  fill="transparent" 
                  strokeDasharray="390" 
                  strokeDashoffset={390 - (390 * needsPercent) / 100}
                  strokeLinecap="round"
                />
                
                {/* Wants Segment - Solid Green */}
                <circle 
                  cx="80" 
                  cy="80" 
                  r="62" 
                  stroke="#10b981" 
                  strokeWidth="18" 
                  fill="transparent" 
                  strokeDasharray="390" 
                  strokeDashoffset={390 - (390 * wantsPercent) / 100}
                  transform={`rotate(${wantsAngle} 80 80)`}
                  strokeLinecap="round"
                />

                {/* Savings Segment - Solid Yellow */}
                <circle 
                  cx="80" 
                  cy="80" 
                  r="62" 
                  stroke="#f59e0b" 
                  strokeWidth="18" 
                  fill="transparent" 
                  strokeDasharray="390" 
                  strokeDashoffset={390 - (390 * savingsPercent) / 100}
                  transform={`rotate(${savingsAngle} 80 80)`}
                  strokeLinecap="round"
                />
              </svg>

              {/* Center Content: Remaining Monthly Budget */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="text-lg font-black text-white font-mono leading-none truncate max-w-[130px]">
                  {formatAmount(showSecondaryBudget ? convertEGP(remainingEGP, settings.secondary_currency) : remainingEGP, showSecondaryBudget ? settings.secondary_currency : 'EGP')}
                </span>
                <span className="text-[8px] font-bold text-slate-450 uppercase tracking-tight mt-1">Remaining Budget</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold border-t border-slate-850 pt-3 mt-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded border border-[#EE5712]/40 flex-shrink-0" style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, #EE5712, #EE5712 1.5px, transparent 1.5px, transparent 4px)',
                }} />
                <span>Needs (60%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] flex-shrink-0" />
                <span>Wants (20%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span>Savings (20%)</span>
              </div>
            </div>
          </div>

          {/* Quick Tip Card */}
          <div data-entrance="card" className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl p-6 text-white shadow-lg shadow-primary-500/10">
            <TrendingUp className="w-8 h-8 mb-4 opacity-70" />
            <h3 className="text-base font-bold mb-1">Financial Mastery</h3>
            <p className="text-xs text-primary-50 opacity-90 leading-relaxed">
              Enforce the 60/20/20 rule: 60% for living needs, 20% for fun wants, and 20% dedicated strictly for savings and investment. Treat savings like a bill you MUST pay first.
            </p>
          </div>

          {/* Debts Summary */}
          <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-4">Lending Summary</h3>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-450">People Owe Me</span>
                <span className="text-xs font-black text-emerald-500">{formatAmount(stats.lend.owe_me || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-450">I Owe People</span>
                <span className="text-xs font-black text-rose-500">{formatAmount(stats.lend.i_owe || 0)}</span>
              </div>
              <Button variant="unstyled"
                onClick={() => router.push('/money/lend')}
                className="w-full h-9 bg-slate-900/30 text-[9px] font-black uppercase text-slate-450 tracking-widest hover:text-primary-500 hover:bg-slate-850 rounded-xl transition-all border border-slate-850 flex items-center justify-center gap-1.5"
              >
                Manage All
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: RIGHT COLUMN — RECENT TRANSACTIONS
            Contains: Transaction list (empty state, per-entry rows with delete),
            Expenses / Income footer nav buttons
            ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-850">
                <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
                  Recent Transactions
                </h2>
                <Button variant="unstyled"
                  onClick={() => router.push('/money/expenses')}
                  className="text-xs font-bold text-primary-500 hover:text-primary-600 transition-colors"
                >
                  View Expenses
                </Button>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {transactions.length === 0 ? (
                  <p className="text-center py-16 text-slate-400 italic text-xs">No entries found.</p>
                ) : (
                  transactions.map((t) => (
                    <div
                      key={t.id}
                      data-entrance="list-item"
                      className="flex items-center justify-between p-3 bg-slate-900/10 border border-slate-850/20 rounded-2xl group hover:border-slate-750 transition-all hover:shadow-apple-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-450">
                          {getCategoryIcon(t.category_icon)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {t.description || t.category_name || 'Transaction'}
                          </p>
                          <span className="block text-[9px] text-slate-400 font-semibold uppercase tracking-tight">
                            {t.account_name} • {new Date(t.transaction_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-0.5">
                        <p className={`text-xs font-black${t.type === 'income' ? 'text-emerald-500' : 'text-white'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatAmount(t.amount, t.currency)}
                        </p>
                        <Button variant="unstyled"
                          onClick={() => deleteTransaction(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-[9px] font-black uppercase text-rose-500 hover:underline transition-all"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-850 flex items-center gap-3">
              <Button variant="unstyled"
                onClick={() => router.push('/money/expenses')}
                className="flex-1 h-10 bg-slate-900/30 text-xs font-bold text-slate-350 hover:bg-slate-800 border border-slate-850 rounded-xl transition-all uppercase tracking-wider"
              >
                Expenses
              </Button>
              <Button variant="unstyled"
                onClick={() => router.push('/money/income')}
                className="flex-1 h-10 bg-slate-900/30 text-xs font-bold text-slate-350 hover:bg-slate-800 border border-slate-850 rounded-xl transition-all uppercase tracking-wider"
              >
                Income
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: SETTINGS MODAL
          Contains: Primary / secondary currency selectors
          ────────────────────────────────────────────────────────── */}
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: QUICK INCOME MODAL
          Contains: Quick-add income form (amount, account, category, description)
          ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isIncomeOpen}
        onClose={() => setIsIncomeOpen(false)}
        title="Add Income"
        className="max-w-lg"
      >
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
            <NumberInput
              size="lg"
              accent="emerald"
              prefix="EGP"
              step={0.01}
              placeholder="0.00"
              value={amountInput}
              onChange={setAmountInput}
            />
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
              className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none text-white"
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: QUICK EXPENSE MODAL
          Contains: Quick-add expense form (amount, account, category, description)
          ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        title="Add Expense"
        className="max-w-lg"
      >
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
            <NumberInput
              size="lg"
              accent="primary"
              prefix="EGP"
              step={0.01}
              placeholder="0.00"
              value={amountInput}
              onChange={setAmountInput}
            />
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
              className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none text-white"
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
