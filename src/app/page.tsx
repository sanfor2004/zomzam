'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/context/TranslationContext';
import { Sun, Moon, Globe, ArrowRight, Shield, Heart, HelpCircle, Users, ArrowDown, Activity, DollarSign, Clock } from 'lucide-react';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { DropdownItem } from '@/components/ui/DropdownItem';
import dynamic from 'next/dynamic';

// Load Silk component dynamically to avoid SSR/hydration issues with ThreeJS/WebGL
const Silk = dynamic(() => import('@/components/Silk'), { ssr: false });

export default function LandingPage() {
  const { t, language, setLanguage } = useTranslation();
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark');
  const [langOpen, setLangOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (stored) {
      setThemeState(stored);
      if (stored === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemeState(next);
    localStorage.setItem('theme', next);
    if (next === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-surface-dark text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans">
      
      {/* Navigation (Apple-style Glassmorphism) */}
      <nav className="fixed w-full top-0 z-50 glass-nav transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-[75px]">
            {/* Logo */}
            <a href="/" className="flex-shrink-0 flex items-center gap-3 group">
              <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam" className="h-8 dark:hidden" />
              <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-8 hidden dark:block" />
            </a>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#hero" className="nav-link text-sm font-medium text-slate-650 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {t('nav_home')}
              </a>
              <a href="#features" className="nav-link text-sm font-medium text-slate-650 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {t('nav_features')}
              </a>
              <a href="#about" className="nav-link text-sm font-medium text-slate-650 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {t('nav_about')}
              </a>
            </div>

            {/* CTA Buttons & Toggles */}
            <div className="flex items-center gap-4">
              {/* Language Selector */}
              <div>
                <DropdownMenu
                  open={langOpen}
                  onClose={() => setLangOpen(false)}
                  align="right"
                  trigger={
                    <button
                      onClick={() => setLangOpen(!langOpen)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-500 dark:text-slate-400 transition-colors py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-expanded={langOpen}
                      type="button"
                    >
                      <Globe className="w-4 h-4" />
                      <span className="uppercase">{language}</span>
                    </button>
                  }
                >
                  {[
                    { code: 'en', label: 'English' },
                    { code: 'ar', label: 'العربية' },
                    { code: 'es', label: 'Español' },
                    { code: 'it', label: 'Italiano' },
                    { code: 'fr', label: 'Français' },
                    { code: 'he', label: 'עברית' },
                    { code: 'zh', label: '中文' },
                  ].map((lang) => (
                    <DropdownItem
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setLangOpen(false);
                      }}
                    >
                      {lang.label}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all bg-white dark:bg-slate-900 shadow-sm cursor-pointer"
              >
                {!mounted ? (
                  <div className="w-4 h-4" />
                ) : theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
              </button>

              <a
                href="/sign"
                className="hidden sm:inline-block text-sm font-semibold text-slate-700 dark:text-slate-350 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
              >
                {t('nav_signin')}
              </a>
              <a
                href="/sign#signup"
                className="text-sm font-semibold text-white bg-primary-500 px-5 py-2.5 rounded-full hover:bg-primary-600 transition-all shadow-apple hover:shadow-lg transform active:scale-98"
              >
                {t('nav_get_started')}
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container / Bento Grid Layout */}
      <main id="hero" className="flex-grow pt-32 pb-20 px-6 max-w-7xl mx-auto w-full flex flex-col justify-center gap-6">
        
        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full mt-4">
          
          {/* Card 1: Heading/Hero description (Spans 8 columns, medium height) */}
          <div className="lg:col-span-8 bg-white dark:bg-[#161920] border border-slate-100 dark:border-slate-800/80 rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between shadow-apple min-h-[360px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary-500/10 transition-colors"></div>
            
            <div className="space-y-6">
              <span className="inline-block px-3 py-1 bg-primary-500/10 text-primary-500 rounded-full text-xs font-bold uppercase tracking-wider">
                Zenith-Tier Platform
              </span>
              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Master Your{' '}
                <span className="inline-block px-5 py-1 bg-primary-500/10 dark:bg-primary-500/20 text-primary-500 rounded-full font-black border border-primary-500/10 mx-1 align-middle text-2xl sm:text-4xl">
                  Time
                </span>{' '}
                & Capital
                <a href="#features" className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 dark:border-slate-800 rounded-full text-slate-500 hover:text-primary-500 dark:hover:text-white hover:border-primary-500 dark:hover:border-slate-700 transition-colors ml-3 align-middle cursor-pointer">
                  <ArrowDown className="w-4 h-4" />
                </a>
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                {t('description')}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-6 relative z-10">
              <a
                href="/sign#signup"
                className="flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all shadow-md shadow-primary-500/15 hover:shadow-lg hover:shadow-primary-500/20 active:scale-98"
              >
                {t('nav_get_started')}
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/sign"
                className="px-6 py-3 border border-slate-200 dark:border-slate-800 hover:border-primary-500 hover:bg-primary-500/5 text-slate-700 dark:text-slate-350 font-bold rounded-2xl transition-all active:scale-98"
              >
                {t('nav_signin')}
              </a>
            </div>
          </div>

          {/* Card 2: Interactive Goal / Silk background card (Spans 4 columns) */}
          <div className="lg:col-span-4 bg-white dark:bg-[#161920] border border-slate-100 dark:border-slate-800/80 rounded-[2rem] p-8 flex flex-col justify-between shadow-apple min-h-[360px] relative overflow-hidden group">
            {/* Silk background inside card */}
            <div className="absolute inset-0 z-0">
              <Silk speed={3} scale={1.3} color="#EE5712" noiseIntensity={0.8} />
            </div>
            {/* Soft overlay to guarantee text legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/80 to-white dark:from-[#161920]/10 dark:via-[#161920]/85 dark:to-[#161920] z-10 pointer-events-none" />
            
            <div className="relative z-20 space-y-4">
              <div className="w-10 h-10 bg-primary-500/10 text-primary-500 rounded-2xl flex items-center justify-center font-bold">
                ★
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Our Goal</h3>
              <p className="text-sm text-slate-650 dark:text-slate-350 leading-relaxed">
                Help you succeed in personal development, increase your time efficiency by 25%, and manage your budget rules with zero friction.
              </p>
            </div>

            <div className="relative z-20 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-between items-center text-xs font-bold text-slate-400">
              <span>Goal Tracking 60/20/20</span>
              <span className="text-primary-500">Active</span>
            </div>
          </div>

          {/* Card 3: Large Canvas Card with Silk Background & floating service card (Spans 8 columns) */}
          <div className="lg:col-span-8 bg-slate-100 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[2rem] overflow-hidden shadow-apple min-h-[460px] relative flex flex-col justify-end p-6 sm:p-8">
            
            {/* Large primary Silk background */}
            <div className="absolute inset-0 z-0">
              <Silk speed={4} scale={0.7} color="#7B7481" noiseIntensity={1.4} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-100/40 via-transparent to-transparent dark:from-slate-900/40 z-10 pointer-events-none" />
            
            {/* Floating Glassmorphic Panel inside the bento item */}
            <div className="relative z-20 bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border border-slate-100/40 dark:border-slate-800 rounded-3xl p-6 shadow-glass flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-3xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Featured Service</span>
                </div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">Time Management Suite</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                  We offer advanced drift-corrected Pomodoro timers, collaborative task boards, and dream horizon planning.
                </p>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 self-stretch sm:self-auto justify-between sm:justify-start border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 dark:border-slate-800">
                <div className="text-right">
                  <span className="block text-[9px] font-black text-slate-450 uppercase tracking-widest">Active State</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">1/5 Modules</span>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-primary-500 cursor-pointer transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Team/Active community list (Spans 4 columns) */}
          <div className="lg:col-span-4 bg-white dark:bg-[#161920] border border-slate-100 dark:border-slate-800/80 rounded-[2rem] p-8 flex flex-col justify-between shadow-apple min-h-[460px] relative overflow-hidden group">
            <div className="space-y-6">
              <div className="w-10 h-10 bg-primary-500/10 text-primary-500 rounded-2xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Active Workspace</h3>
                <p className="text-sm text-slate-650 dark:text-slate-350 leading-relaxed">
                  Connect with over 1,000+ developers, track their availability in real time, and share Pomodoro focus sessions.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/60">
              {/* Stack of avatars */}
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-3.5 overflow-hidden">
                  <img className="inline-block h-9 w-9 rounded-full ring-2 ring-white dark:ring-[#161920] object-cover" src="/Assets/Img/default-avatar.png" alt="A1" />
                  <img className="inline-block h-9 w-9 rounded-full ring-2 ring-white dark:ring-[#161920] object-cover" src="/Assets/Img/default-avatar.png" alt="A2" />
                  <img className="inline-block h-9 w-9 rounded-full ring-2 ring-white dark:ring-[#161920] object-cover" src="/Assets/Img/default-avatar.png" alt="A3" />
                  <div className="inline-flex items-center justify-center h-9 w-9 rounded-full ring-2 ring-white dark:ring-[#161920] bg-primary-500 text-white text-[10px] font-black">
                    +20
                  </div>
                </div>
                
                <a href="/sign" className="text-xs font-bold text-primary-500 hover:text-primary-600 transition-colors ml-2 flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Card 5: 5+ Native tools (Spans 4 columns, Primary colored) */}
          <div className="lg:col-span-4 bg-primary-500 text-white rounded-[2rem] p-8 flex flex-col justify-between shadow-lg shadow-primary-500/15 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 blur-xl pointer-events-none"></div>
            
            <div className="space-y-4">
              <span className="text-3xl font-black tracking-tight">5+</span>
              <h3 className="text-sm font-black uppercase tracking-wider opacity-90">Native Productivity Tools</h3>
            </div>
            
            <p className="text-xs text-primary-50 leading-relaxed mt-6">
              Includes advanced Focus Timers, horizon Goal Planners, Idea captures, Daily metric trackers, and a Multi-Currency Cash flow ledger.
            </p>
          </div>

          {/* Card 6: Security-First metadata (Spans 4 columns, dark themed) */}
          <div className="lg:col-span-4 bg-slate-950 text-white border border-slate-900 rounded-[2rem] p-8 flex flex-col justify-between shadow-apple relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">Infrastructure</span>
              </div>
              <h3 className="text-base font-black uppercase tracking-wider">Security-First</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Jose JWT encrypted edge cookies, self-healing automated migrations, parameterized queries, and isolated client-side contexts.
              </p>
            </div>

            <div className="text-[10px] font-mono text-slate-500 pt-4 border-t border-slate-900 flex justify-between">
              <span>DB Sync Status</span>
              <span className="text-emerald-400">100% Parameterized</span>
            </div>
          </div>

          {/* Card 7: Real-Time Engine specs (Spans 4 columns) */}
          <div className="lg:col-span-4 bg-white dark:bg-[#161920] border border-slate-100 dark:border-slate-800/80 rounded-[2rem] p-8 flex flex-col justify-between shadow-apple min-h-[220px]">
            <div className="space-y-4">
              <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center font-bold">
                ✦
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Real-Time Sync</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                SSE (Server-Sent Events) streaming connection pushes notifications and teammate availability updates to the client in under 100ms.
              </p>
            </div>
          </div>

        </div>

        {/* Corporate logo partner bar */}
        <div id="features" className="max-w-7xl mx-auto w-full px-6 lg:px-8 py-12 mt-12 border-t border-slate-200/50 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-8 opacity-30 dark:opacity-20 grayscale hover:opacity-55 transition-opacity">
            <span className="font-black text-lg tracking-widest font-mono">ADIDAS</span>
            <span className="font-black text-lg tracking-widest font-mono">NETFLIX</span>
            <span className="font-black text-lg tracking-widest font-mono">AMAZON</span>
            <span className="font-black text-lg tracking-widest font-mono">SPOTIFY</span>
            <span className="font-black text-lg tracking-widest font-mono">MCDONALD'S</span>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer id="about" className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-sm py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/Assets/Img/Icon-orange.svg" alt="Zomzam Icon" className="w-6 h-6 dark:hidden" />
            <img src="/Assets/Img/Icon-white.svg" alt="Zomzam Icon" className="w-6 h-6 hidden dark:block" />
            <span className="text-slate-900 dark:text-white font-semibold text-sm">zomzam.com</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} All rights reserved. Built with precision.
          </p>
        </div>
      </footer>
    </div>
  );
}
