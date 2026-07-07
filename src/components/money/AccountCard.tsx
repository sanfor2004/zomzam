'use client';

import React from 'react';
import { Briefcase, DollarSign, Wallet, CreditCard, AlertTriangle } from 'lucide-react';
import { useMoney, type Account } from '@/context/MoneyContext';
import { Progress, DeleteButton } from '@/components/ui';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: ACCOUNT CARD (+ CREDIT-CARD CYCLE VARIANT)
    Contains: icon/currency/name/balance (base, all account types), and for
    `type === 'credit_card'`: owed/limit + utilization + "due in N days"
    ──────────────────────────────────────────────────────────
    Never renders a PAN/CVV/PIN/expiry input — the schema has no column for
    them (Zenith §5 "we can't leak what we never hold"). `last_four` is the
    only card identifier shown. */

// ponytail: duplicated (not imported) from '@/lib/services/money'. That
// module's top-level `import { query, ... } from '@/lib/db'` pulls in
// mysql2/promise, which is Node-only and unsafe to bundle into a 'use
// client' component. This is the entirety of the pure math — keep it in
// sync with money.ts if either changes.
function utilization(balance: number, limit: number | null): number | null {
  if (!limit || limit <= 0) return null;
  return Math.round((Math.abs(balance) / limit) * 100) / 100;
}
function dueInfo(dueDay: number | null, today = new Date()): { days: number; date: Date } | null {
  if (!dueDay) return null;
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const due = dueDay < d ? new Date(y, m + 1, dueDay) : new Date(y, m, dueDay);
  const days = Math.round((due.getTime() - new Date(y, m, d).getTime()) / 86400000);
  return { days, date: due };
}

function getAccountIcon(type: Account['type']) {
  switch (type) {
    case 'bank':
      return <Briefcase className="w-5 h-5" />;
    case 'credit_card':
      return <CreditCard className="w-5 h-5" />;
    case 'wallet':
      return <Wallet className="w-5 h-5" />;
    default:
      return <DollarSign className="w-5 h-5" />;
  }
}

export interface AccountCardProps {
  account: Account;
  onDelete: (id: number) => void;
  className?: string;
}

export function AccountCard({ account, onDelete, className }: AccountCardProps) {
  const { formatAmount } = useMoney();
  const isCard = account.type === 'credit_card';
  const balance = parseFloat(account.balance);
  const limit = account.credit_limit != null ? parseFloat(account.credit_limit) : null;
  const util = isCard ? utilization(balance, limit) : null;
  const due = isCard ? dueInfo(account.due_day) : null;
  const utilOver = util != null && util >= 0.9;

  return (
    <div
      data-entrance="card"
      className={cn(
        'surface-card rounded-3xl p-6 border border-slate-800/60 shadow-apple hover:shadow-apple-lg transition-all group relative overflow-hidden',
        className,
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between h-full gap-4">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary-950/20 flex items-center justify-center text-primary-500">
              {getAccountIcon(account.type)}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{account.currency}</span>
              <DeleteButton
                onConfirm={() => onDelete(account.id)}
                tooltip="Delete account"
                className="opacity-0 group-hover:opacity-100"
              />
            </div>
          </div>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{account.name}</p>
          <h3 className="text-2xl font-black text-white tracking-tight tabular-nums">
            {formatAmount(Math.abs(balance), account.currency)}
          </h3>
          {isCard && limit != null && (
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5 tabular-nums">
              owed of {formatAmount(limit, account.currency)} limit
            </p>
          )}
        </div>

        {isCard ? (
          <div className="space-y-2.5">
            {util != null && (
              <Progress value={util * 100} variant={utilOver ? 'danger' : 'primary'} showValue />
            )}
            {utilOver && (
              <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-rose-450">
                <AlertTriangle className="w-3 h-3" /> High utilization
              </p>
            )}
            {due != null && (
              <p className="text-[9px] text-slate-400 font-semibold tabular-nums">
                Due in {due.days} day{due.days === 1 ? '' : 's'} ({due.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
              </p>
            )}
            {account.last_four && (
              <p className="text-[9px] text-slate-400 font-mono tracking-wider">•••• {account.last_four}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {account.last_four ? (
              <p className="text-[9px] text-slate-400 font-mono tracking-wider">•••• {account.last_four}</p>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
