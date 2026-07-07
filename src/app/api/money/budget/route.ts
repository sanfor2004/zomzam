import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import {
  getBudget, updateBudget, monthWindow, monthlyIncome, monthlySpendByBucket,
  computeAllocation, safeToSpend,
} from '@/lib/services/money';

export const GET = withAuth(async (_req, user) => {
  const buckets = await getBudget(user.id);
  const { start, end } = monthWindow();
  const income = await monthlyIncome(user.id, start, end);
  const spent = await monthlySpendByBucket(user.id, start, end);
  return NextResponse.json({
    success: true, buckets, income,
    allocation: computeAllocation(income, buckets, spent),
    safeToSpend: safeToSpend(income, buckets, spent),
  });
});

export const PUT = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const buckets = Array.isArray(b.buckets) ? b.buckets : null;
  if (!buckets || buckets.some((x: any) => typeof x.percent !== 'number' || x.percent < 0 || x.percent > 100)
      || buckets.reduce((s: number, x: any) => s + x.percent, 0) > 100) {
    return NextResponse.json({ success: false, message: 'Invalid buckets' }, { status: 400 });
  }
  await updateBudget(user.id, buckets);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
