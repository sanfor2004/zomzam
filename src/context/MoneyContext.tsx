'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { EXCHANGE_RATES_TO_EGP } from '@/lib/utils';
import { useToast } from '@/components/ui';

export interface Account {
  id: number;
  user_id: number;
  name: string;
  type: 'bank' | 'cash' | 'paypal' | 'wallet' | 'other' | 'credit_card';
  currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  balance: string;
  last_four: string | null;
  credit_limit: string | null;
  statement_day: number | null;
  due_day: number | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  user_id: number;
  name: string;
  type: 'need' | 'want' | 'saving' | 'debt' | 'income';
  budget_percent: string | null;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  account_id: number;
  category_id: number | null;
  type: 'income' | 'expense' | 'transfer' | 'lend';
  amount: string;
  currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  description: string | null;
  transaction_date: string;
  created_at: string;
  category_name: string | null;
  category_icon: string | null;
  account_name: string | null;
  client_name: string | null;
  lead_id: number | null;
}

export interface Lend {
  id: number;
  user_id: number;
  person_name: string;
  type: 'owe_me' | 'i_owe';
  amount: string;
  currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  status: 'pending' | 'partial' | 'settled';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoneySettings {
  primary_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  secondary_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
}

export interface Bucket { key: string; label: string; percent: number }
export interface AllocationRow extends Bucket { limit: number; spent: number; over: boolean }

export interface Budget {
  buckets: Bucket[];
  income: number;
  allocation: AllocationRow[];
  safeToSpend: number;
}

const EMPTY_BUDGET: Budget = { buckets: [], income: 0, allocation: [], safeToSpend: 0 };

interface AddTransactionData {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  account_id: number;
  category_id: number | null;
  description: string;
  date: string;
  currency: string;
  lead_id?: number | null;
  transfer_account_id?: number | null;
}

interface AddAccountData {
  name: string;
  type: string;
  currency: string;
  balance: number;
  last_four: string | null;
  credit_limit?: number | null;
  statement_day?: number | null;
  due_day?: number | null;
}

interface AddLendData {
  person_name: string;
  type: 'owe_me' | 'i_owe';
  amount: number;
  currency: string;
  due_date: string | null;
}

interface MoneyContextType {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  lendList: Lend[];
  budget: Budget;
  stats: {
    income: number;
    expenses: Record<string, number>;
    lend: Record<string, number>;
  };
  settings: MoneySettings;
  displayCurrency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  exchangeRate: number; // EGP per USD
  isLoading: boolean;
  addTransaction: (data: AddTransactionData) => Promise<boolean>;
  deleteTransaction: (id: number) => Promise<boolean>;
  addAccount: (data: AddAccountData) => Promise<boolean>;
  deleteAccount: (id: number) => Promise<boolean>;
  addLend: (data: AddLendData) => Promise<boolean>;
  settleLend: (id: number) => Promise<boolean>;
  deleteLend: (id: number) => Promise<boolean>;
  updateBudget: (buckets: Bucket[]) => Promise<boolean>;
  updateSettings: (primary: string, secondary: string) => Promise<boolean>;
  setDisplayCurrency: (curr: 'EGP' | 'USD' | 'EUR' | 'GBP') => void;
  formatAmount: (amount: number | string, fromCurrency?: string) => string;
}

const MoneyContext = createContext<MoneyContextType | undefined>(undefined);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Shared optimistic-mutation shape: apply locally, hit the REST route, refetch the
 * affected resource(s) on success, roll back + Toast on failure. Every mutator below
 * is a thin config around this instead of copy-pasting the try/catch/rollback dance. */
async function runMutation(opts: {
  apply: () => void;
  rollback: () => void;
  request: () => Promise<Response>;
  refetch: () => Promise<void>;
  errorMessage: string;
  toast: ReturnType<typeof useToast>['toast'];
}): Promise<boolean> {
  opts.apply();
  try {
    const res = await opts.request();
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || opts.errorMessage);
    await opts.refetch();
    return true;
  } catch (err) {
    opts.rollback();
    opts.toast({ variant: 'error', description: opts.errorMessage });
    return false;
  }
}

export function MoneyProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lendList, setLendList] = useState<Lend[]>([]);
  const [budget, setBudget] = useState<Budget>(EMPTY_BUDGET);
  const [settings, setSettings] = useState<MoneySettings>({
    primary_currency: 'EGP',
    secondary_currency: 'USD',
  });
  const [displayCurrency, setDisplayCurrency] = useState<'EGP' | 'USD' | 'EUR' | 'GBP'>('EGP');
  const [isLoading, setIsLoading] = useState(true);

  const exchangeRate = EXCHANGE_RATES_TO_EGP.USD; // 1 USD = X EGP

  // ── Per-resource fetchers ──────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/money/accounts');
    const data = await res.json();
    if (data.success) {
      setAccounts(data.accounts || []);
      setCategories(data.categories || []);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    const res = await fetch('/api/money/transactions');
    const data = await res.json();
    if (data.success) setTransactions(data.transactions || []);
  }, []);

  const fetchBudget = useCallback(async () => {
    const res = await fetch('/api/money/budget');
    const data = await res.json();
    if (data.success) {
      setBudget({
        buckets: data.buckets || [],
        income: data.income || 0,
        allocation: data.allocation || [],
        safeToSpend: data.safeToSpend || 0,
      });
    }
  }, []);

  const fetchLend = useCallback(async () => {
    const res = await fetch('/api/money/lend');
    const data = await res.json();
    if (data.success) setLendList(data.lendList || []);
  }, []);

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/money/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      setSettings(data.settings);
      setDisplayCurrency(data.settings.primary_currency);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchAccounts(), fetchTransactions(), fetchBudget(), fetchLend(), fetchSettings()])
      .catch((err) => console.error('Failed to load money data:', err))
      .finally(() => setIsLoading(false));
  }, [fetchAccounts, fetchTransactions, fetchBudget, fetchLend, fetchSettings]);

  // ── Optimistic mutators ─────────────────────────────────────────────────
  const addTransaction = useCallback(async (data: AddTransactionData) => {
    const tempId = -Date.now();
    const optimisticRow: Transaction = {
      id: tempId,
      user_id: 0,
      account_id: data.account_id,
      category_id: data.category_id,
      type: data.type,
      amount: String(data.amount),
      currency: data.currency as Transaction['currency'],
      description: data.description || null,
      transaction_date: data.date,
      created_at: new Date().toISOString(),
      category_name: categories.find((c) => c.id === data.category_id)?.name ?? null,
      category_icon: categories.find((c) => c.id === data.category_id)?.icon ?? null,
      account_name: accounts.find((a) => a.id === data.account_id)?.name ?? null,
      client_name: null,
      lead_id: data.lead_id ?? null,
    };
    return runMutation({
      apply: () => setTransactions((prev) => [optimisticRow, ...prev]),
      rollback: () => setTransactions((prev) => prev.filter((t) => t.id !== tempId)),
      request: () => fetch('/api/money/transactions', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
      refetch: () => Promise.all([fetchTransactions(), fetchAccounts(), fetchBudget()]).then(() => undefined),
      errorMessage: 'Could not save transaction',
      toast,
    });
  }, [accounts, categories, fetchTransactions, fetchAccounts, fetchBudget, toast]);

  const deleteTransaction = useCallback(async (id: number) => {
    const prev = transactions;
    return runMutation({
      apply: () => setTransactions((cur) => cur.filter((t) => t.id !== id)),
      rollback: () => setTransactions(prev),
      request: () => fetch('/api/money/transactions', { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ id }) }),
      refetch: () => Promise.all([fetchTransactions(), fetchAccounts(), fetchBudget()]).then(() => undefined),
      errorMessage: 'Could not delete transaction',
      toast,
    });
  }, [transactions, fetchTransactions, fetchAccounts, fetchBudget, toast]);

  const addAccount = useCallback(async (data: AddAccountData) => {
    const tempId = -Date.now();
    const optimisticAccount: Account = {
      id: tempId,
      user_id: 0,
      name: data.name,
      type: data.type as Account['type'],
      currency: data.currency as Account['currency'],
      balance: String(data.balance),
      last_four: data.last_four,
      credit_limit: data.credit_limit != null ? String(data.credit_limit) : null,
      statement_day: data.statement_day ?? null,
      due_day: data.due_day ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return runMutation({
      apply: () => setAccounts((prev) => [...prev, optimisticAccount]),
      rollback: () => setAccounts((prev) => prev.filter((a) => a.id !== tempId)),
      request: () => fetch('/api/money/accounts', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
      refetch: () => Promise.all([fetchAccounts(), fetchBudget()]).then(() => undefined),
      errorMessage: 'Could not create account',
      toast,
    });
  }, [fetchAccounts, fetchBudget, toast]);

  const deleteAccount = useCallback(async (id: number) => {
    const prev = accounts;
    return runMutation({
      apply: () => setAccounts((cur) => cur.filter((a) => a.id !== id)),
      rollback: () => setAccounts(prev),
      request: () => fetch('/api/money/accounts', { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ id }) }),
      refetch: () => Promise.all([fetchAccounts(), fetchBudget()]).then(() => undefined),
      errorMessage: 'Could not delete account',
      toast,
    });
  }, [accounts, fetchAccounts, fetchBudget, toast]);

  const addLend = useCallback(async (data: AddLendData) => {
    const tempId = -Date.now();
    const optimisticLend: Lend = {
      id: tempId,
      user_id: 0,
      person_name: data.person_name,
      type: data.type,
      amount: String(data.amount),
      currency: data.currency as Lend['currency'],
      status: 'pending',
      due_date: data.due_date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return runMutation({
      apply: () => setLendList((prev) => [optimisticLend, ...prev]),
      rollback: () => setLendList((prev) => prev.filter((l) => l.id !== tempId)),
      request: () => fetch('/api/money/lend', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
      refetch: fetchLend,
      errorMessage: 'Could not add lending entry',
      toast,
    });
  }, [fetchLend, toast]);

  const settleLend = useCallback(async (id: number) => {
    const prev = lendList;
    return runMutation({
      apply: () => setLendList((cur) => cur.map((l) => (l.id === id ? { ...l, status: 'settled' } : l))),
      rollback: () => setLendList(prev),
      request: () => fetch('/api/money/lend', { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ id }) }),
      refetch: fetchLend,
      errorMessage: 'Could not settle entry',
      toast,
    });
  }, [lendList, fetchLend, toast]);

  const deleteLend = useCallback(async (id: number) => {
    const prev = lendList;
    return runMutation({
      apply: () => setLendList((cur) => cur.filter((l) => l.id !== id)),
      rollback: () => setLendList(prev),
      request: () => fetch('/api/money/lend', { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ id }) }),
      refetch: fetchLend,
      errorMessage: 'Could not delete entry',
      toast,
    });
  }, [lendList, fetchLend, toast]);

  const updateBudget = useCallback(async (buckets: Bucket[]) => {
    const prev = budget;
    return runMutation({
      apply: () => setBudget((cur) => ({ ...cur, buckets })),
      rollback: () => setBudget(prev),
      request: () => fetch('/api/money/budget', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ buckets }) }),
      refetch: fetchBudget,
      errorMessage: 'Could not update budget',
      toast,
    });
  }, [budget, fetchBudget, toast]);

  const updateSettings = useCallback(async (primary: string, secondary: string) => {
    const prevSettings = settings;
    const prevDisplay = displayCurrency;
    return runMutation({
      apply: () => {
        setSettings({ primary_currency: primary as MoneySettings['primary_currency'], secondary_currency: secondary as MoneySettings['secondary_currency'] });
        setDisplayCurrency(primary as 'EGP' | 'USD' | 'EUR' | 'GBP');
      },
      rollback: () => {
        setSettings(prevSettings);
        setDisplayCurrency(prevDisplay);
      },
      request: () => fetch('/api/money/settings', {
        method: 'PUT', headers: JSON_HEADERS,
        body: JSON.stringify({ primary_currency: primary, secondary_currency: secondary }),
      }),
      refetch: fetchSettings,
      errorMessage: 'Could not update settings',
      toast,
    });
  }, [settings, displayCurrency, fetchSettings, toast]);

  // Derived lending + monthly-spend summary — the old god-route's `stats` shape,
  // now computed client-side from budget.allocation + lendList instead of a
  // dedicated server aggregate (mirrors the old query: raw amount sum by type,
  // unsettled only — no cross-currency conversion here, same as before).
  const stats = useMemo(() => {
    const expenses: Record<string, number> = {};
    for (const row of budget.allocation) expenses[row.key] = row.spent;
    const lend: Record<string, number> = {};
    for (const item of lendList) {
      if (item.status === 'settled') continue;
      lend[item.type] = (lend[item.type] || 0) + parseFloat(item.amount);
    }
    return { income: budget.income, expenses, lend };
  }, [budget, lendList]);

  // Convert and format amounts dynamically — the ONLY currency-conversion path.
  const formatAmount = useCallback((amount: number | string, fromCurrency = 'EGP') => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    // Quick currency conversion: EGP <-> USD (using static exchangeRate)
    let converted = numericAmount;
    if (fromCurrency === 'USD' && displayCurrency === 'EGP') {
      converted = numericAmount * EXCHANGE_RATES_TO_EGP.USD;
    } else if (fromCurrency === 'EGP' && displayCurrency === 'USD') {
      converted = numericAmount / EXCHANGE_RATES_TO_EGP.USD;
    } else if (fromCurrency !== displayCurrency) {
      // Basic fallback conversion for EUR, GBP using approximate relative rates if needed,
      // but standard is EGP/USD. We will fall back to original for non-USD/EGP pairs
      if (fromCurrency === 'EUR' && displayCurrency === 'EGP') converted = numericAmount * EXCHANGE_RATES_TO_EGP.EUR;
      else if (fromCurrency === 'GBP' && displayCurrency === 'EGP') converted = numericAmount * EXCHANGE_RATES_TO_EGP.GBP;
      else if (fromCurrency === 'EGP' && displayCurrency === 'EUR') converted = numericAmount / EXCHANGE_RATES_TO_EGP.EUR;
      else if (fromCurrency === 'EGP' && displayCurrency === 'GBP') converted = numericAmount / EXCHANGE_RATES_TO_EGP.GBP;
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: displayCurrency,
    }).format(converted);
  }, [displayCurrency]);

  const value = useMemo<MoneyContextType>(
    () => ({
      accounts,
      categories,
      transactions,
      lendList,
      budget,
      stats,
      settings,
      displayCurrency,
      exchangeRate,
      isLoading,
      addTransaction,
      deleteTransaction,
      addAccount,
      deleteAccount,
      addLend,
      settleLend,
      deleteLend,
      updateBudget,
      updateSettings,
      setDisplayCurrency,
      formatAmount,
    }),
    [
      accounts,
      categories,
      transactions,
      lendList,
      budget,
      stats,
      settings,
      displayCurrency,
      exchangeRate,
      isLoading,
      addTransaction,
      deleteTransaction,
      addAccount,
      deleteAccount,
      addLend,
      settleLend,
      deleteLend,
      updateBudget,
      updateSettings,
      formatAmount,
    ],
  );

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  const context = useContext(MoneyContext);
  if (context === undefined) {
    throw new Error('useMoney must be used within a MoneyProvider');
  }
  return context;
}
