'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Income + Expenses merged into the unified /money/transactions ledger. This
// shim keeps old links / nav history / bookmarks working by redirecting to the
// Expense-filtered view.
export default function ExpensesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/money/transactions?type=expense'); }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
