'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bell, Repeat2, UserPlus, CircleAlert, PartyPopper, HandMetal, Handshake, type LucideIcon } from 'lucide-react';
import { useNotifications } from '@/context/StreamWaiterContext';
import { describeNotification, notifTimeAgo } from '@/lib/notifications';
import { cn } from '@/lib/utils';

/** Lucide icon lookup for notification type badges. */
const NOTIF_ICONS: Record<string, LucideIcon> = {
  Repeat2, UserPlus, CircleAlert, PartyPopper, HandMetal, Handshake, Bell,
};

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: NOTIFICATIONS PAGE
// Contains: full-page notification list — the mobile bottom-bar's bell target
// (the header dropdown can't open upward from a bottom bar). Reuses the exact
// same renderers as the desktop dropdown (describeNotification / notifTimeAgo)
// and the shared useNotifications stream, so there is one source of truth for
// how a row looks. Marks everything read on mount, like opening the dropdown.
// ──────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { notifications, markRead } = useNotifications();

  // Opening the page is "seeing" them — same contract as the dropdown toggle.
  useEffect(() => { markRead(); }, [markRead]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-500/25">
          <Bell className="w-5 h-5" />
        </span>
        <h1 className="text-title font-bold text-white">Notifications</h1>
      </div>

      {/* ── List ── */}
      <div className="bg-white/[0.04] border border-white/[0.07] rounded-3xl overflow-hidden shadow-apple">
        {notifications.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16 italic">No notifications yet.</p>
        ) : (
          notifications.map((n) => {
            const view = describeNotification(n);
            const when = notifTimeAgo(n.created_at);
            // Rows with a known destination deep-link; the rest render as a
            // static row so a dead click never lands on a 404.
            const RowTag: any = view.href ? Link : 'div';
            const rowProps = view.href ? { href: view.href } : {};
            return (
              <RowTag
                key={n.id}
                {...rowProps}
                className={cn(
                  'group px-4 py-3.5 flex gap-3 items-start border-b border-slate-800/40 last:border-b-0 transition-colors',
                  view.href ? 'cursor-pointer hover:bg-slate-800/40' : 'cursor-default',
                  !n.is_read && 'bg-primary-500/[0.04]',
                )}
              >
                <div className="relative flex-shrink-0 mt-0.5">
                  <Image
                    src={view.avatar}
                    alt=""
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <span
                    aria-hidden
                    className="absolute -bottom-1 -right-1 text-xs leading-none bg-surface-dark rounded-full px-0.5 ring-1 ring-slate-800"
                  >
                    {(() => { const I = NOTIF_ICONS[view.icon]; return I ? <I className="w-3.5 h-3.5" /> : null; })()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm leading-snug', !n.is_read ? 'text-white' : 'text-slate-300')}>
                    {view.text}
                  </p>
                  {when && <p className="text-[11px] text-slate-500 mt-0.5">{when}</p>}
                </div>
                {!n.is_read && (
                  <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                )}
              </RowTag>
            );
          })
        )}
      </div>
    </div>
  );
}
