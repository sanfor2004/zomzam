import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { getMoneySettings, updateSettings } from '@/lib/services/money';

const ALLOWED_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP'];

export const GET = withAuth(async (_req, user) => {
  return NextResponse.json({ success: true, settings: await getMoneySettings(user.id) });
});

export const PUT = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const primary = b.primary_currency;
  const secondary = b.secondary_currency;
  if (!ALLOWED_CURRENCIES.includes(primary) || !ALLOWED_CURRENCIES.includes(secondary)) {
    return NextResponse.json({ success: false, message: 'Invalid currency' }, { status: 400 });
  }
  await updateSettings(user.id, primary, secondary);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
