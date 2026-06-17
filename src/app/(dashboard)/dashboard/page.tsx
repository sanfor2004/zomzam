'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { gsap, useGSAP, ScrollTrigger, SplitText, getScrollParent } from '@/lib/gsap';
import { useTranslation } from '@/context/TranslationContext';
import { 
  User, 
  Shield, 
  ArrowRight, 
  UserCheck, 
  Activity, 
  Award, 
  Clock, 
  DollarSign, 
  Users, 
  Briefcase, 
  TrendingUp, 
  Zap, 
  Percent, 
  AlertCircle,
  ChevronRight,
  TrendingDown,
  Layers,
  Sparkles
} from 'lucide-react';
import { Button, CountUp } from '@/components/ui';

interface DashboardData {
  success: boolean;
  profile: {
    username: string;
    email: string;
    role: string;
    avatar: string | null;
    bio: string | null;
    primary_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
    secondary_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  };
  time: {
    completedTasksCount: number;
    pendingTasksCount: number;
    inProgressTasksCount: number;
    completedHours: number;
    completedMinutes: number;
    recentTasks: Array<{
      id: number;
      title: string;
      priority: 'urgent' | 'medium' | 'maybe' | 'free';
      duration_block: number;
      actual_duration: number | null;
      status: 'pending' | 'in_progress' | 'completed' | 'deleted';
      completed_at: string | null;
      created_at: string;
    }>;
    completedTasks: Array<{
      id: number;
      title: string;
      duration_block: number;
      actual_duration: number | null;
      completed_at: string;
    }>;
  };
  money: {
    netBalancePrimary: number;
    totalIncomePrimary: number;
    totalExpensePrimary: number;
    totalIncomeByCurrency: Record<string, number>;
    totalExpenseByCurrency: Record<string, number>;
    accounts: Array<{
      name: string;
      balance: string;
      currency: string;
      type: string;
    }>;
  };
  crm: {
    totalLeadsCount: number;
    leadsStatusMap: {
      new: number;
      contacted: number;
      qualified: number;
      lost: number;
    };
    activeProjectsCount: number;
    deliveredProjectsCount: number;
    totalProjectRevenuePrimary: number;
    deliveredProjectRevenuePrimary: number;
  };
  rates: {
    hourlyRateIncome: number;
    hourlyRateProjects: number;
    exchangeRates: Record<string, number>;
  };
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const welcomeTitleRef = useRef<HTMLHeadingElement>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<{
    dayName: string;
    hourLabel: string;
    tasks: any[];
    x: number;
    y: number;
    placement?: 'above' | 'below';
  } | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.message || 'Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error(err);
      setError('An unexpected error occurred while fetching dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: DASHBOARD SECTION REVEALS (GSAP)
  // Welcome banner rises on data load; HUD/pillar/detail groups stagger in on
  // scroll; heatmap reveals row-by-row (7 elements, not 168 cells). All motion is
  // gated behind matchMedia → reduced-motion users get the static, visible DOM.
  // ──────────────────────────────────────────────────────────
  useGSAP(() => {
    const root = pageRef.current;
    if (loading || !root) return; // wait until data has rendered the real DOM

    // Dashboard content scrolls inside a nested <main overflow-y-auto>, not the
    // window, so every ScrollTrigger must target that scroller or it never fires.
    const scroller = getScrollParent(root);

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Welcome banner: rises on load, then title chars spring up.
      if (welcomeRef.current && welcomeTitleRef.current) {
        const welcomeSplit = SplitText.create(welcomeTitleRef.current, {
          type: 'chars,words',
          mask: 'chars',
          aria: 'auto',
        });

        const welcomeTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        welcomeTl
          .from(welcomeRef.current, { autoAlpha: 0, y: 28, duration: 0.5 })
          .from(
            welcomeSplit.chars,
            {
              yPercent: 110,
              duration: 0.42,
              stagger: { amount: 0.38, from: 'start' },
              ease: 'back.out(1.4)',
            },
            '-=0.2'
          );
      }

      // Collect all targets first — querySelectorAll has no layout cost.
      const hudCards    = gsap.utils.toArray<HTMLElement>('[data-animate="hud-card"]',    root);
      const heatmapRows = gsap.utils.toArray<HTMLElement>('[data-animate="heatmap-row"]', root);
      const pillarCards = gsap.utils.toArray<HTMLElement>('[data-animate="pillar-card"]', root);
      const detailCols  = gsap.utils.toArray<HTMLElement>('[data-animate="detail-col"]',  root);

      // --- ALL WRITES FIRST (one layout-dirty cycle, not four) ---
      // gsap-performance: "Batch Reads and Writes — avoid interleaving reads and
      // writes in a way that causes repeated layout thrashing."
      if (hudCards.length)    gsap.set(hudCards,    { autoAlpha: 0, y: 28 });
      if (heatmapRows.length) gsap.set(heatmapRows, { autoAlpha: 0, x: -20 });
      if (pillarCards.length) gsap.set(pillarCards, { autoAlpha: 0, y: 32 });
      if (detailCols.length)  gsap.set(detailCols,  { autoAlpha: 0, y: 40 });

      // --- ALL READS (ScrollTrigger setup) IN PAGE ORDER ---
      // gsap-scrolltrigger: "Create ScrollTriggers in the order they appear on
      // the page (top to bottom)." Page order: hud → heatmap → pillar → detail.
      if (hudCards.length) {
        ScrollTrigger.batch(hudCards, {
          scroller, start: 'top 88%', once: true,
          onEnter: (batch) => gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            ease: 'back.out(1.3)',
            stagger: { amount: 0.35, from: 'center' },
            overwrite: true,
          }),
        });
      }

      // Heatmap: reveal by ROW (7 elements), not by cell (168) — animating 168
      // simultaneous tweens risks jank on low-end devices (performance guidance).
      if (heatmapRows.length) {
        ScrollTrigger.create({
          trigger: heatmapRows[0], scroller, start: 'top 85%', once: true,
          onEnter: () => gsap.to(heatmapRows, {
            autoAlpha: 1, x: 0, duration: 0.38, ease: 'power2.out', stagger: 0.06,
          }),
        });
      }

      if (pillarCards.length) {
        ScrollTrigger.batch(pillarCards, {
          scroller, start: 'top 88%', once: true,
          onEnter: (batch) => gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            ease: 'back.out(1.3)',
            stagger: { amount: 0.4, from: 'center' },
            overwrite: true,
          }),
        });
      }

      if (detailCols.length) {
        ScrollTrigger.batch(detailCols, {
          scroller, start: 'top 88%', once: true,
          onEnter: (batch) => gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            ease: 'back.out(1.3)',
            stagger: { amount: 0.42, from: 'center' },
            overwrite: true,
          }),
        });
      }

      // Defer refresh to after the browser's first paint — running it synchronously
      // inside a layout effect blocks the render frame that the user sees first.
      // gsap-performance: "refresh only when layout actually changes."
      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  }, { scope: pageRef, dependencies: [loading], revertOnUpdate: true });

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: HEATMAP RIPPLE (GSAP)
  // Event delegation: mouseover bubbles from any cell to heatmapRef.
  // distribute({ grid:[7,24] }) maps 2D grid distance → scale value.
  // overwrite:'auto' gracefully kills only scale mid-tween on fast moves.
  // ──────────────────────────────────────────────────────────
  useGSAP((_, contextSafe) => {
    const heatmap = heatmapRef.current;
    if (loading || !heatmap) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference) and (hover: hover)', () => {
      const cells = gsap.utils.toArray<HTMLElement>('[data-heatmap-cell]', heatmap);
      if (!cells.length) return;

      const rippleIn = contextSafe!((e: MouseEvent) => {
        const target = (e.target as Element).closest<HTMLElement>('[data-heatmap-cell]');
        if (!target) return;
        const flatIdx = parseInt(target.dataset.heatmapCell ?? '-1', 10);
        if (flatIdx < 0 || flatIdx >= cells.length) return;

        gsap.to(cells, {
          scale: gsap.utils.distribute({
            base: 1,
            amount: 0.32,
            from: flatIdx,
            ease: 'power2.out',
            grid: [7, 24],
          }),
          duration: 0.18,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });

      const rippleOut = contextSafe!(() => {
        gsap.to(cells, {
          scale: 1,
          duration: 0.28,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });

      heatmap.addEventListener('mouseover', rippleIn);
      heatmap.addEventListener('mouseleave', rippleOut);

      return () => {
        heatmap.removeEventListener('mouseover', rippleIn);
        heatmap.removeEventListener('mouseleave', rippleOut);
      };
    });
  }, { scope: pageRef, dependencies: [loading] });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const cellTasksMap = React.useMemo(() => {
    const map: Record<number, Record<number, Record<number, any[]>>> = {};
    for (let w = 0; w < 4; w++) {
      map[w] = {};
      for (let d = 0; d < 7; d++) {
        map[w][d] = {};
        for (let h = 0; h < 24; h++) {
          map[w][d][h] = [];
        }
      }
    }
    if (!data?.time?.completedTasks) return map;

    const now = new Date();
    const startOfThisWeek = new Date(now);
    const day = startOfThisWeek.getDay();
    const diff = startOfThisWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfThisWeek.setDate(diff);
    startOfThisWeek.setHours(0, 0, 0, 0);

    data.time.completedTasks.forEach((task: any) => {
      if (!task.completed_at) return;
      const date = new Date(task.completed_at);
      const msDiff = startOfThisWeek.getTime() - date.getTime();
      let weekOffset = 0;
      if (msDiff > 0) {
        weekOffset = Math.floor(msDiff / 604800000) + 1;
      } else {
        weekOffset = 0;
      }

      if (weekOffset >= 0 && weekOffset < 4) {
        let dayIdx = date.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6;
        const hourIdx = date.getHours();
        if (dayIdx >= 0 && dayIdx < 7 && hourIdx >= 0 && hourIdx < 24) {
          map[weekOffset][dayIdx][hourIdx].push(task);
        }
      }
    });
    return map;
  }, [data?.time?.completedTasks]);

  const getWeeksGrids = (timestamps: any[]) => {
    const grids: Record<number, number[][]> = {};
    for (let w = 0; w < 4; w++) {
      grids[w] = Array(7).fill(0).map(() => Array(24).fill(0));
    }
    if (!timestamps || !Array.isArray(timestamps)) return grids;

    const now = new Date();
    const startOfThisWeek = new Date(now);
    const day = startOfThisWeek.getDay();
    const diff = startOfThisWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfThisWeek.setDate(diff);
    startOfThisWeek.setHours(0, 0, 0, 0);

    timestamps.forEach((item: any) => {
      if (!item.completed_at) return;
      const date = new Date(item.completed_at);
      const msDiff = startOfThisWeek.getTime() - date.getTime();
      let weekOffset = 0;
      if (msDiff > 0) {
        weekOffset = Math.floor(msDiff / 604800000) + 1;
      } else {
        weekOffset = 0;
      }

      if (weekOffset >= 0 && weekOffset < 4) {
        let dayIdx = date.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6;
        const hourIdx = date.getHours();
        if (dayIdx >= 0 && dayIdx < 7 && hourIdx >= 0 && hourIdx < 24) {
          grids[weekOffset][dayIdx][hourIdx] += 1;
        }
      }
    });
    return grids;
  };

  const getWeekRangeLabel = (offset: number) => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff - offset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const format = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (offset === 0) return `This Week (${format(startOfWeek)} - ${format(endOfWeek)})`;
    if (offset === 1) return `Last Week (${format(startOfWeek)} - ${format(endOfWeek)})`;
    return `${offset} Weeks Ago (${format(startOfWeek)} - ${format(endOfWeek)})`;
  };

  const getColorForCount = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/30 border border-slate-200/5 dark:border-slate-800/20 hover:bg-slate-200 dark:hover:bg-slate-700/40';
    if (count === 1) return 'bg-primary-500/20 dark:bg-primary-500/15 border border-primary-500/10 hover:bg-primary-500/30';
    if (count === 2) return 'bg-primary-500/50 dark:bg-primary-500/40 border border-primary-500/20 hover:bg-primary-500/60';
    return 'bg-primary-500 dark:bg-primary-500 border border-primary-500 hover:brightness-110 shadow-[0_0_6px_rgba(238,87,18,0.3)]';
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 animate-pulse">
          Compiling your operational workspace...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-[#1A1D24] border border-red-950/40 rounded-3xl p-6 shadow-apple text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="font-bold text-lg text-white">Workspace Sync Error</h3>
        <p className="text-sm text-slate-400">
          {error || 'Failed to fetch dashboard data.'}
        </p>
        <Button onClick={fetchDashboardData} variant="primary" className="w-full">
          Retry Sync
        </Button>
      </div>
    );
  }

  const { profile, time, money, crm, rates } = data;

  // Calculate Lead Conversion
  const activeLeads = crm.totalLeadsCount - (crm.leadsStatusMap.lost || 0);
  const conversionRate = activeLeads > 0
    ? Math.round(((crm.leadsStatusMap.qualified || 0) / activeLeads) * 100)
    : 0;

  // Maps an ISO currency code to a compact display glyph for the CountUp stats.
  const currencySymbol = (c: string) =>
    c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : 'E£';

  return (
    <div ref={pageRef} className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: WELCOME BANNER
          Contains: Freelancer profile identity, status badge, greeting
          ────────────────────────────────────────────────────────── */}
      <div ref={welcomeRef} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 via-primary-570 to-primary-600 p-8 sm:p-10 text-white shadow-apple border border-primary-400/20">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 mb-[-2rem] w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-wider">
                Freelancer Suite
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-primary-50">Operational Hub</span>
            </div>
            <h2 ref={welcomeTitleRef} className="text-title font-black tracking-tight font-display">
              Welcome back, {profile.username}!
            </h2>
            <p className="text-primary-50/90 text-sm sm:text-base max-w-xl font-medium">
              Manage your tasks, track hours, sync payments, and convert inbound leads. Let's make today highly profitable.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl md:self-center">
            <img
              src={profile.avatar || '/Assets/Img/default-avatar.png'}
              alt="Avatar"
              className="w-12 h-12 rounded-xl object-cover border border-white/20"
            />
            <div>
              <p className="font-bold text-sm text-white">{profile.username}</p>
              <p className="text-xs text-primary-100">{profile.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: CORE HOURLY RATE HUD
          Contains: Earnings metrics, tracked time, effective and projected hourly rates
          ────────────────────────────────────────────────────────── */}
      <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 sm:p-8 shadow-apple relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-primary-500 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Effective Hourly Rate HUD
              </span>
              <h3 className="font-display text-headline font-black text-white tracking-tight">
                Freelancer Efficiency Analyzer
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 bg-slate-900/60 text-slate-400 border border-slate-800/80 rounded-xl self-start">
              <span>Primary Currency: <strong className="text-white">{profile.primary_currency}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Hourly Rate Card */}
            <div data-animate="hud-card" className="relative group bg-gradient-to-br from-primary-500/20 to-transparent border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-primary-500/40 hover:shadow-apple-sm motion-safe:hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-widest text-primary-500">
                  Effective Income Rate
                </span>
                <TrendingUp className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <CountUp value={rates.hourlyRateIncome} prefix={currencySymbol(profile.primary_currency)} decimals={2} duration={1.4} className="text-4xl font-black tracking-tight text-white font-mono" />
                  <span className="text-xs font-semibold text-slate-400">/ hr</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-medium">
                  Calculated from received income transactions & total tracked hours.
                </p>
              </div>
            </div>

            {/* Projected Contract Rate Card */}
            <div data-animate="hud-card" className="relative group bg-[#13161C]/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/60 hover:shadow-apple-sm motion-safe:hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Delivered Contract Rate
                </span>
                <Briefcase className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <CountUp value={rates.hourlyRateProjects} prefix={currencySymbol(profile.primary_currency)} decimals={2} duration={1.4} className="text-4xl font-black tracking-tight text-white font-mono" />
                  <span className="text-xs font-semibold text-slate-400">/ hr</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-medium">
                  Calculated from delivered projects value & total tracked hours.
                </p>
              </div>
            </div>

            {/* Efficiency Overview Card */}
            <div data-animate="hud-card" className="bg-[#13161C]/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Tracked Metrics
                </span>
                <Clock className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="border-r border-slate-800/80 pr-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Time</span>
                  <CountUp value={time.completedHours} suffix="h" className="text-2xl font-black text-white font-mono" />
                  <span className="block text-[9px] text-slate-400 mt-0.5">({time.completedMinutes} mins)</span>
                </div>
                <div className="pl-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tasks Done</span>
                  <CountUp value={time.completedTasksCount} className="text-2xl font-black text-white font-mono" />
                  <span className="block text-[9px] text-slate-400 mt-0.5">in operational queue</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: HOURLY ACTIVITY HEATMAP
          Contains: Week selector tabs, 7x24 grid representing active hours per day, and a legend
          ────────────────────────────────────────────────────────── */}
      <div ref={cardRef} className="relative bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 sm:p-8 shadow-apple space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-primary-500 flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5" /> Hourly Activity Heatmap
            </span>
            <h3 className="font-display text-headline font-black text-white tracking-tight">
              Productivity Pixel Grid
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualize your peak focus hours of the day (X-axis) across the days of the week (Y-axis).
            </p>
          </div>

          {/* Week Selector Tab */}
          <div className="flex p-1 bg-slate-900/40 border border-slate-850 rounded-2xl self-start gap-1">
            {[0, 1, 2, 3].map((offset) => (
              <button
                key={offset}
                onClick={() => setSelectedWeek(offset)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all${
                  selectedWeek === offset
                    ? 'bg-[#252830] text-primary-500 shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {offset === 0 ? 'This Week' : offset === 1 ? 'Last Week' : `${offset}w Ago`}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Week Range Indicator */}
        <div className="text-xs font-semibold text-slate-400 px-3 py-1.5 bg-slate-900/35 border border-slate-800/80 rounded-xl inline-block">
          {getWeekRangeLabel(selectedWeek)}
        </div>

        {/* Heatmap Grid Wrapper */}
        <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-800">
          <div ref={heatmapRef} className="min-w-[480px] flex flex-col gap-[2px]">
            {/* Hour Labels Header (X-Axis) */}
            <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-10 h-5 mb-1">
              <div className="flex-1 grid" style={{ gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px' }}>
                {Array.from({ length: 24 }).map((_, hour) => {
                  const showLabel = hour % 4 === 0 || hour === 23;
                  return (
                    <span
                      key={hour}
                      className="text-center"
                      style={{
                        visibility: showLabel ? 'visible' : 'hidden',
                      }}
                    >
                      {hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}` : `${hour}`}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Grid Rows (Y-Axis) */}
            {(() => {
              const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

              return days.map((dayName, dayIdx) => (
                <div key={dayName} data-animate="heatmap-row" className="flex items-center">
                  {/* Day Label */}
                  <span className="w-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex-shrink-0">
                    {dayName}
                  </span>
                  
                  {/* 24 Hour Blocks */}
                  <div className="flex-1 grid" style={{ gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px' }}>
                    {Array.from({ length: 24 }).map((_, hourIdx) => {
                      const cellTasks = cellTasksMap[selectedWeek]?.[dayIdx]?.[hourIdx] || [];
                      const count = cellTasks.length;
                      return (
                        <div
                          key={hourIdx}
                          data-heatmap-cell={String(dayIdx * 24 + hourIdx)}
                          className={`w-full aspect-square rounded-[2px] transition-all duration-150 cursor-pointer${getColorForCount(count)}`}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const cardRect = cardRef.current?.getBoundingClientRect();
                            const cardWidth = cardRect ? cardRect.width : 0;
                            
                            const cellX = rect.left - (cardRect?.left || 0) + rect.width / 2;
                            
                            // Clamp x to stay within the card bounds (assuming w-64 tooltip is 256px wide)
                            const tooltipWidth = 256;
                            const margin = 12; // safety margin from edges
                            let x = cellX;
                            if (cardWidth > 0) {
                              const minX = tooltipWidth / 2 + margin;
                              const maxX = cardWidth - (tooltipWidth / 2 + margin);
                              if (cardWidth > tooltipWidth + margin * 2) {
                                x = Math.max(minX, Math.min(maxX, cellX));
                              }
                            }
                            
                            // Flip tooltip position if it's too close to the top of the viewport
                            const showBelow = rect.top < 180;
                            const y = showBelow
                              ? rect.bottom - (cardRect?.top || 0) + 8
                              : rect.top - (cardRect?.top || 0) - 8;
                              
                            setHoveredCell({
                              dayName,
                              hourLabel: formatHour(hourIdx),
                              tasks: cellTasks,
                              x,
                              y,
                              placement: showBelow ? 'below' : 'above'
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Floating Popover Tooltip (Rendered outside the scroll container, inside the card container) */}
        {hoveredCell && (
          <div
            key={`${hoveredCell.x}-${hoveredCell.y}`}
            className="absolute z-50 pointer-events-none"
            style={{
              top: `${hoveredCell.y}px`,
              left: `${hoveredCell.x}px`,
              transform: hoveredCell.placement === 'below' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }}
          >
            <div className="w-64 bg-[#151820]/95 backdrop-blur-md border border-slate-800 text-white rounded-2xl p-4 shadow-2xl flex flex-col gap-2.5 text-xs animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-black text-primary-400">
                  {hoveredCell.dayName} at {hoveredCell.hourLabel}
                </span>
                <span className="px-2 py-0.5 bg-white/10 rounded-full text-[9px] font-bold">
                  {hoveredCell.tasks.length} Done
                </span>
              </div>

              {/* Tasks list */}
              {hoveredCell.tasks.length > 0 ? (
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {hoveredCell.tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-1 text-[10px] text-slate-200 leading-tight">
                      <span className="text-primary-500 font-bold flex-shrink-0">&bull;</span>
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">No tasks completed in this hour.</p>
              )}

              {/* Metrics */}
              {hoveredCell.tasks.length > 0 && (() => {
                let totalWorked = 0;
                let totalSaved = 0;
                let totalWasted = 0;

                hoveredCell.tasks.forEach((t) => {
                  const actual = t.actual_duration !== null ? t.actual_duration : t.duration_block;
                  totalWorked += actual;

                  if (t.actual_duration !== null) {
                    const diff = t.duration_block - t.actual_duration;
                    if (diff > 0) totalSaved += diff;
                    else if (diff < 0) totalWasted += Math.abs(diff);
                  }
                });

                return (
                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[10px] font-bold">
                    <div>
                      <span className="text-slate-450 block text-[8px] uppercase">Time Worked</span>
                      <span className="text-white font-mono">{totalWorked} min</span>
                    </div>
                    <div>
                      {totalSaved > 0 ? (
                        <>
                          <span className="text-emerald-400 block text-[8px] uppercase">Time Saved</span>
                          <span className="text-emerald-400 font-mono">+{totalSaved} min</span>
                        </>
                      ) : totalWasted > 0 ? (
                        <>
                          <span className="text-rose-450 block text-[8px] uppercase">Time Overrun</span>
                          <span className="text-rose-400 font-mono">-{totalWasted} min</span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-450 block text-[8px] uppercase">Performance</span>
                          <span className="text-slate-300 font-mono">On Track</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-[10px] text-slate-400 font-bold">
          <span>* Coordinates: Y = Days of week, X = 24 Hours of day</span>
          <div className="flex items-center gap-1.5">
            <span>Less</span>
            <div className="w-[10px] h-[10px] rounded-[2px] bg-slate-800/30 border border-slate-800/20" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-primary-500/15 border border-primary-500/10" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-primary-500/40 border border-primary-500/20" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-primary-500" />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: THREE-PILLAR STATS GRID
          Contains: Quick metric cards for Time, Money, and CRM suites
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Time Pillar Card */}
        <div data-animate="pillar-card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg motion-safe:hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-primary-500">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Time Suite</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-200">Time & Productivity</h4>
              <p className="text-xs text-slate-400 mt-1">
                Your focus states and task workflows are cataloged in minutes.
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">In Progress Tasks</span>
                <CountUp value={time.inProgressTasksCount} className="font-bold text-slate-200" />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Pending Backlog</span>
                <CountUp value={time.pendingTasksCount} className="font-bold text-slate-200" />
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/time/execution')}
            className="w-full mt-6 py-2 px-4 bg-slate-900/60 hover:bg-primary-500 hover:text-white text-slate-300 font-bold rounded-xl transition-all border border-slate-800/80 flex items-center justify-center gap-1.5 text-xs h-11"
          >
            Launch Focus Mode <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Money Pillar Card */}
        <div data-animate="pillar-card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg motion-safe:hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Money Suite</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-200">Financial Ledger</h4>
              <p className="text-xs text-slate-400 mt-1">
                Your net wealth balance across connected bank cards and PayPal accounts.
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Income</span>
                <CountUp value={money.totalIncomePrimary} prefix={currencySymbol(profile.primary_currency)} decimals={2} className="font-bold text-emerald-500" />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Expenses</span>
                <CountUp value={money.totalExpensePrimary} prefix={currencySymbol(profile.primary_currency)} decimals={2} className="font-bold text-rose-500" />
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/money')}
            className="w-full mt-6 py-2 px-4 bg-slate-900/60 hover:bg-primary-500 hover:text-white text-slate-300 font-bold rounded-xl transition-all border border-slate-800/80 flex items-center justify-center gap-1.5 text-xs h-11"
          >
            Manage Accounts <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CRM Pillar Card */}
        <div data-animate="pillar-card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg motion-safe:hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">CRM Suite</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-200">Leads & Client Pipeline</h4>
              <p className="text-xs text-slate-400 mt-1">
                Active business leads sourced dynamically and synced projects.
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Active Pipeline Leads</span>
                <CountUp value={activeLeads} className="font-bold text-slate-200" />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Conversion Rate</span>
                <CountUp value={conversionRate} suffix="%" className="font-bold text-violet-500" />
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/crm')}
            className="w-full mt-6 py-2 px-4 bg-slate-900/60 hover:bg-primary-500 hover:text-white text-slate-300 font-bold rounded-xl transition-all border border-slate-800/80 flex items-center justify-center gap-1.5 text-xs h-11"
          >
            Open CRM Board <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: DETAILS & DEEP DIVE SECTION
          Contains: Time tracking backlog lists and CRM Projects
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Time Tasks Deep Dive */}
        <div data-animate="detail-col" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 sm:p-8 shadow-apple space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary-500" /> Recent Task Backlog
            </h3>
            <button 
              onClick={() => router.push('/time/tasks')}
              className="text-xs font-bold text-primary-500 hover:underline flex items-center gap-1"
            >
              View Board <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {time.recentTasks.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic">
                No active or completed tasks found in backlog.
              </div>
            ) : (
              time.recentTasks.map((t) => (
                <div 
                  key={t.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/35 border border-slate-800/40 hover:border-slate-750 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-xs text-slate-200 truncate">
                      {t.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded font-black uppercase tracking-wider text-[8px]${
                        t.priority === 'urgent' ? 'bg-rose-950/20 text-rose-400' :
                        t.priority === 'medium' ? 'bg-amber-950/20 text-amber-400' :
                        t.priority === 'maybe' ? 'bg-blue-950/20 text-blue-400' :
                        'bg-slate-900 text-slate-400'
                      }`}>
                        {t.priority}
                      </span>
                      <span className="text-slate-400 font-medium">
                        {t.actual_duration ? `${t.actual_duration}m actual` : `${t.duration_block}m block`}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider${
                    t.status === 'completed' 
                      ? 'bg-emerald-950/20 text-emerald-400'
                      : t.status === 'in_progress'
                      ? 'bg-primary-950/20 text-primary-400 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {t.status === 'in_progress' ? 'Focusing' : t.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Financial Accounts & CRM Projects */}
        <div data-animate="detail-col" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 sm:p-8 shadow-apple space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg text-white tracking-tight flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-amber-500" /> CRM Project Revenue
            </h3>
            <button 
              onClick={() => router.push('/crm')}
              className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1"
            >
              View Projects <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/35 border border-slate-800/40 p-4 rounded-2xl">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active projects</span>
              <span className="text-3xl font-black text-white font-mono mt-1 block">
                {crm.activeProjectsCount}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Planning or in design</span>
            </div>
            <div className="bg-slate-900/35 border border-slate-800/40 p-4 rounded-2xl">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivered revenue</span>
              <span className="text-3xl font-black text-emerald-500 font-mono mt-1 block">
                {formatCurrency(crm.deliveredProjectRevenuePrimary, profile.primary_currency)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">{crm.deliveredProjectsCount} contracts completed</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Account Assets Snapshot</h4>
            {money.accounts.length === 0 ? (
              <p className="text-xs italic text-slate-400 py-2">No active financial accounts connected.</p>
            ) : (
              money.accounts.map((acc, index) => (
                <div key={index} className="flex justify-between items-center text-xs border-b border-dashed border-slate-800/80 pb-2 last:border-b-0">
                  <span className="text-slate-400 font-medium">{acc.name}</span>
                  <span className="font-bold text-slate-200 font-mono">
                    {formatCurrency(parseFloat(acc.balance), acc.currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
