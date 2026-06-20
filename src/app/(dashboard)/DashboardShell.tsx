'use client';
import { Button, ToastProvider } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import Image from 'next/image';
import { useTranslation } from '@/context/TranslationContext';
import { usePresence, useNotifications, StreamWaiterProvider } from '@/context/StreamWaiterContext';
import { MoneyProvider } from '@/context/MoneyContext';
import { DropdownMenu } from '@/components/ui/Dropdown';
import { LayoutDashboard, Clock, DollarSign, Settings, LogOut, Menu, X, Bell, User, Users, Briefcase, Home } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';

// Loaded client-side only — WebGL requires browser APIs
const LiquidEther = dynamicImport(() => import('@/components/LiquidEther'), { ssr: false });

const BACKGROUND_COLORS = ['#EE5712', '#ff7340', '#C94A0D'];

function DashboardLayoutContent({ children, initialUser }: { children: React.ReactNode; initialUser: any }) {
  const { t } = useTranslation();
  const { currentUserStatus } = usePresence();
  const { notificationsCount, notifications, markRead } = useNotifications();
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
  const [bgReady, setBgReady] = useState(false);
  const sidebarNavRef = useRef<HTMLElement>(null);

  // Defer the WebGL background until the browser is idle after first paint, so its
  // one-time shader compilation / GPU buffer allocation doesn't stall the initial
  // content render (and the dashboard entrance animations) on load.
  useEffect(() => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setBgReady(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setBgReady(true), 1000);
    return () => clearTimeout(t);
  }, []);

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
          DEVELOPMENT NAVIGATOR: LIQUIDETHER WEBGL BACKGROUND
          Contains: Fixed full-bleed animated canvas behind all content
          (pointer-events-none so the UI stays fully interactive)
          ────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ opacity: bgReady ? 0.18 : 0, transition: 'opacity 600ms ease' }}
      >
        {bgReady && (
          <LiquidEther
            colors={BACKGROUND_COLORS}
            mouseForce={18}
            cursorSize={120}
            resolution={0.35}
            autoDemo={true}
            autoSpeed={0.28}
            autoIntensity={2.0}
            autoResumeDelay={3000}
            autoRampDuration={1.2}
            takeoverDuration={0.3}
            isBounce={false}
            isViscous={false}
            BFECC={true}
          />
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: DESKTOP SIDEBAR CONTAINER
          Contains: Logo, Main Nav, and User Mini Profile (Status indicator)
          ────────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 h-[calc(100vh-20px)] m-2.5 flex-shrink-0 transition-all duration-300 relative z-10">
        {/* Logo */}
        <div className="h-20 flex items-center px-6">
          <a href="/home" className="flex items-center gap-3 group">
            <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam" className="h-8 hidden" />
            <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-8 block" />
          </a>
        </div>

        {/* Sidebar surface — rounded bordered card begins at the nav bar */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-dark/90 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden">
        {/* Navigation */}
        <nav ref={sidebarNavRef} className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {/* Home */}
          <Button variant="unstyled"
            onClick={() => router.push('/home')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/home')}`}
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_home') || 'Home'}</span>
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

          {/* Settings */}
          <Button variant="unstyled"
            onClick={() => router.push('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/settings')}`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_settings')}</span>
          </Button>
        </nav>

        {/* User Mini Profile */}
        <div className="relative border-t border-slate-800/50 overflow-hidden">
          {/* Online Tracker Indicator background */}
          <div
            className="absolute inset-0 z-0 pointer-events-none transition-all duration-500"
            style={{ background: status.gradient }}
          ></div>

          <div className="p-4 relative z-10">
            <div className="flex items-center justify-between gap-3 px-3">
              <Button variant="unstyled"
                onClick={() => router.push('/me')}
                className="flex items-center gap-3 text-left group flex-grow min-w-0"
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
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate group-hover:text-primary-500 transition-colors">
                    {[currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.username}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                </div>
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
        <header className="h-[75px] shrink-0 bg-transparent border-b border-dashed border-slate-800 flex items-center justify-between px-6 z-40">
          <div className="flex items-center gap-4">
            <Button variant="unstyled"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
            <h2 className="text-sm font-bold text-slate-400 hidden sm:block">
              {pathname === '/dashboard' ? 'Welcome Back' : 'Zomzam Workspace'}
            </h2>
          </div>

          {/* Right Header: Notifications Dropdown */}
          <div className="flex items-center gap-3">
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
          DEVELOPMENT NAVIGATOR: MOBILE MENU OVERLAY (drawer)
          Contains: Dashboard link + Time / Money / CRM / Community nav groups,
          Settings and Sign Out actions (rendered only when mobileMenuOpen)
          ────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[75px] bg-slate-900/50 backdrop-blur-sm z-30">
          <div className="w-64 bg-surface-dark h-full border-r border-slate-800 p-6 flex flex-col space-y-4">
            {/* TEMPORARILY DISABLED: Dashboard Home — parked for later work
            <Button variant="unstyled"
              onClick={() => {
                router.push('/dashboard');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left block py-2.5 text-sm font-semibold text-slate-300"
            >
              Dashboard Home
            </Button>
            */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Time Suite</p>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/time/execution');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Pomodoro Focus
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/time/tasks');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Task Board
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Money Suite</p>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/money/dashboard');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Ledger Overview
              </Button>
            </div>
            {/* TEMPORARILY DISABLED: CRM Suite — parked for later work
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('nav_crm')}</p>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/crm');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                CRM Dashboard
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/crm/leads');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Lead Vault
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/crm/pipeline');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Kanban Pipeline
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/crm/contacts');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Client Profiles
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/crm/outreach');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Outreach AI
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/crm/projects');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Projects Hub
              </Button>
            </div>
            */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Community</p>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/community/friends');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Friends Grid
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/community/discover');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Discover People
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/community/requests');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Friend Requests
              </Button>
              <Button variant="unstyled"
                onClick={() => {
                  router.push('/community/following');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Connections & Follows
              </Button>
            </div>
            <Button variant="unstyled"
              onClick={() => {
                router.push('/settings');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left block py-2.5 text-sm font-semibold text-slate-300"
            >
              Settings
            </Button>
            <Button variant="unstyled"
              onClick={handleLogout}
              className="w-full text-left block py-2.5 text-sm font-semibold text-red-500"
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardShell({ children, initialUser }: { children: React.ReactNode; initialUser: any }) {
  return (
    <StreamWaiterProvider>
      <MoneyProvider>
        <ToastProvider>
          <DashboardLayoutContent initialUser={initialUser}>{children}</DashboardLayoutContent>
        </ToastProvider>
      </MoneyProvider>
    </StreamWaiterProvider>
  );
}
