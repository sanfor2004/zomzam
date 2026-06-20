'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { EXCHANGE_RATES_TO_EGP } from '@/lib/utils';

export interface Account {
  id: number;
  user_id: number;
  name: string;
  type: 'bank' | 'cash' | 'paypal' | 'wallet' | 'other';
  currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  balance: string;
  last_four: string | null;
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

interface MoneyContextType {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  lendList: Lend[];
  stats: {
    income: number;
    expenses: Record<string, number>;
    lend: Record<string, number>;
  };
  settings: MoneySettings;
  displayCurrency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  exchangeRate: number; // EGP per USD
  isLoading: boolean;
  loadMoneyData: () => Promise<void>;
  addTransaction: (data: {
    type: 'income' | 'expense' | 'transfer' | 'lend';
    amount: number;
    account_id: number;
    category_id: number | null;
    description: string;
    date: string;
    currency: string;
  }) => Promise<boolean>;
  deleteTransaction: (id: number) => Promise<boolean>;
  addAccount: (data: {
    name: string;
    type: string;
    currency: string;
    balance: number;
    last_four: string | null;
  }) => Promise<boolean>;
  deleteAccount: (id: number) => Promise<boolean>;
  addLend: (data: {
    person_name: string;
    type: 'owe_me' | 'i_owe';
    amount: number;
    currency: string;
    due_date: string | null;
  }) => Promise<boolean>;
  settleLend: (id: number) => Promise<boolean>;
  deleteLend: (id: number) => Promise<boolean>;
  updateSettings: (primary: string, secondary: string) => Promise<boolean>;
  setDisplayCurrency: (curr: 'EGP' | 'USD' | 'EUR' | 'GBP') => void;
  formatAmount: (amount: number | string, fromCurrency?: string) => string;
}

const MoneyContext = createContext<MoneyContextType | undefined>(undefined);

export function MoneyProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lendList, setLendList] = useState<Lend[]>([]);
  const [stats, setStats] = useState({
    income: 0,
    expenses: {} as Record<string, number>,
    lend: {} as Record<string, number>,
  });
  const [settings, setSettings] = useState<MoneySettings>({
    primary_currency: 'EGP',
    secondary_currency: 'USD',
  });
  const [displayCurrency, setDisplayCurrency] = useState<'EGP' | 'USD' | 'EUR' | 'GBP'>('EGP');
  const [isLoading, setIsLoading] = useState(true);

  const exchangeRate = EXCHANGE_RATES_TO_EGP.USD; // 1 USD = X EGP

  const loadMoneyData = useCallback(async () => {
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_initial_data' }),
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts || []);
        setCategories(data.categories || []);
        setTransactions(data.transactions || []);
        setLendList(data.lendList || []);
        setStats(data.stats || { income: 0, expenses: {}, lend: {} });
        if (data.user_settings) {
          setSettings({
            primary_currency: data.user_settings.primary_currency,
            secondary_currency: data.user_settings.secondary_currency,
          });
          setDisplayCurrency(data.user_settings.primary_currency);
        }
      }
    } catch (err) {
      console.error('Failed to load money data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMoneyData();
  }, [loadMoneyData]);

  const postMoneyApi = useCallback(async (payload: object): Promise<boolean> => {
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data.success === true;
    } catch (err) {
      console.error('Money API error:', err);
      return false;
    }
  }, []);

  const mutateAndReload = useCallback(async (payload: object): Promise<boolean> => {
    const ok = await postMoneyApi(payload);
    if (ok) await loadMoneyData();
    return ok;
  }, [postMoneyApi, loadMoneyData]);

  const addTransaction = useCallback((data: any) => mutateAndReload({ action: 'add_transaction', ...data }), [mutateAndReload]);
  const deleteTransaction = useCallback((id: number) => mutateAndReload({ action: 'delete_transaction', id }), [mutateAndReload]);
  const addAccount = useCallback((data: any) => mutateAndReload({ action: 'add_account', ...data }), [mutateAndReload]);
  const deleteAccount = useCallback((id: number) => mutateAndReload({ action: 'delete_account', id }), [mutateAndReload]);
  const addLend = useCallback((data: any) => mutateAndReload({ action: 'add_lend', ...data }), [mutateAndReload]);
  const settleLend = useCallback((id: number) => mutateAndReload({ action: 'settle_lend', id }), [mutateAndReload]);
  const deleteLend = useCallback((id: number) => mutateAndReload({ action: 'delete_lend', id }), [mutateAndReload]);

  const updateSettings = useCallback(async (primary: string, secondary: string) => {
    const ok = await postMoneyApi({
      action: 'update_settings',
      primary_currency: primary,
      secondary_currency: secondary,
    });
    if (ok) {
      setSettings({
        primary_currency: primary as any,
        secondary_currency: secondary as any,
      });
      setDisplayCurrency(primary as any);
      await loadMoneyData();
    }
    return ok;
  }, [postMoneyApi, loadMoneyData]);

  // Convert and format amounts dynamically
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
      stats,
      settings,
      displayCurrency,
      exchangeRate,
      isLoading,
      loadMoneyData,
      addTransaction,
      deleteTransaction,
      addAccount,
      deleteAccount,
      addLend,
      settleLend,
      deleteLend,
      updateSettings,
      setDisplayCurrency,
      formatAmount,
    }),
    [
      accounts,
      categories,
      transactions,
      lendList,
      stats,
      settings,
      displayCurrency,
      exchangeRate,
      isLoading,
      loadMoneyData,
      addTransaction,
      deleteTransaction,
      addAccount,
      deleteAccount,
      addLend,
      settleLend,
      deleteLend,
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
