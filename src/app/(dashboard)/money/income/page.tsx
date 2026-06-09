'use client';

import React, { useState } from 'react';
import { useMoney } from '@/context/MoneyContext';
import { Plus, X, ArrowLeft, Trash2, Shield, Heart, PiggyBank, HelpCircle, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function IncomePage() {
  const router = useRouter();
  const {
    accounts,
    categories,
    transactions,
    isLoading,
    addTransaction,
    deleteTransaction,
    formatAmount,
  } = useMoney();

  const [isOpen, setIsOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [accountSelect, setAccountSelect] = useState('');
  const [categorySelect, setCategorySelect] = useState('');
  const [descInput, setDescInput] = useState('');
  const [dateInput, setDateInput] = useState(new Date().toISOString().substring(0, 10));

  const getCategoryIcon = (iconName: string | null) => {
    switch (iconName) {
      case 'shield': return <Shield className="w-4 h-4" />;
      case 'heart': return <Heart className="w-4 h-4" />;
      case 'piggy-bank': return <PiggyBank className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const accountId = parseInt(accountSelect || (accounts[0] ? accounts[0].id.toString() : '0'));
    const categoryId = parseInt(categorySelect || (categories.filter(c => c.type === 'income')[0]?.id.toString() || '0'));

    if (!accountId || !categoryId) {
      alert('Please fill out all fields');
      return;
    }

    const selectedAccount = accounts.find(a => a.id === accountId);
    const curr = selectedAccount ? selectedAccount.currency : 'EGP';

    const success = await addTransaction({
      type: 'income',
      amount: amt,
      account_id: accountId,
      category_id: categoryId,
      description: descInput,
      date: dateInput,
      currency: curr,
    });

    if (success) {
      setAmountInput('');
      setDescInput('');
      setIsOpen(false);
    }
  };

  const incomes = transactions.filter(t => t.type === 'income');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/money/dashboard')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-slate-800 dark:hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Income Tracking</h1>
            <p className="text-xs text-slate-400">Manage your salary, bonuses, and earnings.</p>
          </div>
        </div>

        <button
          onClick={() => {
            setAccountSelect(accounts[0] ? accounts[0].id.toString() : '');
            const filtered = categories.filter(c => c.type === 'income');
            setCategorySelect(filtered[0] ? filtered[0].id.toString() : '');
            setIsOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-md shadow-emerald-500/10 active:scale-95 text-xs uppercase tracking-wider self-start"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Add Income
        </button>
      </div>

      {/* Income List */}
      <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple">
        {incomes.length === 0 ? (
          <p className="text-center py-20 text-slate-400 italic text-sm">No income transactions found.</p>
        ) : (
          <div className="space-y-3">
            {incomes.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100/30 dark:border-slate-850/20 rounded-2xl group hover:border-slate-200 dark:hover:border-slate-750 transition-all hover:shadow-apple-sm"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-850 border border-slate-100/80 dark:border-slate-800 flex items-center justify-center text-slate-450">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {t.description || t.category_name || 'Income'}
                    </p>
                    <span className="block text-[10px] text-slate-450 font-bold uppercase tracking-tight mt-0.5">
                      {t.account_name} • {new Date(t.transaction_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="text-right flex items-center gap-4 flex-shrink-0">
                  <p className="text-sm font-black text-emerald-500">
                    +{formatAmount(t.amount, t.currency)}
                  </p>
                  <button
                    onClick={() => deleteTransaction(t.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in">
          <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-glass overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-150/40 dark:border-slate-850">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Add Income</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">VAL</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      required
                      className="w-full pl-14 pr-4 h-12 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-2xl text-xl font-black focus:outline-none focus:border-emerald-500 transition-all text-slate-850 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Account</label>
                    <select
                      value={accountSelect}
                      onChange={(e) => setAccountSelect(e.target.value)}
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white"
                    >
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
                    <select
                      value={categorySelect}
                      onChange={(e) => setCategorySelect(e.target.value)}
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white"
                    >
                      {categories.filter(c => c.type === 'income').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Date</label>
                    <input
                      type="date"
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      required
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Salary, Bonus"
                      value={descInput}
                      onChange={(e) => setDescInput(e.target.value)}
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-xs uppercase tracking-wider"
                >
                  Save Income
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
