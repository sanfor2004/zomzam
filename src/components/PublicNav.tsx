import React from 'react';
import Link from 'next/link';

/**
 * PublicNav — the shared top navigation shell for unauthenticated public pages
 * (public profiles `/u/[username]`, post permalinks `/p/[postId]`, …).
 *
 * Intentionally minimal: a single brand logo on the left that routes home. It
 * was extracted the moment the same fixed glass-nav markup appeared on a second
 * public page (CLAUDE.md §2.0 extension protocol — promote a repeated pattern
 * into a component rather than copy-paste a third time).
 */
export default function PublicNav() {
  return (
    /* ──────────────────────────────────────────────────────────
        DEVELOPMENT NAVIGATOR: PUBLIC TOP NAVIGATION HEADER
        Contains: Brand logo (routes to landing page)
        ────────────────────────────────────────────────────────── */
    <nav className="fixed w-full top-0 z-50 glass-nav transition-all duration-300">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center h-[75px]">
          <Link href="/" className="flex items-center gap-3" aria-label="Zomzam home">
            <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-8" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
