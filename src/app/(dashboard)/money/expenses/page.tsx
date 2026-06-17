'use client';

import React, { useState } from 'react';
import { useMoney } from '@/context/MoneyContext';
import { Plus, X, Shield, Heart, PiggyBank, HelpCircle, ArrowLeft, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, Select, Modal, NumberInput } from '@/components/ui';

export default function ExpensesPage() {
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
    const categoryId = parseInt(categorySelect || (categories.filter(c => c.type !== 'income')[0]?.id.toString() || '0'));

    if (!accountId || !categoryId) {
      alert('Please fill out all fields');
      return;
    }

    const selectedAccount = accounts.find(a => a.id === accountId);
    const curr = selectedAccount ? selectedAccount.currency : 'EGP';

    const success = await addTransaction({
      type: 'expense',
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

  const expenses = transactions.filter(t => t.type === 'expense');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in duration-500">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Back button, title + subtitle, "Add Expense" button
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="unstyled"
            onClick={() => router.push('/money/dashboard')}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Expense Tracking</h1>
            <p className="text-xs text-slate-400">Manage your spending habits and check limits.</p>
          </div>
        </div>

        <Button
          onClick={() => {
            setAccountSelect(accounts[0] ? accounts[0].id.toString() : '');
            const filtered = categories.filter(c => c.type !== 'income');
            setCategorySelect(filtered[0] ? filtered[0].id.toString() : '');
            setIsOpen(true);
          }}
          variant="secondary"
          className="self-start text-xs font-bold"
        >
          <Plus className="w-4 h-4 stroke-[3] mr-2" />
          Add Expense
        </Button>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: EXPENSES LIST
          Contains: Empty state, per-transaction rows (category icon, description,
          account/date, amount, delete action)
          ────────────────────────────────────────────────────────── */}
      <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple">
        {expenses.length === 0 ? (
          <p className="text-center py-20 text-slate-400 italic text-sm">No expenses found.</p>
        ) : (
          <div className="space-y-3">
            {expenses.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 bg-slate-900/10 border border-slate-850/20 rounded-2xl group hover:border-slate-750 transition-all hover:shadow-apple-sm"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
                    {getCategoryIcon(t.category_icon)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {t.description || t.category_name || 'Expense'}
                    </p>
                    <span className="block text-[10px] text-slate-455 font-bold uppercase tracking-tight mt-0.5">
                      {t.account_name} • {new Date(t.transaction_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="text-right flex items-center gap-4 flex-shrink-0">
                  <p className="text-sm font-black text-white">
                    -{formatAmount(t.amount, t.currency)}
                  </p>
                  <Button variant="unstyled"
                    onClick={() => deleteTransaction(t.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ADD EXPENSE MODAL
          Contains: New-expense form (amount, account, category, date, description)
          ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add Expense"
        className="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
            <NumberInput
              size="lg"
              accent="primary"
              prefix="VAL"
              step={0.01}
              placeholder="0.00"
              value={amountInput}
              onChange={setAmountInput}
              required
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Date</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                required
                className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
              <input
                type="text"
                placeholder="e.g. Netflix, Rent"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none text-white"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full h-12 text-xs font-black"
          >
            Save Expense
          </Button>
        </form>
      </Modal>

    </div>
  );
}
