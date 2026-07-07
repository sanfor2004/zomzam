'use client';

import React, { useRef } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useMoney } from '@/context/MoneyContext';
import { useRouter } from 'next/navigation';
import { ChevronRight, Shield, Heart, PiggyBank, HelpCircle } from 'lucide-react';
import { Button, Select, ProLock } from '@/components/ui';
import { QuickBar } from '@/components/money/QuickBar';
import { BudgetRings } from '@/components/money/BudgetRings';
import { AccountCard } from '@/components/money/AccountCard';
import { ClientProfitabilityTeaser } from '@/components/money/ClientProfitabilityTeaser';

function getCategoryIcon(iconName: string | null) {
  switch (iconName) {
    case 'shield':
      return <Shield className="w-4 h-4" />;
    case 'heart':
      return <Heart className="w-4 h-4" />;
    case 'piggy-bank':
      return <PiggyBank className="w-4 h-4" />;
    default:
      return <HelpCircle className="w-4 h-4" />;
  }
}

export default function MoneyDashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const {
    accounts,
    transactions,
    stats,
    settings,
    displayCurrency,
    isLoading,
    deleteTransaction,
    deleteAccount,
    updateSettings,
    formatAmount,
  } = useMoney();
  usePageEntrance(containerRef, [isLoading]);

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
          Contains: Title + display-currency selector
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col @2xl:flex-row @2xl:items-center justify-between gap-4">
        <div>
          <h1 data-entrance="title" className="text-2xl font-black text-white tracking-tight">Financial Overview</h1>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[9px]">Display:</span>
            <Select
              value={displayCurrency}
              onChange={(val) => updateSettings(val, settings.secondary_currency)}
              options={['EGP', 'USD', 'EUR', 'GBP']}
              className="w-24"
            />
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: QUICK-BAR TRANSACTION ENTRY
          Contains: Income/Expense/Transfer quick-log bar (see QuickBar.tsx)
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card">
        <QuickBar onIncomeTagged={() => { /* Phase 6: wire the post-tag Pro upsell nudge here */ }} />
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ACCOUNT BALANCES GRID
          Contains: Per-account cards, credit-card cycle variant (see AccountCard.tsx)
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4 gap-5">
        {accounts.map((acc) => (
          <AccountCard key={acc.id} account={acc} onDelete={deleteAccount} />
        ))}
      </div>

      {/* Main Budget Section */}
      <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-8">

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: LEFT COLUMN — BUDGET RINGS, PRO TEASERS, LENDING
            Contains: nested activity-ring budget (see BudgetRings.tsx), advanced-
            reports lock (spot #4), client-profitability teaser (spot #1),
            lending summary card
            ────────────────────────────────────────────────────────── */}
        <div className="@3xl:col-span-1 space-y-6">
          <BudgetRings />

          {/* Pro spot #4 — current-month budget above stays free; only
              trends/month-over-month/runway are gated (spec §7). */}
          <ProLock
            variant="strip"
            label="Advanced reports"
            sublabel="Trends, month-over-month, runway"
            blurred={<span>↗ ↘</span>}
          />

          <ClientProfitabilityTeaser />

          <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-4">Lending Summary</h3>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-450">People Owe Me</span>
                <span className="text-xs font-black text-emerald-500 tabular-nums">{formatAmount(stats.lend.owe_me || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-450">I Owe People</span>
                <span className="text-xs font-black text-rose-500 tabular-nums">{formatAmount(stats.lend.i_owe || 0)}</span>
              </div>
              <Button variant="unstyled"
                onClick={() => router.push('/money/lend')}
                className="w-full h-11 bg-slate-900/30 text-[9px] font-black uppercase text-slate-450 tracking-widest hover:text-primary-500 hover:bg-slate-850 rounded-xl transition-all border border-slate-850 flex items-center justify-center gap-1.5"
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
        <div className="@3xl:col-span-2">
          <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple h-full flex flex-col justify-between">
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
                            {t.client_name ? ` • ${t.client_name}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-0.5">
                        <p className={`text-xs font-black tabular-nums${t.type === 'income' ? ' text-emerald-500' : ' text-white'}`}>
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
                className="flex-1 h-11 bg-slate-900/30 text-xs font-bold text-slate-350 hover:bg-slate-800 border border-slate-850 rounded-xl transition-all uppercase tracking-wider"
              >
                Expenses
              </Button>
              <Button variant="unstyled"
                onClick={() => router.push('/money/income')}
                className="flex-1 h-11 bg-slate-900/30 text-xs font-bold text-slate-350 hover:bg-slate-800 border border-slate-850 rounded-xl transition-all uppercase tracking-wider"
              >
                Income
              </Button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
