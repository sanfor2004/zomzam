'use client';

import React, { useRef, useState } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useMoney } from '@/context/MoneyContext';
import { Plus, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, Select, Modal, NumberInput } from '@/components/ui';
import { AccountCard } from '@/components/money/AccountCard';

export default function BankAccountsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const {
    accounts,
    isLoading,
    addAccount,
    deleteAccount,
  } = useMoney();
  usePageEntrance(containerRef, [isLoading]);

  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [typeSelect, setTypeSelect] = useState<'bank' | 'cash' | 'paypal' | 'wallet' | 'other' | 'credit_card'>('bank');
  const [currencySelect, setCurrencySelect] = useState<'EGP' | 'USD' | 'EUR' | 'GBP'>('EGP');
  const [balanceInput, setBalanceInput] = useState('0.00');
  const [lastFourInput, setLastFourInput] = useState('');
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [statementDayInput, setStatementDayInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');

  const isCreditCard = typeSelect === 'credit_card';

  const resetForm = () => {
    setNameInput('');
    setBalanceInput('0.00');
    setLastFourInput('');
    setCreditLimitInput('');
    setStatementDayInput('');
    setDueDayInput('');
    setTypeSelect('bank');
    setCurrencySelect('EGP');
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
    const lastFourVal = /^\d{4}$/.test(cleanLastFour) ? cleanLastFour : null;

    const success = await addAccount({
      name: nameInput,
      type: typeSelect,
      currency: currencySelect,
      balance: initialBal,
      last_four: lastFourVal,
      credit_limit: isCreditCard && creditLimitInput ? parseFloat(creditLimitInput) : null,
      statement_day: isCreditCard && statementDayInput ? parseInt(statementDayInput, 10) : null,
      due_day: isCreditCard && dueDayInput ? parseInt(dueDayInput, 10) : null,
    });

    if (success) {
      resetForm();
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
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Back button, title + subtitle, "Add Account" button
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col @xl:flex-row @xl:items-center justify-between gap-4">
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ACCOUNTS GRID
          Contains: Per-account cards (AccountCard — base + credit-card
          cycle variant with owed/limit, utilization, due-date nudge)
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <AccountCard key={acc.id} account={acc} onDelete={handleDelete} />
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ADD ACCOUNT MODAL
          Contains: New-account form (name, type, currency, balance, last-4,
          and — when type is credit card — limit/statement/due-day fields
          + a card-safety banner)
          ────────────────────────────────────────────────────────── */}
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
                  { value: 'credit_card', label: 'Credit Card' },
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

          {isCreditCard && (
            <div className="space-y-4">
              {/* Card safety is structural (spec §8): only nickname, last-4,
                  limit, and cycle days are ever collected — never a full
                  PAN/CVV/PIN/expiry input. */}
              <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-300 bg-slate-900/40 border border-slate-800/60 rounded-xl px-4 py-3">
                🔒 We never store your card number — only a nickname, last-4, and limit.
              </p>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Credit Limit</label>
                <NumberInput
                  step={0.01}
                  min={0}
                  placeholder="0.00"
                  value={creditLimitInput}
                  onChange={setCreditLimitInput}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Statement Day</label>
                  <NumberInput
                    min={1}
                    max={28}
                    step={1}
                    placeholder="1–28"
                    value={statementDayInput}
                    onChange={setStatementDayInput}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Due Day</label>
                  <NumberInput
                    min={1}
                    max={28}
                    step={1}
                    placeholder="1–28"
                    value={dueDayInput}
                    onChange={setDueDayInput}
                  />
                </div>
              </div>
            </div>
          )}

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
