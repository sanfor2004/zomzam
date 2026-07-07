'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SegmentedSwitch, NumberInput, Select, Button } from '@/components/ui';
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

interface Lead {
  id: number;
  name: string;
}

type Segment = 'income' | 'expense' | 'transfer';

const SEGMENT_OPTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];

export interface QuickBarProps {
  /** Phase 6 nudge hook: called after a successful income insert that carries a
   *  lead_id. The parent wires the actual "unlock per-client rate" upsell later —
   *  this component only needs to fire the callback. */
  onIncomeTagged?: (leadId: number) => void;
  className?: string;
}

export function QuickBar({ onIncomeTagged, className }: QuickBarProps) {
  const { accounts, categories, addTransaction } = useMoney();

  const [segment, setSegment] = useState<Segment>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [notes, setNotes] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
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

  // Client tag list (income only) — fetched once, reused across segment switches.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_leads' }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) setLeads(data.leads || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAccount = accounts.find((a) => String(a.id) === accountId);

  const handleLog = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !accountId || submitting) return;

    setSubmitting(true);
    // ponytail: the money service models a transfer as a single debit leg —
    // there's no second account_id column on money_transactions yet (see
    // AddTransactionInput in src/lib/services/money.ts). The destination
    // account name goes into the description so it isn't silently dropped.
    // Add a real dual-leg transfer to the service if that becomes a need.
    const description =
      segment === 'transfer'
        ? `Transfer to ${accounts.find((a) => String(a.id) === toAccountId)?.name ?? 'another account'}${notes ? ` — ${notes}` : ''}`
        : notes;

    const ok = await addTransaction({
      type: segment,
      amount: amt,
      account_id: parseInt(accountId, 10),
      category_id: segment === 'transfer' || !categoryId ? null : parseInt(categoryId, 10),
      description,
      date,
      currency: selectedAccount?.currency ?? 'EGP',
      lead_id: segment === 'income' && leadId ? parseInt(leadId, 10) : null,
    });
    setSubmitting(false);

    if (ok) {
      setAmount('');
      setNotes('');
      if (segment === 'income' && leadId) onIncomeTagged?.(parseInt(leadId, 10));
    }
  };

  return (
    <div
      className={cn(
        'surface-card border border-slate-800/60 rounded-3xl p-5 shadow-apple',
        className,
      )}
    >
      <div className="flex flex-col @xl:flex-row @xl:items-center gap-4">
        <SegmentedSwitch
          ariaLabel="Transaction type"
          options={SEGMENT_OPTIONS}
          value={segment}
          onChange={(v) => setSegment(v as Segment)}
          className="@xl:w-64 shrink-0"
        />

        <div className="flex-1 grid grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-3 gap-3">
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

        {segment === 'income' && (
          <Select
            value={leadId}
            onChange={setLeadId}
            options={[{ value: '', label: 'No client tag' }, ...leads.map((l) => ({ value: String(l.id), label: l.name }))]}
            className="@xl:w-48 shrink-0"
          />
        )}

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
