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
import { RightSidebar } from '@/components/chat/RightSidebar';
import { NotificationToaster } from '@/components/chat/NotificationToaster';
import { DropdownMenu } from '@/components/ui/Dropdown';
import { LayoutDashboard, Clock, DollarSign, Settings, LogOut, Menu, Bell, Users, Briefcase, Home, MessageCircle, ListChecks, Compass, UserPlus, Heart, Sparkles, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils';

function DashboardLayoutContent({ children, initialUser }: { children: React.ReactNode; initialUser: any }) {
  const { t } = useTranslation();
  const { currentUserStatus } = usePresence();
  const { notificationsCount, notifications, markRead } = useNotifications();
  const { contacts, unreadTotal, openChat } = useMessages();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Seeded from the server (see layout.tsx). The proxy middleware already gates
  // every protected route, so by the time this renders the user is guaranteed
  // authenticated — no client-side auth fetch or loading spinner needed.
  const [currentUser] = useState<any>(initialUser);
  const [timeGroupOpen, setTimeGroupOpen] = useState(false);
  const [moneyGroupOpen, setMoneyGroupOpen] = useState(false);
  const [crmGroupOpen, setCrmGroupOpen] = useState(false);
  const [communityGroupOpen, setCommunityGroupOpen] = useState(false);
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

  // Auto-expand the nav section corresponding to current route on load
  useEffect(() => {
    if (pathname) {
      if (pathname.startsWith('/time/')) {
        setTimeGroupOpen(true);
      } else if (pathname.startsWith('/money/')) {
        setMoneyGroupOpen(true);
      } else if (pathname.startsWith('/crm')) {
        setCrmGroupOpen(true);
      } else if (pathname.startsWith('/community')) {
        setCommunityGroupOpen(true);
      }
    }
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

  // Flat mobile nav (Home first, then every live sub-page). Mirrors the
  // desktop sidebar minus the parked CRM/Dashboard suites.
  const mobileNavLinks: { label: string; path: string; Icon: LucideIcon }[] = [
    { label: t('nav_home') || 'Home', path: '/home', Icon: Home },
    { label: 'Pomodoro Focus', path: '/time/execution', Icon: Clock },
    { label: 'Task Board', path: '/time/tasks', Icon: ListChecks },
    { label: 'Ledger Overview', path: '/money/dashboard', Icon: DollarSign },
    { label: 'Friends Grid', path: '/community/friends', Icon: Users },
    { label: 'Discover People', path: '/community/discover', Icon: Compass },
    { label: 'Friend Requests', path: '/community/requests', Icon: UserPlus },
    { label: 'Connections & Follows', path: '/community/following', Icon: Heart },
    { label: 'Upgrade', path: '/pricing', Icon: Sparkles },
    { label: t('nav_settings') || 'Settings', path: '/settings', Icon: Settings },
  ];

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
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-[#111318] relative">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: AMBIENT BACKGROUND
          Contains: Fixed full-bleed static gradient behind all content.
          Replaces the former LiquidEther WebGL fluid sim (P3 perf pass): that
          ran a non-stop requestAnimationFrame fluid solver (~11s TBT, on every
          route, mobile and desktop) for an 18%-opacity effect almost nobody
          could see. This gradient is zero-cost — no JS, no compositor work, no
          battery drain. A faint slate lift up top + a soft bottom vignette add
          depth without any glow. pointer-events-none keeps the UI interactive.
          ────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, rgba(123,116,129,0.06) 0%, transparent 55%), ' +
            'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.22) 100%)',
        }}
      />

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: DESKTOP SIDEBAR CONTAINER
          Contains: Logo, Main Nav, and User Mini Profile (Status indicator)
          ────────────────────────────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col ${leftCollapsed ? 'w-[76px]' : 'w-64'} h-[calc(100vh-20px)] m-2.5 flex-shrink-0 transition-all duration-300 relative z-10`}>
        {/* Logo — wordmark when expanded, square mark when collapsed */}
        <div className={`h-20 flex items-center ${leftCollapsed ? 'justify-center' : 'px-6'}`}>
          <a href="/home" className="flex items-center group">
            {leftCollapsed ? (
              <img src="/Assets/Img/Icon-white.svg" alt="zomzam" className="h-8 w-8" />
            ) : (
              <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-8 block" />
            )}
          </a>
        </div>

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

          {/* Time Management Group */}
          <div className="space-y-1">
            <Button variant="unstyled"
              onClick={() => setTimeGroupOpen(!timeGroupOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <span>{t('nav_time')}</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </Button>
            {timeGroupOpen && (
              <div id="timeGroup" className="block pr-3 py-1">
                <div className="ml-5 pl-4 border-l border-slate-700 space-y-1">
                  <Button variant="unstyled"
                    onClick={() => router.push('/time/execution')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/execution')}`}
                  >
                    Pomodoro Timer
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/time/tasks')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/tasks')}`}
                  >
                    Task Board
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/time/planning')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/planning')}`}
                  >
                    Dream Planning
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/time/ideas')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/ideas')}`}
                  >
                    Idea Capture
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/time/tracker')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/tracker')}`}
                  >
                    Daily Tracker
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Money Management Group */}
          <div className="space-y-1">
            <Button variant="unstyled"
              onClick={() => setMoneyGroupOpen(!moneyGroupOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <span>{t('nav_money')}</span>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </Button>
            {moneyGroupOpen && (
              <div id="moneyGroup" className="block pr-3 py-1">
                <div className="ml-5 pl-4 border-l border-slate-700 space-y-1">
                  <Button variant="unstyled"
                    onClick={() => router.push('/money/dashboard')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/dashboard')}`}
                  >
                    Overview
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/money/expenses')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/expenses')}`}
                  >
                    Expenses
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/money/income')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/income')}`}
                  >
                    Income
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/money/accounts')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/accounts')}`}
                  >
                    Accounts
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/money/lend')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/lend')}`}
                  >
                    Lending
                  </Button>
                </div>
              </div>
            )}
          </div>

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

          {/* Dashboard * /}
          <Button variant="unstyled"
            onClick={() => router.push('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/dashboard')}`}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_dashboard')}</span>
          </Button>
              ────────────────────────────────────────────────────────── */}

          {/* Community Group */}
          <div className="space-y-1">
            <Button variant="unstyled"
              onClick={() => setCommunityGroupOpen(!communityGroupOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <span>{t('nav_community') || 'Community'}</span>
              <Users className="w-4 h-4 text-slate-400" />
            </Button>
            {communityGroupOpen && (
              <div id="communityGroup" className="block pr-3 py-1">
                <div className="ml-5 pl-4 border-l border-slate-700 space-y-1">
                  <Button variant="unstyled"
                    onClick={() => router.push('/community/friends')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer${isActive('/community/friends')}`}
                  >
                    Friends Grid
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/community/discover')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer${isActive('/community/discover')}`}
                  >
                    Discover People
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/community/requests')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer${isActive('/community/requests')}`}
                  >
                    Friend Requests
                  </Button>
                  <Button variant="unstyled"
                    onClick={() => router.push('/community/following')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer${isActive('/community/following')}`}
                  >
                    Connections & Follows
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Upgrade — unlock the paid CRM + Leads suite */}
          <Button variant="unstyled"
            onClick={() => router.push('/pricing')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-primary-400 rounded-lg hover:bg-primary-500/10 transition-colors${isActive('/pricing')}`}
          >
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <span>Upgrade</span>
          </Button>

          {/* Settings */}
          <Button variant="unstyled"
            onClick={() => router.push('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/settings')}`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_settings')}</span>
          </Button>
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
                onClick={() => router.push('/me')}
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
            DEVELOPMENT NAVIGATOR: MOBILE HEADER / TOP BAR
            Contains: Mobile drawer toggle, notifications Bell with dropdown
            ────────────────────────────────────────────────────────── */}
        <header className="relative h-[75px] shrink-0 bg-transparent border-b border-dashed border-slate-800 flex items-center justify-between px-6 z-40">
          <div className="flex items-center gap-4">
            {/* Mobile-only logo on the LEFT → home. Desktop has the logo in the
                sidebar, so this is gated md:hidden. The mobile menu toggle now
                lives in a bottom-left FAB (mirrors the bottom-right presence FAB). */}
            <Link
              href="/home"
              aria-label={t('nav_home') || 'Home'}
              className="md:hidden"
            >
              <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-7" />
            </Link>
            <h2 className="text-sm font-bold text-slate-400 hidden md:block">
              {pathname === '/dashboard' ? 'Welcome Back' : 'Zomzam Workspace'}
            </h2>
          </div>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: TOPBAR ACTIONS
              Contains: Messages dropdown (red dot + contacts list), Notifications bell
              ────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
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
              <div className="max-h-60 overflow-y-auto py-1">
                {notifications.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6 italic">No notifications yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="px-4 py-3 hover:bg-slate-800/30 flex gap-3 items-start border-b border-slate-800/40 last:border-b-0 cursor-pointer"
                    >
                      <Image
                        src={n.data?.from_avatar || '/Assets/Img/default-avatar.png'}
                        alt=""
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs">
                          <span className="font-bold">{n.data?.from_username}</span> {n.data?.message || 'sent you a message'}
                        </p>
                      </div>
                      {!n.is_read && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2"></span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </DropdownMenu>
          </div>
        </header>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: MAIN WORKSPACE CONTAINER
            Viewport-locked, scrollable area where dashboard pages render
            ────────────────────────────────────────────────────────── */}
        <main className="flex-grow overflow-y-auto relative p-6 md:p-8">
          {children}
        </main>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: RIGHT SIDEBAR (global)
          Messages + Active Now (presence) + Suggested. Desktop column + mobile
          drawer. Lifted out of /home so it's a persistent right navbar.
          ────────────────────────────────────────────────────────── */}
      <RightSidebar />

      {/* Global overlays: docked chat windows + live notification toasts. */}
      <ChatDock />
      <NotificationToaster />

      {/* Mobile menu FAB (bottom-LEFT) — mirrors the presence rail FAB at
          bottom-right. Hidden while the sheet is open (it covers this corner);
          the sheet closes via backdrop tap or swipe-down. */}
      <Button
        variant="unstyled"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open menu"
        className={`${mobileMenuOpen ? 'hidden' : 'md:hidden'} fixed bottom-5 left-5 z-[80] w-12 h-12 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-2xl shadow-primary-500/30 flex items-center justify-center transition-colors`}
      >
        <Menu className="w-5 h-5" />
      </Button>

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

        {/* Flat link list */}
        <nav className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-1 space-y-1">
          {mobileNavLinks.map(({ label, path, Icon }) => {
            const active = pathname === path;
            return (
              <Button
                key={path}
                variant="unstyled"
                onClick={() => goToMobile(path)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 min-h-[48px] rounded-2xl text-sm font-semibold transition-colors',
                  active
                    ? 'bg-primary-500/10 text-primary-500'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white',
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{label}</span>
              </Button>
            );
          })}

          {/* Sign Out */}
          <Button
            variant="unstyled"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 min-h-[48px] rounded-2xl text-sm font-semibold text-red-500 hover:bg-red-950/20 transition-colors"
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
