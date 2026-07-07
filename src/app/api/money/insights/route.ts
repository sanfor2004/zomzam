import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { getClientProfitability } from '@/lib/services/money';

// ── PRO INSIGHTS — CLIENT PROFITABILITY (SPEC §7) ────────────────────────────
// CEILING: presentation-gated only; no server isPro yet. Real per-client rate
// figures are returned (Stripe-ready) but the client renders them SOLELY
// behind a future isPro — see ProLock.tsx. Until billing exists, the client
// shows the blurred teaser and never these numbers.
export const GET = withAuth(async (req, user) => {
  const display = new URL(req.url).searchParams.get('display') || 'EGP';
  return NextResponse.json({ success: true, clients: await getClientProfitability(user.id, display) });
});
export const dynamic = 'force-dynamic';
