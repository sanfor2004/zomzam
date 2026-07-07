import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { getFxRates, refreshFxRates, setFxRate } from '@/lib/services/money';
import { CURRENCIES, type Currency } from '@/lib/fx';

// Per-user FX rates (pivot = EGP). GET reads the cache, POST pulls live rates
// from the free provider and upserts them, PUT sets a single manual override.
export const GET = withAuth(async (_req, user) => {
  const { rates, sources } = await getFxRates(user.id);
  return NextResponse.json({ success: true, rates, sources });
});

export const POST = withAuth(async (_req, user) => {
  const { rates, source } = await refreshFxRates(user.id);
  return NextResponse.json({ success: true, rates, source });
});

export const PUT = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const currency = b.currency as Currency;
  const rate = parseFloat(b.rate_to_egp ?? b.rate);
  if (!CURRENCIES.includes(currency) || isNaN(rate) || rate <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid currency or rate' }, { status: 400 });
  }
  await setFxRate(user.id, currency, rate);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
