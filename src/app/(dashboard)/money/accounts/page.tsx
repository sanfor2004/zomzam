'use client';

import React, { useRef, useState } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useMoney } from '@/context/MoneyContext';
import { Plus, X, ArrowLeft, Trash2, Shield, Heart, PiggyBank, HelpCircle, Briefcase, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, Select, Modal, NumberInput } from '@/components/ui';

export default function BankAccountsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const {
    accounts,
    isLoading,
    addAccount,
    deleteAccount,
    formatAmount,
  } = useMoney();
  usePageEntrance(containerRef, [isLoading]);

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
    <div ref={containerRef} className="max-w-6xl mx-auto space-y-8">
      
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Back button, title + subtitle, "Add Account" button
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="unstyled"
            onClick={() => router.push('/money/dashboard')}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 data-entrance="title" className="text-2xl font-black text-white tracking-tight">Bank Accounts</h1>
            <p className="text-xs text-slate-400">Manage your connected wallets, cash reserves, and banks.</p>
          </div>
        </div>

        <Button
          onClick={() => setIsOpen(true)}
          variant="secondary"
          className="self-start text-xs font-bold"
        >
          <Plus className="w-4 h-4 stroke-[3] mr-2" />
          Add Account
        </Button>
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          DEVELOPMENT NAVIGATOR: ACCOUNTS GRID
          Contains: Per-account cards (icon, balance, type, last-4, delete action)
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            data-entrance="card"
            className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg transition-all group relative overflow-hidden flex flex-col justify-between min-h-[170px]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col justify-between h-full w-full">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-primary-950/20 flex items-center justify-center text-primary-500">
                  {getAccountIcon(acc.type)}
                </div>
                <Button variant="unstyled"
                  onClick={() => handleDelete(acc.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  title="Delete Account"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </Button>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mb-0.5">{acc.name}</p>
                <h3 className="text-xl font-black text-white tracking-tight">
                  {formatAmount(acc.balance, acc.currency)}
                </h3>
              </div>

              <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                <span>{acc.type}</span>
                {acc.last_four && <span className="font-mono">â€¢â€¢â€¢â€¢ {acc.last_four}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          DEVELOPMENT NAVIGATOR: ADD ACCOUNT MODAL
          Contains: New-account form (name, type, currency, balance, last-4)
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add Account"
        className="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Account Name</label>
            <input
              type="text"
              placeholder="e.g. Banque Misr VISA, Cash pocket"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              required
              className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none text-white font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Account Type</label>
              <Select
                value={typeSelect}
                onChange={(val) => setTypeSelect(val)}
                options={[
                  { value: 'bank', label: 'Bank / Card' },
                  { value: 'cash', label: 'Cash / Pocket' },
                  { value: 'paypal', label: 'PayPal' },
                  { value: 'wallet', label: 'Digital Wallet' },
                  { value: 'other', label: 'Other' },
                ]}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Currency</label>
              <Select
                value={currencySelect}
                onChange={(val) => setCurrencySelect(val)}
                options={[
                  { value: 'EGP', label: 'EGP (Egyptian Pound)' },
                  { value: 'USD', label: 'USD (US Dollar)' },
                  { value: 'EUR', label: 'EUR (Euro)' },
                  { value: 'GBP', label: 'GBP (British Pound)' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Initial Balance</label>
              <NumberInput
                step={0.01}
                placeholder="0.00"
                value={balanceInput}
                onChange={setBalanceInput}
                required
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
                className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none text-white font-mono"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full h-12 text-xs font-black"
          >
            Create Account
          </Button>
        </form>
      </Modal>

    </div>
  );
}
