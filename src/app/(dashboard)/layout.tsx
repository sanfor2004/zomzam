import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { getUserById } from '@/lib/models/user';
import { DashboardShell } from './DashboardShell';

// Cookie-based auth makes every dashboard render dynamic.
export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: DASHBOARD AUTH GATE (SERVER)
// Reads the session cookie, resolves the user once on the server, and seeds the
// client shell with it — replacing the old client-side fetch('/api/auth')
// waterfall + full-screen spinner. The proxy middleware already redirects
// unauthenticated traffic away from protected routes; the guard below is a
// defensive belt-and-suspenders.
// ──────────────────────────────────────────────────────────
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = (await cookies()).get('ZOMZAM_SESSION')?.value;

  let user: Awaited<ReturnType<typeof getUserById>> | null = null;
  try {
    const payload = session ? verifyToken(session) : null;
    user = payload ? await getUserById(payload.id) : null;
  } catch {
    user = null;
  }

  if (!user) {
    redirect('/sign');
  }

  return <DashboardShell initialUser={user}>{children}</DashboardShell>;
}
