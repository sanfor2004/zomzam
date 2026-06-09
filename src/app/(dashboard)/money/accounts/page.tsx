'use client';

import React, { useState } from 'react';
import { useMoney } from '@/context/MoneyContext';
import { Plus, X, ArrowLeft, Trash2, Shield, Heart, PiggyBank, HelpCircle, Briefcase, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BankAccountsPage() {
  const router = useRouter();
  const {
    accounts,
    isLoading,
    addAccount,
    deleteAccount,
    formatAmount,
  } = useMoney();

  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [typeSelect, setTypeSelect] = useState<'bank' | 'cash' | 'paypal' | 'wallet' | 'other'>('bank');
  const [currencySelect, setCurrencySelect] = useState<'EGP' | 'USD' | 'EUR' | 'GBP'>('EGP');
  const [balanceInput, setBalanceInput] = useState('0.00');
  const [lastFourInput, setLastFourInput] = useState('');

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Briefcase className="w-5 h-5" />;
      case 'paypal': return <DollarSign className="w-5 h-5" />;
      default: return <DollarSign className="w-5 h-5" />;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      alert('Please enter a name');
      return;
    }

    const initialBal = parseFloat(balanceInput);
    if (isNaN(initialBal)) {
      alert('Please enter a valid balance');
      return;
    }

    const cleanLastFour = lastFourInput.trim();
    const lastFourVal = cleanLastFour.length === 4 && !isNaN(parseInt(cleanLastFour)) ? cleanLastFour : null;

    const success = await addAccount({
      name: nameInput,
      type: typeSelect,
      currency: currencySelect,
      balance: initialBal,
      last_four: lastFourVal,
    });

    if (success) {
      setNameInput('');
      setBalanceInput('0.00');
      setLastFourInput('');
      setTypeSelect('bank');
      setCurrencySelect('EGP');
      setIsOpen(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this bank account? This will permanently erase the account balance history.')) return;
    await deleteAccount(id);
  };

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
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Bank Accounts</h1>
            <p className="text-xs text-slate-400">Manage your connected wallets, cash reserves, and banks.</p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-850 dark:bg-white dark:hover:bg-slate-50 text-white dark:text-slate-900 font-bold rounded-2xl transition-all shadow-md active:scale-95 text-xs uppercase tracking-wider self-start"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Add Account
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg transition-all group relative overflow-hidden flex flex-col justify-between min-h-[170px]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col justify-between h-full w-full">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/20 flex items-center justify-center text-primary-500">
                  {getAccountIcon(acc.type)}
                </div>
                <button
                  onClick={() => handleDelete(acc.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  title="Delete Account"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mb-0.5">{acc.name}</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {formatAmount(acc.balance, acc.currency)}
                </h3>
              </div>

              <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                <span>{acc.type}</span>
                {acc.last_four && <span className="font-mono">•••• {acc.last_four}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in">
          <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-glass overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-150/40 dark:border-slate-850">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Add Account</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Account Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Banque Misr VISA, Cash pocket"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    required
                    className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Account Type</label>
                    <select
                      value={typeSelect}
                      onChange={(e) => setTypeSelect(e.target.value as any)}
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white font-bold"
                    >
                      <option value="bank">Bank / Card</option>
                      <option value="cash">Cash / Pocket</option>
                      <option value="paypal">PayPal</option>
                      <option value="wallet">Digital Wallet</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Currency</label>
                    <select
                      value={currencySelect}
                      onChange={(e) => setCurrencySelect(e.target.value as any)}
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white font-bold"
                    >
                      <option value="EGP">EGP (Egyptian Pound)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="GBP">GBP (British Pound)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Initial Balance</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={balanceInput}
                      onChange={(e) => setBalanceInput(e.target.value)}
                      required
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Last 4 Digits (Optional)</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="e.g. 4193"
                      value={lastFourInput}
                      onChange={(e) => setLastFourInput(e.target.value)}
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none text-slate-855 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-slate-900 hover:bg-slate-850 dark:bg-white dark:hover:bg-slate-50 text-white dark:text-slate-900 font-black rounded-2xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-wider"
                >
                  Create Account
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
