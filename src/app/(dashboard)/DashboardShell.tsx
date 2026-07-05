'use client';
import { Button } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from '@/context/TranslationContext';
import { usePresence, useNotifications, StreamWaiterProvider } from '@/context/StreamWaiterContext';
import { MoneyProvider } from '@/context/MoneyContext';
import { CurrentUserProvider } from '@/context/CurrentUserContext';
import { MessagesProvider, useMessages, type ChatContact } from '@/context/MessagesContext';
import { ChatDock } from '@/components/chat/ChatDock';
import { RightSidebar, SidebarBody } from '@/components/chat/RightSidebar';
import { NotificationToaster } from '@/components/chat/NotificationToaster';
import { DropdownMenu } from '@/components/ui/Dropdown';
import { Clock, DollarSign, Settings, LogOut, Menu, Bell, Users, Home, MessageCircle, Sparkles, Bookmark, ChevronLeft, ChevronRight, ChevronDown, Zap, Plus, type LucideIcon } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils';
import { describeNotification, notifTimeAgo } from '@/lib/notifications';

type NavGroupKey = 'time' | 'money' | 'community';

// One slot of the mobile bottom nav bar. 24px icon over a small label (app
// bottom-navbar guidelines); active = orange (stroke + faint fill + label);
// optional count badge (Messages unread / Notifications) rides the icon.
function BarTab({ Icon, label, active, badge, onClick }: {
  Icon: LucideIcon; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="relative flex-1 flex flex-col items-center justify-center gap-1 group"
    >
      <span className="relative">
        <Icon className={cn('w-6 h-6 transition-colors', active ? 'text-primary-500 fill-primary-500/20' : 'text-slate-400 group-hover:text-slate-200')} />
        {badge ? (
          <span className="absolute -top-1.5 left-full -translate-x-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary-500 text-white text-[9px] font-bold flex items-center justify-center">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span className={cn('text-[10px] font-bold leading-none transition-colors', active ? 'text-primary-500' : 'text-slate-500 group-hover:text-slate-300')}>
        {label}
      </span>
    </button>
  );
}

function DashboardLayoutContent({ children, initialUser }: { children: React.ReactNode; initialUser: any }) {
  const { t } = useTranslation();
  const { currentUserStatus } = usePresence();
  const { notificationsCount, notifications, markRead } = useNotifications();
  const { contacts, unreadTotal, openChat } = useMessages();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Auto-hide the phone bottom bar on scroll-down, reveal on scroll-up.
  const [barHidden, setBarHidden] = useState(false);
  const lastScrollY = useRef(0);
  // Seeded from the server (see layout.tsx). The proxy middleware already gates
  // every protected route, so by the time this renders the user is guaranteed
  // authenticated — no client-side auth fetch or loading spinner needed.
  const [currentUser] = useState<any>(initialUser);
  // Single-open accordion shared by the desktop sidebar and the mobile Menu
  // sheet: at most one section expanded at a time. null = all collapsed.
  const [openGroup, setOpenGroup] = useState<NavGroupKey | null>(null);
  const toggleGroup = (g: NavGroupKey) => setOpenGroup((cur) => (cur === g ? null : g));
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [msgDropdownOpen, setMsgDropdownOpen] = useState(false);
  const sidebarNavRef = useRef<HTMLElement>(null);

  // ── Collapsible left sidebar (icon-only) ────────────────────
  // Persisted so the choice survives reloads. When collapsed the rail narrows to
  // an icon strip; expandable groups collapse to a single icon that routes to the
  // group's primary page (full sub-lists only make sense at full width).
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  useEffect(() => {
    try { setLeftCollapsed(localStorage.getItem('zz-left-collapsed') === '1'); } catch {}
  }, []);
  const toggleLeft = () => setLeftCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem('zz-left-collapsed', next ? '1' : '0'); } catch {}
    return next;
  });

  // Flat icon nav used in collapsed mode (groups → their primary page).
  const collapsedNav: { Icon: LucideIcon; label: string; path: string; badge?: number }[] = [
    { Icon: Home, label: t('nav_home') || 'Home', path: '/home' },
    { Icon: Bookmark, label: 'Saved', path: '/saved' },
    { Icon: MessageCircle, label: 'Messages', path: '/messages', badge: unreadTotal },
    { Icon: Clock, label: t('nav_time') || 'Time', path: '/time/execution' },
    { Icon: DollarSign, label: t('nav_money') || 'Money', path: '/money/dashboard' },
    { Icon: Users, label: t('nav_community') || 'Community', path: '/community/friends' },
    { Icon: Sparkles, label: 'Upgrade', path: '/pricing' },
    { Icon: Settings, label: t('nav_settings') || 'Settings', path: '/settings' },
  ];

  // Open a docked chat window for a contact, then close the dropdown.
  const handleOpenContact = (c: ChatContact) => {
    openChat(
      {
        id: c.other_id,
        username: c.username,
        first_name: c.first_name,
        last_name: c.last_name,
        avatar: c.avatar,
        online_label: c.online_label,
        is_online: c.is_online,
      },
      c.conversation_id,
    );
    setMsgDropdownOpen(false);
  };

  // Mobile bottom-sheet swipe-to-dismiss. sheetDragY is the live finger
  // offset; we translate the sheet 1:1 during the drag (transition off via
  // the `dragging` flag), then on release dismiss past the threshold or
  // snap back. Pure pointer events — no gesture library, transform-only.
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDrag = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });

  // Auto-expand the nav section corresponding to the current route on load.
  // Single-open: landing on a section's page opens it (and collapses the rest).
  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/time/')) setOpenGroup('time');
    else if (pathname.startsWith('/money/')) setOpenGroup('money');
    else if (pathname.startsWith('/community')) setOpenGroup('community');
  }, [pathname]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth?action=logout', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        router.push('/sign');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const isActive = (path: string) => {
    return pathname === path ? 'nav-link-active' : '';
  };

  // Navigate from the mobile sheet, then dismiss it.
  const goToMobile = (path: string) => {
    router.push(path);
    setMobileMenuOpen(false);
  };

  // Direction-aware auto-hide for the bottom bar. The dashboard scrolls inside
  // <main>, not the window, so this rides main's onScroll. Hide once scrolled
  // past the bar's own height; small deltas are ignored to avoid jitter.
  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    if (Math.abs(y - lastScrollY.current) < 4) return;
    setBarHidden(y > lastScrollY.current && y > 30);
    lastScrollY.current = y;
  };

  // Reveal the bar (and reset the tracker) on every route change.
  useEffect(() => { setBarHidden(false); lastScrollY.current = 0; }, [pathname]);

  // Bottom-bar center ➕. The composer state lives in /home's page; reach it via
  // a same-route window event, or route there with a flag the page reads once.
  const handleCreate = () => {
    if (pathname === '/home') window.dispatchEvent(new CustomEvent('zz:open-composer'));
    else router.push('/home?compose=1');
  };

  // The three live collapsible suites — one source of truth for the desktop
  // sidebar AND the mobile Menu sheet (both render them via renderNavSection).
  const NAV_GROUPS: { key: NavGroupKey; label: string; Icon: LucideIcon; items: { label: string; path: string }[] }[] = [
    {
      key: 'time', label: t('nav_time') || 'Time', Icon: Clock, items: [
        { label: 'Pomodoro Timer', path: '/time/execution' },
        { label: 'Task Board', path: '/time/tasks' },
        { label: 'Dream Planning', path: '/time/planning' },
        { label: 'Idea Capture', path: '/time/ideas' },
        { label: 'Daily Tracker', path: '/time/tracker' },
      ],
    },
    {
      key: 'money', label: t('nav_money') || 'Money', Icon: DollarSign, items: [
        { label: 'Overview', path: '/money/dashboard' },
        { label: 'Expenses', path: '/money/expenses' },
        { label: 'Income', path: '/money/income' },
        { label: 'Accounts', path: '/money/accounts' },
        { label: 'Lending', path: '/money/lend' },
      ],
    },
    {
      key: 'community', label: t('nav_community') || 'Community', Icon: Users, items: [
        { label: 'Connections', path: '/community/friends' },
        { label: 'Discover People', path: '/community/discover' },
        { label: 'Invitations', path: '/community/requests' },
      ],
    },
  ];

  // One accordion section, styled for the desktop sidebar (compact) or the
  // mobile Menu sheet (larger touch targets). Single-open via openGroup; the
  // body uses the CSS grid-rows 0fr↔1fr height trick (no JS) and honours
  // reduce-motion. Active sub-item = filled dot + orange text (calm, no pill).
  const renderNavSection = (group: typeof NAV_GROUPS[number], mobile = false) => {
    const isOpen = openGroup === group.key;
    return (
      <div key={group.key} className="space-y-1">
        <Button variant="unstyled"
          onClick={() => toggleGroup(group.key)}
          aria-expanded={isOpen}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl text-slate-200 font-semibold hover:bg-slate-800/50 transition-colors',
            mobile ? 'px-4 min-h-[48px] text-sm' : 'px-3 py-2.5 text-sm',
          )}
        >
          <group.Icon className="w-5 h-5 flex-shrink-0 text-slate-400" />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown className={cn('w-4 h-4 text-slate-500 transition-transform duration-300 motion-reduce:transition-none', isOpen && 'rotate-180')} />
        </Button>
        <div className={cn('grid transition-all duration-300 ease-out motion-reduce:transition-none', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
          <div className="overflow-hidden">
            <div className="ml-5 pl-4 border-l border-slate-700/70 space-y-1 py-1">
              {group.items.map((it) => {
                const active = pathname === it.path;
                return (
                  <Button key={it.path} variant="unstyled"
                    onClick={() => (mobile ? goToMobile(it.path) : router.push(it.path))}
                    className={cn(
                      'w-full text-left flex items-center gap-2.5 rounded-lg transition-colors',
                      mobile ? 'px-3 min-h-[40px] text-sm' : 'px-3 py-2 text-xs font-medium',
                      active ? 'text-primary-500 font-semibold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white',
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors', active ? 'bg-primary-500' : 'bg-slate-600')} />
                    <span>{it.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Bottom-sheet drag handlers (attached to the grab handle only, so the
  //    scrollable link list underneath is never hijacked) ──
  const SHEET_DISMISS_THRESHOLD = 80; // px dragged before we close
  const handleSheetPointerDown = (e: React.PointerEvent) => {
    sheetDrag.current = { startY: e.clientY, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleSheetPointerMove = (e: React.PointerEvent) => {
    if (!sheetDrag.current.active) return;
    const dy = e.clientY - sheetDrag.current.startY;
    setSheetDragY(dy > 0 ? dy : 0); // only downward drags count
  };
  const handleSheetPointerUp = () => {
    if (!sheetDrag.current.active) return;
    sheetDrag.current.active = false;
    if (sheetDragY > SHEET_DISMISS_THRESHOLD) setMobileMenuOpen(false);
    setSheetDragY(0);
  };

  const handleNotificationToggle = () => {
    setNotifDropdownOpen((prev) => {
      if (!prev) markRead();
      return !prev;
    });
  };

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: SIDEBAR STAGGER ENTRANCE (GSAP)
  // Nav items slide from x:-18 once currentUser resolves.
  // dependencies:[!!currentUser] → fires exactly once on auth resolve,
  // not on mobileMenuOpen, group-toggle, or notification re-renders.
  // ──────────────────────────────────────────────────────────
  useGSAP(() => {
    const nav = sidebarNavRef.current;
    if (!nav || !currentUser) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const items = gsap.utils.toArray<HTMLElement>('button, a[href]', nav);
      if (!items.length) return;

      gsap.from(items, {
        autoAlpha: 0,
        x: -18,
        duration: 0.42,
        ease: 'power2.out',
        stagger: { amount: 0.45, from: 'start' },
      });
    });
  }, { scope: sidebarNavRef, dependencies: [!!currentUser] });

  // Visual config for the sidebar user-status indicator (dot, pill, glow, shine)
  const STATUS_CONFIG: Record<string, {
    label: string;
    dot: string;
    ring: string;
    pill: string;
    glow: string;
    gradient: string;
    animate: boolean;
  }> = {
    online: {
      label: 'Online Mode',
      dot: 'bg-green-500',
      ring: 'bg-green-400',
      pill: 'bg-green-500/15 border-green-500/40 text-green-300',
      glow: 'shadow-[0_0_12px_3px_rgba(34,197,94,0.7)]',
      gradient: 'linear-gradient(to top, rgba(34, 197, 94, 0.18) 0%, transparent 100%)',
      animate: true,
    },
    away: {
      label: 'Away',
      dot: 'bg-amber-400',
      ring: 'bg-amber-300',
      pill: 'bg-amber-400/15 border-amber-400/40 text-amber-200',
      glow: 'shadow-[0_0_12px_3px_rgba(251,191,36,0.7)]',
      gradient: 'linear-gradient(to top, rgba(251, 191, 36, 0.18) 0%, transparent 100%)',
      animate: true,
    },
    offline: {
      label: 'Offline',
      dot: 'bg-slate-400',
      ring: 'bg-slate-400',
      pill: 'bg-slate-500/10 border-slate-600/40 text-slate-400',
      glow: '',
      gradient: 'linear-gradient(to top, rgba(100, 116, 139, 0.12) 0%, transparent 100%)',
      animate: false,
    },
  };
  const status = STATUS_CONFIG[currentUserStatus] ?? STATUS_CONFIG.offline;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--shell-mid)] relative">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: AMBIENT BACKGROUND
          One cohesive, full-bleed linear gradient shared by EVERY dashboard
          route (the shell wraps them all), so the whole app reads as a single
          surface instead of a flat slab. Dark charcoal gradient (var --shell-*)
          in the same family as the cards — a touch deeper so cards float — with a
          soft Zomzam-orange glow bleeding down from the top (the old-design accent). Fixed
          + zero-cost (no JS/WebGL — the old LiquidEther fluid sim was removed in
          the P3 perf pass). pointer-events-none keeps the UI interactive.
          Translucent sidebars (surface-dark/90) sit over it and pick up the
          gradient, tying the chrome to the page.
          ────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(100% 55% at 50% -6%, rgba(238, 87, 18, 0.10) 0%, transparent 60%), ' +
            'linear-gradient(180deg, var(--shell-top) 0%, var(--shell-mid) 52%, var(--shell-bottom) 100%)',
        }}
      />

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: TOP NAVIGATION BAR (full-width)
          Contains: Zomzam wordmark (top-left → home), Messages dropdown,
          Notifications bell. Spans 100% viewport width and sits ABOVE both side
          rails, which now stack beneath it. Shared by every dashboard route.
          ────────────────────────────────────────────────────────── */}
      <header className="relative h-[75px] shrink-0 bg-transparent border-b border-dashed border-slate-800 flex items-center justify-between px-4 md:px-6 z-40">
        {/* Brand — top-left wordmark, routes home on every breakpoint (the
            sidebar no longer carries the logo; it lives here for the whole app). */}
        <Link
          href="/home"
          aria-label={t('nav_home') || 'Home'}
          className="flex items-center group flex-shrink-0"
        >
          <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-7 md:h-8 block" />
        </Link>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: TOPBAR ACTIONS
            Contains: Messages dropdown (red dot + contacts list), Notifications bell.
            Hidden on phone (<md) — Messages + Notifications live on the bottom
            nav bar there; shown on tablet/desktop which have no bottom bar.
            ────────────────────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          {/* Messages */}
          <DropdownMenu
            open={msgDropdownOpen}
            onClose={() => setMsgDropdownOpen(false)}
            align="right"
            trigger={
              <Button variant="unstyled"
                onClick={() => setMsgDropdownOpen((p) => !p)}
                className="relative p-2.5 bg-slate-800/40 rounded-xl text-slate-500 hover:text-primary-500 transition-colors border border-slate-800/60"
                aria-expanded={msgDropdownOpen}
                aria-label="Open messages"
                type="button"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadTotal > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-md shadow-red-500/50"></span>
                )}
              </Button>
            }
          >
            <div className="py-3 w-72">
              <div className="px-4 pb-2 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold">Messages</span>
                <Button variant="unstyled"
                  onClick={() => { setMsgDropdownOpen(false); router.push('/messages'); }}
                  className="text-[10px] font-bold text-primary-500 hover:text-primary-400 transition-colors"
                >
                  Open Messenger
                </Button>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {contacts.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6 italic">
                    No friends yet — connect to start chatting.
                  </p>
                ) : (
                  contacts.map((c) => (
                    <button
                      key={c.other_id}
                      onClick={() => handleOpenContact(c)}
                      className="w-full px-4 py-2.5 hover:bg-slate-800/30 flex gap-3 items-center border-b border-slate-800/40 last:border-b-0 cursor-pointer text-left"
                    >
                      <div className="relative flex-shrink-0">
                        <Image
                          src={c.avatar || '/Assets/Img/default-avatar.png'}
                          alt=""
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-800"
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1D24] ${c.is_online ? (c.is_idle ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${c.unread_count > 0 ? 'font-bold text-white' : 'font-semibold text-slate-300'}`}>
                          {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}
                        </p>
                        <p className={`text-[11px] truncate ${c.unread_count > 0 ? 'text-slate-300 font-medium' : 'text-slate-600'}`}>
                          {c.last_message
                            ? `${c.last_sender_id === currentUser?.id ? 'You: ' : ''}${c.last_message}`
                            : 'Start a conversation'}
                        </p>
                      </div>
                      {c.unread_count > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {c.unread_count}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </DropdownMenu>

          {/* Notifications */}
          <DropdownMenu
          open={notifDropdownOpen}
          onClose={() => setNotifDropdownOpen(false)}
          align="right"
          trigger={
            <Button variant="unstyled"
              onClick={handleNotificationToggle}
              className="relative p-2.5 bg-slate-800/40 rounded-xl text-slate-500 hover:text-primary-500 transition-colors border border-slate-800/60"
              aria-expanded={notifDropdownOpen}
              aria-label="Open notifications"
              type="button"
            >
              <Bell className="w-5 h-5" />
              {notificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full animate-pulse shadow-md shadow-primary-500/50"></span>
              )}
            </Button>
          }
        >
          <div className="py-3">
            <div className="px-4 pb-2 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold">Notifications</span>
              {notificationsCount > 0 && (
                <span className="px-2 py-0.5 bg-primary-500/10 text-primary-500 text-[9px] font-black rounded-full">
                  {notificationsCount} New
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {notifications.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6 italic">No notifications yet.</p>
              ) : (
                notifications.map((n) => {
                  const view = describeNotification(n);
                  const when = notifTimeAgo(n.created_at);
                  // Each row deep-links to where it actually happened (the post,
                  // the follower's profile, the inbox). Rows without a known
                  // destination fall back to a static, non-navigating element so
                  // a dead click never lands the user on a 404.
                  const RowTag: any = view.href ? Link : 'div';
                  const rowProps = view.href
                    ? { href: view.href, onClick: () => setNotifDropdownOpen(false) }
                    : {};
                  return (
                    <RowTag
                      key={n.id}
                      {...rowProps}
                      className={cn(
                        'group px-4 py-3 flex gap-3 items-start border-b border-slate-800/40 last:border-b-0 transition-colors',
                        view.href ? 'cursor-pointer hover:bg-slate-800/40' : 'cursor-default',
                        !n.is_read && 'bg-primary-500/[0.04]',
                      )}
                    >
                      <div className="relative flex-shrink-0 mt-0.5">
                        <Image
                          src={view.avatar}
                          alt=""
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        <span
                          aria-hidden
                          className="absolute -bottom-1 -right-1 text-[11px] leading-none bg-surface-dark rounded-full px-0.5 ring-1 ring-slate-800"
                        >
                          {view.emoji}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs leading-snug', !n.is_read ? 'text-white' : 'text-slate-300')}>
                          {view.text}
                        </p>
                        {when && <p className="text-[10px] text-slate-500 mt-0.5">{when}</p>}
                      </div>
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                      )}
                    </RowTag>
                  );
                })
              )}
            </div>
            {/* Shares one render path with the /notifications page (the mobile
                bottom-bar target). */}
            <div className="px-4 pt-2 border-t border-slate-800">
              <Link
                href="/notifications"
                onClick={() => setNotifDropdownOpen(false)}
                className="block text-center text-[10px] font-bold uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors py-1"
              >
                See all
              </Link>
            </div>
          </div>
        </DropdownMenu>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: WORKSPACE ROW (rails + content)
          Fills the height below the full-width top bar and lays out the left
          sidebar, the scrollable main column, and the right sidebar side by
          side (stacked to a single column on phone, where both rails hide).
          ────────────────────────────────────────────────────────── */}
      <div className="flex-grow flex flex-col md:flex-row min-h-0 relative">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: DESKTOP SIDEBAR CONTAINER
          Contains: Main Nav and User Mini Profile (Status indicator). The logo
          now lives in the full-width top bar, so this rail starts at its nav card.
          ────────────────────────────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col ${leftCollapsed ? 'w-[76px]' : 'w-64'} h-[calc(100vh-95px)] m-2.5 flex-shrink-0 transition-all duration-300 relative z-10`}>
        {/* Sidebar surface — rounded bordered card begins at the nav bar */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-dark/90 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden">
        {/* Navigation */}
        <nav ref={sidebarNavRef} className={`flex-1 py-6 space-y-2 overflow-y-auto no-scrollbar ${leftCollapsed ? 'px-2' : 'px-4'}`}>
          {leftCollapsed ? (
            collapsedNav.map(({ Icon, label, path, badge }) => (
              <Button key={path} variant="unstyled"
                onClick={() => router.push(path)}
                title={label}
                aria-label={label}
                className={`relative w-full flex items-center justify-center h-11 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors${isActive(path)}`}
              >
                <Icon className="w-5 h-5" />
                {badge ? (
                  <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary-500 text-white text-[9px] font-bold flex items-center justify-center">{badge}</span>
                ) : null}
              </Button>
            ))
          ) : (
          <>
          {/* Home */}
          <Button variant="unstyled"
            onClick={() => router.push('/home')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/home')}`}
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_home') || 'Home'}</span>
          </Button>

          {/* Saved */}
          <Button variant="unstyled"
            onClick={() => router.push('/saved')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/saved')}`}
          >
            <Bookmark className="w-5 h-5 flex-shrink-0" />
            <span>Saved</span>
          </Button>

          {/* Messages */}
          <Button variant="unstyled"
            onClick={() => router.push('/messages')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/messages')}`}
          >
            <MessageCircle className="w-5 h-5 flex-shrink-0" />
            <span>Messages</span>
            {unreadTotal > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadTotal}
              </span>
            )}
          </Button>

          {/* Time + Money suites (single-open accordions) */}
          {renderNavSection(NAV_GROUPS[0])}
          {renderNavSection(NAV_GROUPS[1])}

          {/* ──────────────────────────────────────────────────────────
              TEMPORARILY DISABLED: CRM SUITE + DASHBOARD
              Both features are parked for later work. Re-enable by
              uncommenting the block below (and the matching mobile-menu
              + auto-expand sections).
              ──────────────────────────────────────────────────────────
          {/* CRM Management Group * /}
          <div className="space-y-1">
            <Button variant="unstyled"
              onClick={() => setCrmGroupOpen(!crmGroupOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <span>{t('nav_crm')}</span>
              <Briefcase className="w-4 h-4 text-slate-400" />
            </Button>
            {crmGroupOpen && (
              <div id="crmGroup" className="block pr-3 py-1">
                <div className="ml-5 pl-4 border-l border-slate-700 space-y-1">
                  <Button variant="unstyled"
                    onClick={() => router.push('/crm')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm')}`}
                  >
                    CRM Dashboard
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/crm/leads')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/leads')}`}
                  >
                    Lead Vault
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/crm/pipeline')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/pipeline')}`}
                  >
                    Kanban Pipeline
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/crm/contacts')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/contacts')}`}
                  >
                    Client Profiles
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/crm/outreach')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/outreach')}`}
                  >
                    Outreach AI
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/crm/projects')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/projects')}`}
                  >
                    Projects Hub
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Community suite (single-open accordion) */}
          {renderNavSection(NAV_GROUPS[2])}

          {/* Settings */}
          <Button variant="unstyled"
            onClick={() => router.push('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/settings')}`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_settings')}</span>
          </Button>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: UPGRADE PLAN CARD
              Contains: current-plan badge, value copy, "Upgrade to Pro" CTA
              ────────────────────────────────────────────────────────── */}
          <div className="mt-2 rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/10 via-primary-500/[0.06] to-transparent p-3.5 shadow-apple-sm">
            {/* Current-plan badge row */}
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-500/25">
                <Sparkles className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 leading-tight">Current plan:</p>
                <p className="text-sm font-bold text-white leading-tight">Free</p>
              </div>
            </div>

            {/* Value copy */}
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Upgrade to Pro to get the latest and exclusive features
            </p>

            {/* CTA */}
            <Button variant="unstyled"
              onClick={() => router.push('/pricing')}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-white rounded-xl bg-primary-500 hover:bg-primary-600 shadow-apple-sm transition-colors cursor-pointer"
            >
              <Zap className="w-4 h-4 flex-shrink-0" />
              <span>Upgrade to Pro</span>
            </Button>
          </div>
          </>
          )}
        </nav>

        {/* Collapse toggle — narrows the rail to icons only (persisted) */}
        <button
          type="button"
          onClick={toggleLeft}
          aria-label={leftCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={leftCollapsed ? 'Expand' : 'Collapse'}
          className={`mx-2 mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors ${leftCollapsed ? 'justify-center' : ''}`}
        >
          {leftCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs font-semibold">Collapse</span>
            </>
          )}
        </button>

        {/* User Mini Profile */}
        <div className="relative border-t border-slate-800/50 overflow-hidden">
          {/* Online Tracker Indicator background */}
          <div
            className="absolute inset-0 z-0 pointer-events-none transition-all duration-500"
            style={{ background: status.gradient }}
          ></div>

          <div className="p-4 relative z-10">
            <div className={`flex gap-3 ${leftCollapsed ? 'flex-col items-center' : 'items-center justify-between px-3'}`}>
              <Button variant="unstyled"
                onClick={() => router.push(`/u/${currentUser.username}`)}
                title={[currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.username}
                className={`flex items-center gap-3 text-left group min-w-0 ${leftCollapsed ? '' : 'flex-grow'}`}
              >
                {/* Avatar with live status dot anchored 2px outside the bottom-right of the frame */}
                <div className="relative flex-shrink-0">
                  <Image
                    src={currentUser.avatar || '/Assets/Img/default-avatar.png'}
                    alt="Avatar"
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-xl object-cover border border-slate-800"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3 h-3">
                    {status.animate && (
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${status.ring}`} />
                    )}
                    <span className={`relative inline-flex w-3 h-3 rounded-full ${status.dot} ${status.glow}`} />
                  </span>
                </div>
                {!leftCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-primary-500 transition-colors">
                      {[currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.username}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                  </div>
                )}
              </Button>
              <Button variant="unstyled"
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title={t('nav_logout')}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: MAIN WORKSPACE CONTAINER
            Viewport-locked, scrollable area where dashboard pages render
            ────────────────────────────────────────────────────────── */}
        {/* pb on phone clears the fixed bottom nav bar (+ safe area). */}
        <main onScroll={handleMainScroll} className="flex-grow overflow-y-auto relative p-6 md:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: RIGHT SIDEBAR (global)
          Messages + Active Now (presence) + Suggested. Desktop column + mobile
          drawer. Lifted out of /home so it's a persistent right navbar.
          ────────────────────────────────────────────────────────── */}
      <RightSidebar />

      </div>{/* /workspace row */}

      {/* Global overlays: docked chat windows + live notification toasts. */}
      <ChatDock />
      <NotificationToaster />

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: MOBILE BOTTOM NAV BAR (phone-only)
          Contains: Home, Messages (unread badge), raised ➕ Create, Notifications
          (count badge), Menu (opens the sheet). Twitter/IG-style. Phone-only
          (md:hidden) — tablet/desktop use the left sidebar. Safe-area padded.
          ────────────────────────────────────────────────────────── */}
      <nav
        aria-label="Primary"
        className={cn(
          'md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-dark/90 backdrop-blur-xl rounded-t-[28px] border-t border-x border-slate-800 pb-[env(safe-area-inset-bottom)]',
          'transition-transform duration-300 ease-out motion-reduce:transition-none',
          barHidden ? 'translate-y-full' : 'translate-y-0',
        )}
      >
        <div className="flex items-stretch justify-around h-[72px] px-1">
          <BarTab Icon={Home} label="Home" active={pathname === '/home'} onClick={() => router.push('/home')} />
          <BarTab Icon={MessageCircle} label="Messages" active={pathname.startsWith('/messages')} badge={unreadTotal} onClick={() => router.push('/messages')} />

          {/* Raised center Create — breaks above the bar line. No drop shadow;
              an inset top highlight + bottom shade gives it soft physical depth. */}
          <div className="flex items-center justify-center px-1">
            <Button
              variant="unstyled"
              onClick={handleCreate}
              aria-label="Create post"
              className="-mt-10 w-16 h-16 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-[inset_0_2px_3px_rgba(255,255,255,0.3),inset_0_-3px_5px_rgba(0,0,0,0.3)] flex items-center justify-center transition-colors active:scale-95 ring-4 ring-surface-dark"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>

          <BarTab Icon={Bell} label="Notifications" active={pathname === '/notifications'} badge={notificationsCount} onClick={() => router.push('/notifications')} />
          <BarTab Icon={Menu} label="Menu" active={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)} />
        </div>
      </nav>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: MOBILE NAV BOTTOM SHEET
          Contains: dimmed backdrop, swipe-to-dismiss grab handle, flat link
          list (Home → live sub-pages → Settings) and Sign Out action.
          ──────────────────────────────────────────────────────────
          Always mounted (md:hidden) so open/close animate via CSS transform
          alone — no JS on idle. Backdrop tap or swipe-down closes it. */}

      {/* Backdrop */}
      <div
        aria-hidden={!mobileMenuOpen}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300',
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[70vh]',
          'bg-surface-dark border-t border-slate-800 rounded-t-3xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          mobileMenuOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        style={
          sheetDragY > 0
            ? { transform: `translateY(${sheetDragY}px)`, transition: 'none' }
            : undefined
        }
      >
        {/* Grab handle — the only drag surface, so the list scrolls freely */}
        <div
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={handleSheetPointerUp}
          className="flex-shrink-0 flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
        >
          <span className="w-10 h-1.5 rounded-full bg-slate-700" />
        </div>

        {/* Sectioned menu — mirrors the desktop sidebar (profile · Saved ·
            suites · Upgrade · Active Now · Settings · Sign out). */}
        <nav className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-1 space-y-1">
          {/* Profile header → own profile (the only profile entry point on phone) */}
          <Button
            variant="unstyled"
            onClick={() => goToMobile(`/u/${currentUser.username}`)}
            className="w-full flex items-center gap-3 px-3 py-2 mb-1 rounded-2xl hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="relative flex-shrink-0">
              <Image
                src={currentUser.avatar || '/Assets/Img/default-avatar.png'}
                alt="Avatar"
                width={44}
                height={44}
                className="w-11 h-11 rounded-2xl object-cover border border-slate-800"
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-dark ${status.dot}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {[currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.username}
              </p>
              <p className="text-[11px] text-slate-500 truncate">View profile</p>
            </div>
          </Button>

          {/* Saved */}
          <Button
            variant="unstyled"
            onClick={() => goToMobile('/saved')}
            className={cn(
              'w-full flex items-center gap-3 px-4 min-h-[48px] rounded-2xl text-sm font-semibold transition-colors',
              pathname === '/saved' ? 'bg-primary-500/10 text-primary-500' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white',
            )}
          >
            <Bookmark className="w-5 h-5 flex-shrink-0" />
            <span>Saved</span>
          </Button>

          {/* Live suites (single-open accordions, larger touch targets) */}
          {renderNavSection(NAV_GROUPS[0], true)}
          {renderNavSection(NAV_GROUPS[1], true)}
          {renderNavSection(NAV_GROUPS[2], true)}

          {/* Upgrade — compact gradient card (mirrors the desktop card) */}
          <div className="my-2 rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/10 via-primary-500/[0.06] to-transparent p-3.5 shadow-apple-sm">
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-500/25">
                <Sparkles className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 leading-tight">Current plan:</p>
                <p className="text-sm font-bold text-white leading-tight">Free</p>
              </div>
            </div>
            <Button
              variant="unstyled"
              onClick={() => goToMobile('/pricing')}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-white rounded-xl bg-primary-500 hover:bg-primary-600 shadow-apple-sm transition-colors"
            >
              <Zap className="w-4 h-4 flex-shrink-0" />
              <span>Upgrade to Pro</span>
            </Button>
          </div>

          {/* Settings */}
          <Button
            variant="unstyled"
            onClick={() => goToMobile('/settings')}
            className={cn(
              'w-full flex items-center gap-3 px-4 min-h-[48px] rounded-2xl text-sm font-semibold transition-colors',
              pathname === '/settings' ? 'bg-primary-500/10 text-primary-500' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white',
            )}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_settings') || 'Settings'}</span>
          </Button>

          {/* Active Now + Suggested — folded in from the right sidebar (no phone
              FAB). Mounted only once the sheet opens so its /discover fetch never
              fires on page load (it would otherwise race the feed's initial load
              on every phone navigation, even for users who never open the menu). */}
          {mobileMenuOpen && (
            <div className="pt-2 mt-1 border-t border-slate-800/60">
              <SidebarBody onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          )}

          {/* Sign Out */}
          <Button
            variant="unstyled"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 min-h-[48px] mt-1 rounded-2xl text-sm font-semibold text-red-500 hover:bg-red-950/20 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_logout') || 'Sign Out'}</span>
          </Button>
        </nav>
      </div>
    </div>
  );
}

export function DashboardShell({ children, initialUser }: { children: React.ReactNode; initialUser: any }) {
  return (
    <CurrentUserProvider user={initialUser}>
      <StreamWaiterProvider>
        <MessagesProvider>
          <MoneyProvider>
            <DashboardLayoutContent initialUser={initialUser}>{children}</DashboardLayoutContent>
          </MoneyProvider>
        </MessagesProvider>
      </StreamWaiterProvider>
    </CurrentUserProvider>
  );
}
