import React from 'react';
import Image from 'next/image';
import { DashboardShell } from '@/app/(dashboard)/DashboardShell';
import PublicNav from '@/components/PublicNav';
import type { getUserById } from '@/lib/models/user';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: PUBLIC PAGE CHROME SWITCH
// Contains: auth-aware wrapper for the shareable public routes (/u, /p)
// ──────────────────────────────────────────────────────────
// The /u and /p routes are public (anyone can view — see proxy.ts), but a
// SIGNED-IN visitor should see them inside the full app shell (top nav + left
// sidebar + right sidebar) rather than the bare marketing chrome. We can't put
// these under the (dashboard) route group to get that shell — a route group
// resolves to the SAME path, so `(dashboard)/u` would collide with the public
// `/u`. So the branch lives here instead, keyed on whether a full viewer user
// was resolved:
//   • authed  → <DashboardShell> (the exact shell the dashboard layout renders)
//   • anon    → <PublicNav> + marketing footer
// DashboardShell is a client component; because it only renders in the authed
// branch, its chunk is never shipped to anonymous visitors.

type AuthedUser = Awaited<ReturnType<typeof getUserById>>;

export function PublicPageShell({
  authedUser,
  children,
}: {
  authedUser: AuthedUser | null;
  children: React.ReactNode;
}) {
  if (authedUser) {
    return <DashboardShell initialUser={authedUser}>{children}</DashboardShell>;
  }

  return (
    <div className="min-h-screen bg-[#111318] text-slate-100 flex flex-col font-sans">
      {/* Skip link — first Tab stop for keyboard users (WCAG bypass-blocks). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-primary-500 focus:text-white focus:text-sm focus:font-bold"
      >
        Skip to content
      </a>
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex-grow pt-28 pb-24 px-4 w-full outline-none">{children}</main>
      <footer className="border-t border-slate-800 bg-surface-dark/50 backdrop-blur-sm py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Image src="/Assets/Img/Icon-white.svg" alt="Zomzam Icon" width={24} height={24} className="w-6 h-6" />
            <span className="text-white font-semibold text-sm">zomzam.com</span>
          </div>
          <p className="text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} All rights reserved. Built with precision.
          </p>
        </div>
      </footer>
    </div>
  );
}
