'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import { useTranslation } from '@/context/TranslationContext';
import { useStreamWaiter, StreamWaiterProvider } from '@/context/StreamWaiterContext';
import { MoneyProvider } from '@/context/MoneyContext';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { LayoutDashboard, Clock, DollarSign, Settings, LogOut, Menu, X, Bell, User, Users, Briefcase } from 'lucide-react';

// Loaded client-side only — WebGL requires browser APIs
const LiquidEther = dynamicImport(() => import('@/components/LiquidEther'), { ssr: false });

const BACKGROUND_COLORS = ['#EE5712', '#ff7340', '#C94A0D'];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { currentUserStatus, notificationsCount, notifications, markRead } = useStreamWaiter();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [timeGroupOpen, setTimeGroupOpen] = useState(false);
  const [moneyGroupOpen, setMoneyGroupOpen] = useState(false);
  const [crmGroupOpen, setCrmGroupOpen] = useState(false);
  const [communityGroupOpen, setCommunityGroupOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

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

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth?action=check');
        const data = await res.json();
        if (data.success && data.authenticated) {
          setCurrentUser(data.user);
        } else {
          router.push('/sign');
        }
      } catch {
        router.push('/sign');
      }
    };
    fetchUser();
  }, [router]);

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

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dark">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-[#111318] relative">

      {/* ── LiquidEther WebGL background ── */}
      {/* Fixed behind all content; pointer-events-none so UI stays fully interactive */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ opacity: 0.18 }}
      >
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
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: DESKTOP SIDEBAR CONTAINER
          Contains: Logo, Main Nav, and User Mini Profile (Status indicator)
          ────────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-dark/90 backdrop-blur-xl border border-slate-800 h-[calc(100vh-20px)] rounded-3xl m-2.5 flex-shrink-0 transition-all duration-300 relative z-10 overflow-hidden">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-dashed border-slate-800/80">
          <a href="/dashboard" className="flex items-center gap-3 group">
            <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam" className="h-8 hidden" />
            <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-8 block" />
          </a>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <button
            onClick={() => router.push('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/dashboard')}`}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_dashboard')}</span>
          </button>

          {/* Time Management Group */}
          <div className="space-y-1">
            <button
              onClick={() => setTimeGroupOpen(!timeGroupOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <span>{t('nav_time')}</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </button>
            {timeGroupOpen && (
              <div id="timeGroup" className="block pr-3 py-1">
                <div className="ml-5 pl-4 border-l border-slate-700 space-y-1">
                  <button
                    onClick={() => router.push('/time/execution')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/execution')}`}
                  >
                    Pomodoro Timer
                  </button>
                  <button
                    onClick={() => router.push('/time/tasks')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/tasks')}`}
                  >
                    Task Board
                  </button>
                  <button
                    onClick={() => router.push('/time/planning')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/planning')}`}
                  >
                    Dream Planning
                  </button>
                  <button
                    onClick={() => router.push('/time/ideas')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/ideas')}`}
                  >
                    Idea Capture
                  </button>
                  <button
                    onClick={() => router.push('/time/tracker')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/time/tracker')}`}
                  >
                    Daily Tracker
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Money Management Group */}
          <div className="space-y-1">
            <button
              onClick={() => setMoneyGroupOpen(!moneyGroupOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <span>{t('nav_money')}</span>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </button>
            {moneyGroupOpen && (
              <div id="moneyGroup" className="block pr-3 py-1">
                <div className="ml-5 pl-4 border-l border-slate-700 space-y-1">
                  <button
                    onClick={() => router.push('/money/dashboard')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/dashboard')}`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => router.push('/money/expenses')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/expenses')}`}
                  >
                    Expenses
                  </button>
                  <button
                    onClick={() => router.push('/money/income')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/income')}`}
                  >
                    Income
                  </button>
                  <button
                    onClick={() => router.push('/money/accounts')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/accounts')}`}
                  >
                    Accounts
                  </button>
                  <button
                    onClick={() => router.push('/money/lend')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/money/lend')}`}
                  >
                    Lending
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CRM Management Group */}
          <div className="space-y-1">
            <button
              onClick={() => setCrmGroupOpen(!crmGroupOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <span>{t('nav_crm')}</span>
              <Briefcase className="w-4 h-4 text-slate-400" />
            </button>
            {crmGroupOpen && (
              <div id="crmGroup" className="block pr-3 py-1">
                <div className="ml-5 pl-4 border-l border-slate-700 space-y-1">
                  <button
                    onClick={() => router.push('/crm')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm')}`}
                  >
                    CRM Dashboard
                  </button>
                  <button
                    onClick={() => router.push('/crm/leads')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/leads')}`}
                  >
                    Lead Vault
                  </button>
                  <button
                    onClick={() => router.push('/crm/pipeline')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/pipeline')}`}
                  >
                    Kanban Pipeline
                  </button>
                  <button
                    onClick={() => router.push('/crm/contacts')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/contacts')}`}
                  >
                    Client Profiles
                  </button>
                  <button
                    onClick={() => router.push('/crm/outreach')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/outreach')}`}
                  >
                    Outreach AI
                  </button>
                  <button
                    onClick={() => router.push('/crm/projects')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/crm/projects')}`}
                  >
                    Projects Hub
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Community Group */}
          <div className="space-y-1">
            <button
              onClick={() => setCommunityGroupOpen(!communityGroupOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <span>{t('nav_community') || 'Community'}</span>
              <Users className="w-4 h-4 text-slate-400" />
            </button>
            {communityGroupOpen && (
              <div id="communityGroup" className="block pr-3 py-1">
                <div className="ml-5 pl-4 border-l border-slate-700 space-y-1">
                  <button
                    onClick={() => router.push('/community/friends')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer${isActive('/community/friends')}`}
                  >
                    Friends Grid
                  </button>
                  <button
                    onClick={() => router.push('/community/discover')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer${isActive('/community/discover')}`}
                  >
                    Discover People
                  </button>
                  <button
                    onClick={() => router.push('/community/requests')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer${isActive('/community/requests')}`}
                  >
                    Friend Requests
                  </button>
                  <button
                    onClick={() => router.push('/community/following')}
                    className={`w-full text-left block px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors cursor-pointer${isActive('/community/following')}`}
                  >
                    Connections & Follows
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => router.push('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors${isActive('/settings')}`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>{t('nav_settings')}</span>
          </button>
        </nav>

        {/* User Mini Profile */}
        <div className="relative border-t border-slate-800/50 overflow-hidden">
          {/* Online Tracker Indicator background */}
          <div
            className="absolute inset-0 z-0 pointer-events-none transition-colors duration-500"
            style={{
              background:
                currentUserStatus === 'online'
                  ? 'linear-gradient(to top, rgba(34, 197, 94, 0.1) 0%, transparent 100%)'
                  : currentUserStatus === 'away'
                  ? 'linear-gradient(to top, rgba(251, 191, 36, 0.1) 0%, transparent 100%)'
                  : 'linear-gradient(to top, rgba(100, 116, 139, 0.1) 0%, transparent 100%)',
            }}
          ></div>

          <div className="p-4 relative z-10 space-y-3">
            <div className="flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full${
                    currentUserStatus === 'online'
                      ? 'bg-green-500 animate-pulse'
                      : currentUserStatus === 'away'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {currentUserStatus === 'online' ? 'Online Mode' : currentUserStatus === 'away' ? 'Away' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-3">
              <button
                onClick={() => router.push('/me')}
                className="flex items-center gap-3 text-left group flex-grow min-w-0"
              >
                <img
                  src={currentUser.avatar || '/Assets/Img/default-avatar.png'}
                  alt="Avatar"
                  className="w-9 h-9 rounded-xl object-cover border border-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate group-hover:text-primary-500 transition-colors">
                    {currentUser.username}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title={t('nav_logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
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
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
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
              <button
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
              </button>
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
                      <img
                        src={n.data?.from_avatar || '/Assets/Img/default-avatar.png'}
                        alt=""
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[75px] bg-slate-900/50 backdrop-blur-sm z-30">
          <div className="w-64 bg-surface-dark h-full border-r border-slate-800 p-6 flex flex-col space-y-4">
            <button
              onClick={() => {
                router.push('/dashboard');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left block py-2.5 text-sm font-semibold text-slate-300"
            >
              Dashboard Home
            </button>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Time Suite</p>
              <button
                onClick={() => {
                  router.push('/time/execution');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Pomodoro Focus
              </button>
              <button
                onClick={() => {
                  router.push('/time/tasks');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Task Board
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Money Suite</p>
              <button
                onClick={() => {
                  router.push('/money/dashboard');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Ledger Overview
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('nav_crm')}</p>
              <button
                onClick={() => {
                  router.push('/crm');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                CRM Dashboard
              </button>
              <button
                onClick={() => {
                  router.push('/crm/leads');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Lead Vault
              </button>
              <button
                onClick={() => {
                  router.push('/crm/pipeline');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Kanban Pipeline
              </button>
              <button
                onClick={() => {
                  router.push('/crm/contacts');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Client Profiles
              </button>
              <button
                onClick={() => {
                  router.push('/crm/outreach');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Outreach AI
              </button>
              <button
                onClick={() => {
                  router.push('/crm/projects');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Projects Hub
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Community</p>
              <button
                onClick={() => {
                  router.push('/community/friends');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Friends Grid
              </button>
              <button
                onClick={() => {
                  router.push('/community/discover');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Discover People
              </button>
              <button
                onClick={() => {
                  router.push('/community/requests');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Friend Requests
              </button>
              <button
                onClick={() => {
                  router.push('/community/following');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left block pl-4 py-2 text-xs text-slate-400"
              >
                Connections & Follows
              </button>
            </div>
            <button
              onClick={() => {
                router.push('/settings');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left block py-2.5 text-sm font-semibold text-slate-300"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left block py-2.5 text-sm font-semibold text-red-500"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <StreamWaiterProvider>
      <MoneyProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </MoneyProvider>
    </StreamWaiterProvider>
  );
}

export const dynamic = 'force-dynamic';
