import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { getDashboardSummary } from '@/lib/services/dashboard';

// Thin dispatch layer: authenticate, delegate the cross-suite rollup to the
// dashboard service, respond. Aggregation logic lives in @/lib/services/dashboard.
export const GET = withAuth(async (request, user) => {
  return NextResponse.json({ success: true, ...await getDashboardSummary(user.id) });
});
