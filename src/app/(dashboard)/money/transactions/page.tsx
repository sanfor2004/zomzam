'use client';

import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useMoney, type Transaction } from '@/context/MoneyContext';
import {
  Plus, ArrowLeft, Trash2, Pencil, Search, DollarSign, ArrowLeftRight,
  Shield, Heart, PiggyBank, HelpCircle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Select, Modal, NumberInput, SegmentedSwitch, Pagination, Skeleton, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';

type LedgerType = 'all' | 'income' | 'expense' | 'transfer';
type FormType = 'income' | 'expense' | 'transfer';
const PAGE_SIZE = 25;

interface Lead { id: number; name: string }

function categoryIcon(icon: string | null | undefined) {
  switch (icon) {
    case 'shield': return <Shield className="w-4 h-4" />;
    case 'heart': return <Heart className="w-4 h-4" />;
    case 'piggy-bank': return <PiggyBank className="w-4 h-4" />;
    case 'dollar-sign': return <DollarSign className="w-4 h-4" />;
    default: return <HelpCircle className="w-4 h-4" />;
  }
}

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: UNIFIED TRANSACTIONS LEDGER
// One filterable, paginated, editable history of income / expense / transfer —
// replaces the mirror Income + Expenses pages (which now redirect here). Income
// keeps its optional client tag; transfers keep their destination account.
// ──────────────────────────────────────────────────────────
function TransactionsInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    accounts, categories, isLoading,
    getTransactions, addTransaction, updateTransaction, deleteTransaction,
    formatAmount, homeEquivalent, homeCurrency, displayCurrency,
  } = useMoney();
  // Home-equivalent tooltip only adds information when the visible figure isn't
  // already shown in the home currency (i.e. display ≠ home).
  const showHome = displayCurrency !== homeCurrency;
  usePageEntrance(containerRef, [isLoading]);

  // ── Filters ──
  const initialType = (searchParams.get('type') as LedgerType) || 'all';
  const [activeType, setActiveType] = useState<LedgerType>(
    ['all', 'income', 'expense', 'transfer'].includes(initialType) ? initialType : 'all'
  );
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Ledger data ──
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingRows, setLoadingRows] = useState(true);
  // Skeleton only before the FIRST fetch resolves; refetches (type/filter/page
  // switches) keep the stale list rendered, dimmed — no skeleton flash.
  const [hasLoaded, setHasLoaded] = useState(false);
  // Monotonic fetch id — a slow older response must not overwrite a newer one.
  const fetchSeq = useRef(0);

  // ── Client (lead) tags — same source as the old income page ──
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_leads' }) })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.success) setLeads(d.leads || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const onFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const fetchRows = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoadingRows(true);
    const res = await getTransactions({
      page, page_size: PAGE_SIZE, type: activeType,
      account_id: filterAccount ? parseInt(filterAccount) : null,
      category_id: filterCategory ? parseInt(filterCategory) : null,
      date_from: dateFrom || null, date_to: dateTo || null, search: debouncedSearch,
    });
    if (seq !== fetchSeq.current) return; // superseded by a newer fetch
    setRows(res.rows);
    setTotal(res.total);
    setLoadingRows(false);
    setHasLoaded(true);
  }, [getTransactions, page, activeType, filterAccount, filterCategory, dateFrom, dateTo, debouncedSearch]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Add / Edit modal ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formType, setFormType] = useState<FormType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [accountSelect, setAccountSelect] = useState('');
  const [toAccountSelect, setToAccountSelect] = useState('');
  const [categorySelect, setCategorySelect] = useState('');
  const [leadSelect, setLeadSelect] = useState('');
  const [descInput, setDescInput] = useState('');
  const [dateInput, setDateInput] = useState(new Date().toISOString().substring(0, 10));
  const [saving, setSaving] = useState(false);

  const fromCurrency = accounts.find(a => a.id === parseInt(accountSelect))?.currency || 'EGP';
  const categoryOptions = categories.filter(c => formType === 'income' ? c.type === 'income' : c.type !== 'income');

  const openAdd = (type: FormType) => {
    setEditing(null);
    setFormType(type);
    setAmountInput('');
    setAccountSelect(accounts[0] ? accounts[0].id.toString() : '');
    setToAccountSelect(accounts[1] ? accounts[1].id.toString() : (accounts[0] ? accounts[0].id.toString() : ''));
    const cats = categories.filter(c => type === 'income' ? c.type === 'income' : c.type !== 'income');
    setCategorySelect(cats[0] ? cats[0].id.toString() : '');
    setLeadSelect('');
    setDescInput('');
    setDateInput(new Date().toISOString().substring(0, 10));
    setModalOpen(true);
  };

  const openEdit = (t: Transaction) => {
    if (t.type === 'lend') return; // lend entries are managed on /money/lend
    setEditing(t);
    setFormType(t.type);
    setAmountInput(String(parseFloat(t.amount)));
    setAccountSelect(t.account_id ? t.account_id.toString() : '');
    setToAccountSelect(t.transfer_account_id ? t.transfer_account_id.toString() : '');
    setCategorySelect(t.category_id ? t.category_id.toString() : '');
    setLeadSelect(t.lead_id ? t.lead_id.toString() : '');
    setDescInput(t.description || '');
    setDateInput(t.transaction_date ? t.transaction_date.substring(0, 10) : new Date().toISOString().substring(0, 10));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) return;
    const accountId = parseInt(accountSelect);
    if (!accountId) return;

    const data = {
      type: formType,
      amount: amt,
      account_id: accountId,
      category_id: formType === 'transfer' ? null : (categorySelect ? parseInt(categorySelect) : null),
      description: descInput,
      date: dateInput,
      currency: fromCurrency,
      lead_id: formType === 'income' && leadSelect ? parseInt(leadSelect) : null,
      transfer_account_id: formType === 'transfer' ? parseInt(toAccountSelect) : null,
    };
    if (formType === 'transfer' && (!data.transfer_account_id || data.transfer_account_id === accountId)) return;

    setSaving(true);
    const ok = editing ? await updateTransaction(editing.id, data) : await addTransaction(data);
    setSaving(false);
    if (ok) { setModalOpen(false); fetchRows(); }
  };

  const handleDelete = async (id: number) => {
    const ok = await deleteTransaction(id);
    if (ok) fetchRows();
  };

  const sign = (t: Transaction) => t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '−';
  const amountColor = (t: Transaction) =>
    t.type === 'income' ? 'text-emerald-500' : t.type === 'transfer' ? 'text-slate-300' : 'text-rose-400';
  const rowIcon = (t: Transaction) => {
    if (t.type === 'income') return <DollarSign className="w-5 h-5 text-emerald-500" />;
    if (t.type === 'transfer') return <ArrowLeftRight className="w-5 h-5 text-slate-300" />;
    return <span className="text-slate-450">{categoryIcon(t.category_icon)}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto space-y-8">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: back button, title, quick-add buttons (income/expense/transfer)
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
            <h1 data-entrance="title" className="text-2xl font-black text-white tracking-tight">Transactions</h1>
            <p className="text-xs text-slate-400">Your full money history — income, spending, and transfers.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Button onClick={() => openAdd('income')} variant="success" className="text-xs font-bold">
            <Plus className="w-4 h-4 stroke-[3] mr-1.5" /> Income
          </Button>
          <Button onClick={() => openAdd('expense')} variant="danger" className="text-xs font-bold">
            <Plus className="w-4 h-4 stroke-[3] mr-1.5" /> Expense
          </Button>
          <Button onClick={() => openAdd('transfer')} variant="secondary" className="text-xs font-bold">
            <ArrowLeftRight className="w-4 h-4 mr-1.5" /> Transfer
          </Button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: FILTER TABS + FILTER BAR
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="space-y-4">
        <SegmentedSwitch
          ariaLabel="Filter by type"
          value={activeType}
          onChange={onFilter<string>((v) => setActiveType(v as LedgerType))}
          options={[
            { value: 'all', label: 'All' },
            { value: 'income', label: 'Income' },
            { value: 'expense', label: 'Expense' },
            { value: 'transfer', label: 'Transfer' },
          ]}
        />

        {/* Container-query breakpoints (@…) not viewport ones — this page lives in
            the @container main column, which is ~half the viewport once both
            sidebars are open. min-w-0 stops the date inputs' intrinsic width from
            pushing the grid past the container (horizontal-scroll bug). */}
        <div className="grid grid-cols-2 @4xl:grid-cols-6 gap-3">
          <div className="col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, category, account…"
              className="w-full min-w-0 h-11 pl-10 pr-4 bg-slate-900/30 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          <Select
            value={filterAccount}
            onChange={onFilter(setFilterAccount)}
            placeholder="All accounts"
            className="min-w-0"
            options={[{ value: '', label: 'All accounts' }, ...accounts.map(a => ({ value: a.id.toString(), label: a.name }))]}
          />
          <Select
            value={filterCategory}
            onChange={onFilter(setFilterCategory)}
            placeholder="All categories"
            className="min-w-0"
            options={[{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: c.id.toString(), label: c.name }))]}
          />
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} aria-label="From date"
            className="w-full min-w-0 h-11 px-2 bg-slate-900/30 border border-slate-850 rounded-xl text-[11px] text-white focus:outline-none focus:border-primary-500" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} aria-label="To date"
            className="w-full min-w-0 h-11 px-2 bg-slate-900/30 border border-slate-850 rounded-xl text-[11px] text-white focus:outline-none focus:border-primary-500" />
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: LEDGER LIST
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple">
        {!hasLoaded ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm font-semibold text-slate-400">No transactions found</p>
            <p className="text-xs text-slate-500 mt-1">Adjust your filters, or add your first entry above.</p>
          </div>
        ) : (
          <div className={cn('space-y-3 transition-opacity duration-150', loadingRows && 'opacity-50 pointer-events-none')}>
            {rows.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 bg-slate-900/10 border border-slate-850/20 rounded-2xl group hover:border-slate-750 transition-all hover:shadow-apple-sm"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-center flex-shrink-0">
                    {rowIcon(t)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {t.description || t.category_name || (t.type === 'transfer' ? 'Transfer' : t.type === 'income' ? 'Income' : 'Expense')}
                    </p>
                    <span className="block text-[10px] text-slate-455 font-bold uppercase tracking-tight mt-0.5 truncate">
                      {t.type === 'transfer' && t.transfer_account_name
                        ? `${t.account_name} → ${t.transfer_account_name}`
                        : t.account_name}
                      {' • '}{new Date(t.transaction_date).toLocaleDateString()}
                      {t.client_name && <> • {t.client_name}</>}
                    </span>
                  </div>
                </div>

                <div className="text-right flex items-center gap-3 flex-shrink-0">
                  {showHome ? (
                    <Tooltip content={`≈ ${homeEquivalent(t.amount, t.currency)} in ${homeCurrency}`}>
                      <p className={cn('text-sm font-black tabular-nums cursor-help', amountColor(t))}>
                        {sign(t)}{formatAmount(t.amount, t.currency)}
                      </p>
                    </Tooltip>
                  ) : (
                    <p className={cn('text-sm font-black tabular-nums', amountColor(t))}>
                      {sign(t)}{formatAmount(t.amount, t.currency)}
                    </p>
                  )}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="unstyled"
                      onClick={() => openEdit(t)}
                      className="p-2 text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-xl transition-all"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="unstyled"
                      onClick={() => handleDelete(t.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold">{total} entries</span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ADD / EDIT TRANSACTION MODAL
          ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit transaction' : 'Add transaction'}
        className="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <SegmentedSwitch
            ariaLabel="Transaction type"
            value={formType}
            onChange={(v) => setFormType(v as FormType)}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
              { value: 'transfer', label: 'Transfer' },
            ]}
          />

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
            <NumberInput
              size="lg"
              accent={formType === 'income' ? 'emerald' : 'primary'}
              prefix={fromCurrency}
              step={0.01}
              placeholder="0.00"
              value={amountInput}
              onChange={setAmountInput}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                {formType === 'transfer' ? 'From account' : 'Account'}
              </label>
              <Select
                value={accountSelect}
                onChange={setAccountSelect}
                options={accounts.map(a => ({ value: a.id.toString(), label: `${a.name} (${a.currency})` }))}
              />
            </div>
            {formType === 'transfer' ? (
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">To account</label>
                <Select
                  value={toAccountSelect}
                  onChange={setToAccountSelect}
                  options={accounts.filter(a => a.id !== parseInt(accountSelect)).map(a => ({ value: a.id.toString(), label: `${a.name} (${a.currency})` }))}
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
                <Select
                  value={categorySelect}
                  onChange={setCategorySelect}
                  options={categoryOptions.map(c => ({ value: c.id.toString(), label: c.name }))}
                />
              </div>
            )}
          </div>

          {formType === 'income' && leads.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Client (optional)</label>
              <Select
                value={leadSelect}
                onChange={setLeadSelect}
                placeholder="No client"
                options={[{ value: '', label: 'No client' }, ...leads.map(l => ({ value: l.id.toString(), label: l.name }))]}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Date</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                required
                className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
              <input
                type="text"
                placeholder={formType === 'income' ? 'e.g. Client invoice' : formType === 'transfer' ? 'e.g. Move to savings' : 'e.g. Groceries'}
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                className="w-full px-4 h-11 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-white"
              />
            </div>
          </div>

          <Button type="submit" loading={saving} className="w-full h-12 text-xs font-black">
            {editing ? 'Save changes' : formType === 'income' ? 'Save income' : formType === 'transfer' ? 'Save transfer' : 'Save expense'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[300px]"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <TransactionsInner />
    </Suspense>
  );
}
