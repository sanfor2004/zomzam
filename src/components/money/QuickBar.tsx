'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SegmentedSwitch, NumberInput, Select, Button, useToast } from '@/components/ui';
import { useMoney } from '@/context/MoneyContext';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: QUICK-BAR TRANSACTION ENTRY
    Contains: Income/Expense/Transfer SegmentedSwitch, amount + account +
    category/client/to-account fields (morph per segment), expand toggle
    (date + notes), Log button
    ──────────────────────────────────────────────────────────
    Slim always-docked entry point — no modal, no page nav. Optimistic
    insert via useMoney().addTransaction; fields swap per segment instead
    of two divergent Income/Expense modals (spec §6.1). */

type Segment = 'income' | 'expense' | 'transfer';

const SEGMENT_OPTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];

export interface QuickBarProps {
  className?: string;
}

export function QuickBar({ className }: QuickBarProps) {
  const { accounts, categories, addTransaction } = useMoney();
  const { toast } = useToast();

  const [segment, setSegment] = useState<Segment>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Smart-defaulted account: first account once accounts load.
  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(String(accounts[0].id));
  }, [accounts, accountId]);

  // Transfer's "to" account defaults to the second account (falls back to the first).
  useEffect(() => {
    if (toAccountId) return;
    const fallback = accounts.find((a) => String(a.id) !== accountId) ?? accounts[0];
    if (fallback) setToAccountId(String(fallback.id));
  }, [accounts, accountId, toAccountId]);

  const relevantCategories = categories.filter((c) =>
    segment === 'income' ? c.type === 'income' : c.type !== 'income',
  );

  // Smart-defaulted category: first matching category whenever the segment
  // switches or the current selection stops matching that segment's list.
  useEffect(() => {
    if (segment === 'transfer') return;
    const stillValid = relevantCategories.some((c) => String(c.id) === categoryId);
    if (!stillValid && relevantCategories[0]) setCategoryId(String(relevantCategories[0].id));
  }, [segment, relevantCategories, categoryId]);

  const selectedAccount = accounts.find((a) => String(a.id) === accountId);

  const handleLog = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !accountId || submitting) return;

    if (segment === 'transfer' && toAccountId === accountId) {
      toast({ variant: 'error', description: 'Pick two different accounts' });
      return;
    }

    setSubmitting(true);
    const ok = await addTransaction({
      type: segment,
      amount: amt,
      account_id: parseInt(accountId, 10),
      category_id: segment === 'transfer' || !categoryId ? null : parseInt(categoryId, 10),
      description: notes,
      date,
      currency: selectedAccount?.currency ?? 'EGP',
      transfer_account_id: segment === 'transfer' ? parseInt(toAccountId, 10) : null,
    });
    setSubmitting(false);

    if (ok) {
      setAmount('');
      setNotes('');
    }
  };

  return (
    <div
      className={cn(
        'surface-card border border-slate-800/60 rounded-3xl p-5 shadow-apple',
        className,
      )}
    >
      {/* Row layout only at @5xl — below that the full field set's min-content
          exceeds the container and the NumberInput's absolute prefix/stepper
          collapse into each other. */}
      <div className="flex flex-col @5xl:flex-row @5xl:items-center gap-4">
        <SegmentedSwitch
          ariaLabel="Transaction type"
          options={SEGMENT_OPTIONS}
          value={segment}
          onChange={(v) => setSegment(v as Segment)}
          className="@5xl:w-64 shrink-0"
        />

        <div
          className={cn(
            'flex-1 min-w-0 grid grid-cols-1 @sm:grid-cols-2 gap-3',
            segment === 'income' ? '@5xl:grid-cols-3' : '@xl:grid-cols-3',
          )}
        >
          <NumberInput
            size="sm"
            step={0.01}
            min={0}
            placeholder="0.00"
            prefix={selectedAccount?.currency ?? 'EGP'}
            value={amount}
            onChange={setAmount}
            ariaLabel="Amount"
            className="tabular-nums"
          />

          <Select
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((a) => ({ value: String(a.id), label: `${a.name} (${a.currency})` }))}
            emptyMessage="Add an account first"
          />

          {segment === 'transfer' ? (
            <Select
              value={toAccountId}
              onChange={setToAccountId}
              options={accounts.map((a) => ({ value: String(a.id), label: `→ ${a.name}` }))}
              emptyMessage="Add another account"
            />
          ) : (
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={relevantCategories.map((c) => ({ value: String(c.id), label: c.name }))}
              emptyMessage="No categories yet"
            />
          )}

        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide date and notes' : 'Show date and notes'}
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', expanded && 'rotate-180')} />
          </Button>
          <Button
            variant="primary"
            className="h-11 px-6 text-xs font-black"
            loading={submitting}
            disabled={!amount || !accountId}
            onClick={handleLog}
          >
            Log
          </Button>
        </div>
      </div>

      {/* Expand toggle — reveals date + notes. Transform/opacity only, honors
          prefers-reduced-motion (mirrors the Accordion primitive's pattern). */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-900/30 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-primary-500 tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Notes</label>
              <input
                type="text"
                placeholder="Optional description"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-900/30 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
