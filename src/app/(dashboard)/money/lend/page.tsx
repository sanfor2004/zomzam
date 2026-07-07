'use client';

import React, { useRef, useState } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useMoney } from '@/context/MoneyContext';
import { Plus, X, ArrowLeft, Trash2, CheckCircle2, User, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { Button, Select, Modal, NumberInput } from '@/components/ui';

export default function LendingDebtPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const {
    lendList,
    isLoading,
    addLend,
    settleLend,
    deleteLend,
    formatAmount,
  } = useMoney();
  usePageEntrance(containerRef, [isLoading]);

  const [isOpen, setIsOpen] = useState(false);
  const [personInput, setPersonInput] = useState('');
  const [typeSelect, setTypeSelect] = useState<'owe_me' | 'i_owe'>('owe_me');
  const [amountInput, setAmountInput] = useState('');
  const [currencySelect, setCurrencySelect] = useState<'EGP' | 'USD' | 'EUR' | 'GBP'>('EGP');
  const [dueDateInput, setDueDateInput] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personInput.trim()) {
      alert('Please enter a name');
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const success = await addLend({
      person_name: personInput,
      type: typeSelect,
      amount: amt,
      currency: currencySelect,
      due_date: dueDateInput || null,
    });

    if (success) {
      setPersonInput('');
      setAmountInput('');
      setDueDateInput('');
      setTypeSelect('owe_me');
      setCurrencySelect('EGP');
      setIsOpen(false);
    }
  };

  const handleSettle = async (id: number) => {
    const success = await settleLend(id);
    if (success) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10B981', '#6EE7B7', '#ffffff']
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    await deleteLend(id);
  };

  // Filter list
  const activeOweMe = lendList.filter((item) => item.type === 'owe_me' && item.status !== 'settled');
  const activeIOwe = lendList.filter((item) => item.type === 'i_owe' && item.status !== 'settled');
  const settledList = lendList.filter((item) => item.status === 'settled');

  // Sum active totals (using standard formatAmount displayCurrency)
  // To avoid incorrect currency summing, let's convert everything to EGP or USD. We can use a basic EGP sum and format it
  const sumTotal = (list: typeof lendList) => {
    const exchangeRate = 48.5;
    let sumEGP = 0;
    list.forEach(item => {
      const amt = parseFloat(item.amount);
      if (item.currency === 'USD') sumEGP += amt * exchangeRate;
      else sumEGP += amt;
    });
    return formatAmount(sumEGP, 'EGP');
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
          Contains: Back button, title + subtitle, "Add Entry" button
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
            <h1 data-entrance="title" className="text-2xl font-black text-white tracking-tight">Lending & Debt</h1>
            <p className="text-xs text-slate-400">Track money you owe others or are owed by others.</p>
          </div>
        </div>

        <Button
          onClick={() => setIsOpen(true)}
          variant="secondary"
          className="self-start text-xs font-bold"
        >
          <Plus className="w-4 h-4 stroke-[3] mr-2" />
          Add Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-8">
        
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: "PEOPLE OWE ME" CARD
            Contains: Total receivable badge, active owe-me entries with
            settle/delete actions
            ────────────────────────────────────────────────────────── */}
        <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-850">
              <h2 className="text-sm font-black text-slate-350 uppercase tracking-widest">
                People Owe Me
              </h2>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-full border border-emerald-500/20">
                Total: {sumTotal(activeOweMe)}
              </span>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {activeOweMe.length === 0 ? (
                <p className="text-center py-16 text-slate-400 italic text-xs">No active lending records found.</p>
              ) : (
                activeOweMe.map((item) => (
                  <div
                    key={item.id}
                    data-entrance="list-item"
                    className="flex items-center justify-between p-3.5 bg-slate-900/10 border border-slate-850/20 rounded-2xl group hover:border-slate-750 transition-all hover:shadow-apple-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
                        <User className="w-4.5 h-4.5 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {item.person_name}
                        </p>
                        <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {item.due_date ? `Due: ${new Date(item.due_date).toLocaleDateString()}` : 'No due date'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <p className="text-xs font-black text-emerald-500">
                        {formatAmount(item.amount, item.currency)}
                      </p>
                      
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="unstyled"
                          onClick={() => handleSettle(item.id)}
                          className="p-1 text-slate-450 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                          title="Settle Debt"
                        >
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        </Button>
                        <Button variant="unstyled"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: "I OWE PEOPLE" CARD
            Contains: Total payable badge, active i-owe entries with
            settle/delete actions, debt-free empty state
            ────────────────────────────────────────────────────────── */}
        <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-850">
              <h2 className="text-sm font-black text-slate-350 uppercase tracking-widest">
                I Owe People
              </h2>
              <span className="px-3 py-1 bg-rose-500/10 text-rose-500 text-xs font-bold rounded-full border border-rose-500/20">
                Total: {sumTotal(activeIOwe)}
              </span>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {activeIOwe.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-80" />
                  <p className="italic text-xs font-semibold">You are debt free! 🎉</p>
                </div>
              ) : (
                activeIOwe.map((item) => (
                  <div
                    key={item.id}
                    data-entrance="list-item"
                    className="flex items-center justify-between p-3.5 bg-slate-900/10 border border-slate-855/20 rounded-2xl group hover:border-slate-750 transition-all hover:shadow-apple-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-450">
                        <User className="w-4.5 h-4.5 text-rose-550" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {item.person_name}
                        </p>
                        <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {item.due_date ? `Due: ${new Date(item.due_date).toLocaleDateString()}` : 'No due date'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <p className="text-xs font-black text-rose-500">
                        {formatAmount(item.amount, item.currency)}
                      </p>
                      
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="unstyled"
                          onClick={() => handleSettle(item.id)}
                          className="p-1 text-slate-450 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                          title="Settle Debt"
                        >
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        </Button>
                        <Button variant="unstyled"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: SETTLED LEDGER
          Contains: Archived/settled entries (rendered only when any exist)
          ────────────────────────────────────────────────────────── */}
      {settledList.length > 0 && (
        <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple opacity-70">
          <h2 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-4 pb-3 border-b border-slate-850">
            Settle Logs
          </h2>
          <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4">
            {settledList.map((item) => (
              <div
                key={item.id}
                data-entrance="list-item"
                className="flex items-center justify-between p-3.5 bg-slate-900/20 border border-slate-850/20 rounded-2xl"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500 line-through truncate leading-tight">
                    {item.person_name}
                  </p>
                  <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mt-1">
                    {item.type === 'owe_me' ? 'settled receipt' : 'settled payout'}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="text-xs font-bold text-slate-400 line-through">
                    {formatAmount(item.amount, item.currency)}
                  </p>
                  <Button variant="unstyled"
                    onClick={() => handleDelete(item.id)}
                    className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ADD LENDING ENTRY MODAL
          Contains: New-entry form (person, type, currency, amount, due date)
          ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add Lending Entry"
        className="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Person Name</label>
            <input
              type="text"
              placeholder="e.g. John Doe, Sarah"
              value={personInput}
              onChange={(e) => setPersonInput(e.target.value)}
              required
              className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none text-white font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Entry Type</label>
              <Select
                value={typeSelect}
                onChange={(val) => setTypeSelect(val)}
                options={[
                  { value: 'owe_me', label: 'They owe me money' },
                  { value: 'i_owe', label: 'I owe them money' },
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
              <NumberInput
                step={0.01}
                placeholder="0.00"
                value={amountInput}
                onChange={setAmountInput}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Due Date (Optional)</label>
              <input
                type="date"
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
                className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none text-white"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full h-12 text-xs font-black"
          >
            Create Entry
          </Button>
        </form>
      </Modal>

    </div>
  );
}
