import Link from 'next/link';
import PublicNav from '@/components/PublicNav';
import { UserX } from 'lucide-react';

/**
 * Branded 404 for /u/[username] — rendered when notFound() fires for an
 * unknown username, instead of the framework's bare default page.
 */
export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-[#111318] text-slate-100 flex flex-col font-sans">
      <PublicNav />

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PROFILE NOT FOUND
          Contains: UserX glyph, headline, guidance copy, home CTA
          ────────────────────────────────────────────────────────── */}
      <main className="flex-grow flex items-center justify-center px-6 pt-32 pb-24">
        <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-10 shadow-apple relative overflow-hidden max-w-md w-full text-center space-y-5">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>

          <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            <UserX className="w-8 h-8 text-slate-500" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight text-white">Profile not found</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              This username doesn&apos;t exist — it may have been changed or the link is misspelled.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl px-6 py-3 shadow-md shadow-primary-500/20 transition-all text-xs uppercase tracking-wider"
          >
            Back to Zomzam
          </Link>
        </div>
      </main>
    </div>
  );
}
