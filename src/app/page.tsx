'use client';
import { Button } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, SplitText } from '@/lib/gsap';
import { useTranslation } from '@/context/TranslationContext';
import { Globe, ArrowRight, Shield, Heart, HelpCircle, Users, Activity, DollarSign, Clock, Star, Sparkles } from 'lucide-react';
import { DropdownMenu, DropdownItem } from '@/components/ui/Dropdown';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useDesktopWebGL } from '@/hooks/useDesktopWebGL';

// Load Silk component dynamically to avoid SSR/hydration issues with ThreeJS/WebGL.
// Combined with the useDesktopWebGL gate below, the three.js chunk is only ever
// fetched on real desktop pointers — phones/tablets get the static gradient fallback.
const Silk = dynamic(() => import('@/components/Silk'), { ssr: false });

export default function LandingPage() {
  const { t, language, setLanguage } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  // True only on desktop pointers, after first idle — gates the WebGL Silk shaders.
  const showSilk = useDesktopWebGL();
  const bentoRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const scrollChevronRef = useRef<HTMLDivElement>(null);
  const marqueeWrapRef = useRef<HTMLDivElement>(null);
  const marqueeTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: HERO + BENTO LOAD CHOREOGRAPHY (GSAP)
  // Headline SplitText mask reveal + first two cards rise on load (one timeline);
  // remaining five cards reveal on scroll via ScrollTrigger.batch. All motion is
  // gated behind matchMedia → reduced-motion users get the static, visible DOM.
  // ──────────────────────────────────────────────────────────
  useGSAP(() => {
    const root = bentoRef.current;
    const title = heroTitleRef.current;
    if (!root || !title) return;

    const cards = gsap.utils.toArray<HTMLElement>('[data-animate="bento-card"]', root);

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // --- Page-load timeline: headline reveal + first two cards ---
      const split = SplitText.create(title, {
        type: 'chars,words',
        mask: 'chars',
        ignore: '.hero-cta-arrow',
        charsClass: 'hero-char',
        aria: 'auto',
      });

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from(
        cards.slice(0, 2),
        { autoAlpha: 0, y: 52, duration: 0.75, stagger: 0.13 },
        0.1
      );

      tl.from(
        split.chars,
        {
          yPercent: 110,
          rotationZ: () => gsap.utils.random(-6, 6),
          duration: 0.5,
          stagger: { amount: 0.65, from: 'center' },
          ease: 'back.out(1.5)',
        },
        0.2
      );

      if (descRef.current) {
        const descSplit = SplitText.create(descRef.current, {
          type: 'words,chars',
          aria: 'auto',
        });
        gsap.set(descSplit.chars, { autoAlpha: 0 });
        tl.to(
          descSplit.chars,
          {
            autoAlpha: 1,
            duration: 0.01,
            stagger: 0.03,
            ease: 'none',
            // Revert after animation so char spans don't cause mid-word line breaks
            onComplete: () => descSplit.revert(),
          },
          '>-0.2'
        );
      }

      // --- Scroll batch: remaining five cards ---
      const rest = cards.slice(2);
      gsap.set(rest, { autoAlpha: 0, y: 52 });
      ScrollTrigger.batch(rest, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            stagger: 0.1,
            overwrite: true,
          }),
      });

      // SplitText is reverted automatically when useGSAP cleans up the context.
    });
  }, { scope: bentoRef });

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: PARTNER MARQUEE MOTION (GSAP)
  // Infinite -50% loop over two identical brand sets → seamless ticker; pauses on
  // hover (listeners cleaned up in the handler). Gated behind matchMedia so
  // reduced-motion users get a static strip with no tween.
  // ──────────────────────────────────────────────────────────
  useGSAP(() => {
    const wrap = marqueeWrapRef.current;
    const track = marqueeTrackRef.current;
    if (!wrap || !track) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Two identical sets in the track, so -50% advances by exactly one set → seamless.
      const loop = gsap.to(track, {
        xPercent: -50,
        duration: 24,
        ease: 'none', // required for constant-speed, seam-free looping
        repeat: -1,
      });

      const pause = () => loop.pause();
      const resume = () => loop.play();
      wrap.addEventListener('mouseenter', pause);
      wrap.addEventListener('mouseleave', resume);

      // Listeners are added in this handler, so remove them in its cleanup.
      return () => {
        wrap.removeEventListener('mouseenter', pause);
        wrap.removeEventListener('mouseleave', resume);
      };
    });
  }, { scope: marqueeWrapRef });

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: BENTO 3D MAGNETIC TILT (GSAP)
  // transformPerspective per card → independent tilt planes.
  // quickTo reuses one tween per property per card (no GC per mousemove).
  // contextSafe → handlers no-op after unmount/matchMedia revert.
  // ──────────────────────────────────────────────────────────
  useGSAP((_, contextSafe) => {
    const root = bentoRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference) and (hover: hover)', () => {
      const cards = gsap.utils.toArray<HTMLElement>('[data-animate="bento-card"]', root);
      gsap.set(cards, { transformPerspective: 900 });

      const cleanups: Array<() => void> = [];

      cards.forEach((card) => {
        const xTo = gsap.quickTo(card, 'rotationY', { duration: 0.35, ease: 'power2.out' });
        const yTo = gsap.quickTo(card, 'rotationX', { duration: 0.35, ease: 'power2.out' });
        const sxTo = gsap.quickTo(card, 'scaleX', { duration: 0.35, ease: 'power2.out' });
        const syTo = gsap.quickTo(card, 'scaleY', { duration: 0.35, ease: 'power2.out' });

        const onMove = contextSafe!((e: MouseEvent) => {
          const rect = card.getBoundingClientRect();
          const cx = rect.left + rect.width  / 2;
          const cy = rect.top  + rect.height / 2;
          xTo(((e.clientX - cx) / rect.width)  *  10);
          yTo(((e.clientY - cy) / rect.height) * -10);
          sxTo(1.025); syTo(1.025);
        });

        const onLeave = contextSafe!(() => { xTo(0); yTo(0); sxTo(1); syTo(1); });

        card.addEventListener('mousemove', onMove);
        card.addEventListener('mouseleave', onLeave);
        cleanups.push(() => {
          card.removeEventListener('mousemove', onMove);
          card.removeEventListener('mouseleave', onLeave);
        });
      });

      return () => cleanups.forEach((fn) => fn());
    });
  }, { scope: bentoRef });

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: SCROLL PARALLAX + SCROLL CHEVRON (GSAP)
  // Hero headline drifts upward faster than scroll — cinematic depth.
  // Chevron bounces infinitely — killed automatically on unmount by useGSAP.
  // ──────────────────────────────────────────────────────────
  useGSAP(() => {
    const title   = heroTitleRef.current;
    const bento   = bentoRef.current;
    const chevron = scrollChevronRef.current;
    if (!title || !bento) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(title, {
        y: -60,
        ease: 'none',
        scrollTrigger: {
          trigger: bento,
          start: 'top top',
          end: 'bottom top',
          scrub: 1.2,
        },
      });

      if (chevron) {
        gsap.to(chevron, {
          y: 8,
          repeat: -1,
          yoyo: true,
          duration: 0.7,
          ease: 'power1.inOut',
        });
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: MAGNETIC NAV HOVER (GSAP)
  // Elements with [data-magnetic] gravitate toward cursor.
  // Strength 0.28 — noticeable but not disorienting.
  // contextSafe ensures handlers no-op after unmount.
  // hover:hover gate — touch devices unaffected.
  // ──────────────────────────────────────────────────────────
  useGSAP((_, contextSafe) => {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference) and (hover: hover)', () => {
      const magneticEls = gsap.utils.toArray<HTMLElement>('[data-magnetic]');
      const cleanups: Array<() => void> = [];

      magneticEls.forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
        const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });

        const onMove = contextSafe!((e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width  / 2;
          const cy = rect.top  + rect.height / 2;
          xTo((e.clientX - cx) * 0.28);
          yTo((e.clientY - cy) * 0.28);
        });

        const onLeave = contextSafe!(() => { xTo(0); yTo(0); });

        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);
        cleanups.push(() => {
          el.removeEventListener('mousemove', onMove);
          el.removeEventListener('mouseleave', onLeave);
        });
      });

      return () => cleanups.forEach((fn) => fn());
    });
  });

  return (
    <div className="min-h-screen flex flex-col bg-surface-dark text-slate-100 transition-colors duration-300 font-sans">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: TOP NAVIGATION BAR
          Contains: Logo, desktop menu links, language selector, sign-in / get-started CTAs
          ────────────────────────────────────────────────────────── */}
      <nav ref={navRef} className="fixed w-full top-0 z-50 glass-nav transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-[75px]">
            {/* Logo */}
            <a href="/" className="flex-shrink-0 flex items-center gap-3 group">
              <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam" className="h-8 hidden" />
              <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-8 block" />
            </a>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#hero" className="nav-link text-sm font-medium text-slate-400 hover:text-white">
                {t('nav_home')}
              </a>
              <a href="#features" className="nav-link text-sm font-medium text-slate-400 hover:text-white">
                {t('nav_features')}
              </a>
              <a href="#about" className="nav-link text-sm font-medium text-slate-400 hover:text-white">
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
                    <Button variant="unstyled"
                      onClick={() => setLangOpen(!langOpen)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-primary-500 transition-colors py-2 px-3 rounded-xl hover:bg-slate-800"
                      aria-expanded={langOpen}
                      type="button"
                    >
                      <Globe className="w-4 h-4" />
                      <span className="uppercase">{language}</span>
                    </Button>
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



              <a
                href="/sign"
                className="hidden sm:inline-block text-sm font-semibold text-slate-350 hover:text-primary-400 transition-colors"
              >
                {t('nav_signin')}
              </a>
              <a
                data-magnetic
                href="/sign#signup"
                className="text-sm font-semibold text-white bg-primary-500 px-5 py-2.5 rounded-full hover:bg-primary-600 transition-all shadow-apple hover:shadow-lg transform active:scale-98"
              >
                {t('nav_get_started')}
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: HERO + BENTO GRID
          Contains: Hero heading card, goal card, Silk canvas card, community card,
          native-tools card, security card, real-time card, partner logo bar
          ────────────────────────────────────────────────────────── */}
      <main id="hero" className="flex-grow pt-32 pb-20 px-6 max-w-7xl mx-auto w-full flex flex-col justify-center gap-6">
        
        {/* Bento Grid */}
        <div ref={bentoRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full mt-4">
          
          {/* Card 1: Heading/Hero description (Spans 8 columns, medium height) */}
          <div data-animate="bento-card" className="lg:col-span-8 bg-[#161920] border border-slate-800/80 rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between shadow-apple min-h-[360px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary-500/10 transition-colors"></div>
            
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 text-primary-500 font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em]">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                Zenith-Tier Platform
              </span>
              <h1 ref={heroTitleRef} className="font-display text-title md:text-display font-black text-white tracking-tight leading-[1.05]">
                Master Your{' '}
                <span className="inline-block px-5 py-1 bg-primary-500/20 text-primary-500 rounded-full font-black border border-primary-500/10 mx-1 align-middle text-[0.8em]">
                  Time
                </span>{' '}
                & Capital
              </h1>
              <p ref={descRef} className="text-base text-slate-400 leading-relaxed max-w-xl">
                {t('description')}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-6 relative z-10">
              <a
                href="/sign#signup"
                className="flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all shadow-md shadow-primary-500/15 hover:shadow-lg hover:shadow-primary-500/20 active:scale-98 breathing"
              >
                {t('nav_get_started')}
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/sign"
                className="px-6 py-3 border border-slate-800 hover:border-primary-500 hover:bg-primary-500/5 text-slate-350 font-bold rounded-2xl transition-all active:scale-98"
              >
                {t('nav_signin')}
              </a>
            </div>
          </div>

          {/* Card 2: Interactive Goal / Silk background card (Spans 4 columns) */}
          <div data-animate="bento-card" className="lg:col-span-4 bg-[#161920] border border-slate-800/80 rounded-[2rem] p-8 flex flex-col justify-between shadow-apple min-h-[360px] relative overflow-hidden group">
            {/* Background: static orange gradient is always painted (the only layer on
                phones/tablets); the live Silk shader overlays it on desktop only. */}
            <div className="absolute inset-0 z-0">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(125%_120%_at_50%_0%,rgba(238,87,18,0.45)_0%,rgba(238,87,18,0.12)_38%,transparent_72%)]"
              />
              {showSilk && <Silk speed={3} scale={1.3} color="#EE5712" noiseIntensity={0.8} />}
            </div>
            {/* Soft overlay to guarantee text legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#161920]/10 via-[#161920]/85 to-[#161920] z-10 pointer-events-none" />
            
            <div className="relative z-20 space-y-4">
              <div className="w-10 h-10 bg-primary-500/10 text-primary-500 rounded-2xl flex items-center justify-center font-bold">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">Our Goal</h3>
              <p className="text-sm text-slate-350 leading-relaxed">
                Help you succeed in personal development, increase your time efficiency by 25%, and manage your budget rules with zero friction.
              </p>
            </div>

            <div className="relative z-20 pt-4 border-t border-slate-800/60 flex justify-between items-center text-xs font-bold text-slate-400">
              <span>Goal Tracking 60/20/20</span>
              <span className="text-primary-500">Active</span>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: SCROLL INDICATOR
              Contains: Animated chevron, bounced by GSAP infinite loop
              ────────────────────────────────────────────────────────── */}
          <div
            ref={scrollChevronRef}
            aria-hidden="true"
            className="col-span-full flex justify-center mt-2 mb-0 text-slate-500"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Card 3: Large Canvas Card with Silk Background & floating service card (Spans 8 columns) */}
          <div data-animate="bento-card" className="lg:col-span-8 bg-slate-900 border border-slate-800/80 rounded-[2rem] overflow-hidden shadow-apple min-h-[460px] relative flex flex-col justify-end p-6 sm:p-8">
            
            {/* Background: static slate gradient is always painted (the only layer on
                phones/tablets); the live Silk shader overlays it on desktop only. */}
            <div className="absolute inset-0 z-0">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(130%_110%_at_50%_100%,rgba(123,116,129,0.30)_0%,rgba(123,116,129,0.08)_45%,transparent_75%)]"
              />
              {showSilk && <Silk speed={4} scale={0.7} color="#7B7481" noiseIntensity={1.4} />}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent z-10 pointer-events-none" />
            
            {/* Floating Glassmorphic Panel inside the bento item */}
            <div className="relative z-20 bg-[#161920]/95 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-glass flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-3xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Featured Service</span>
                </div>
                <h4 className="text-base font-black text-white">Time Management Suite</h4>
                <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                  We offer advanced drift-corrected Pomodoro timers, collaborative task boards, and dream horizon planning.
                </p>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 self-stretch sm:self-auto justify-between sm:justify-start border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-800">
                <div className="text-right">
                  <span className="block text-[9px] font-black text-slate-450 uppercase tracking-widest">Active State</span>
                  <span className="text-xs font-bold text-white">1/5 Modules</span>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center text-slate-400 hover:text-primary-500 cursor-pointer transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Team/Active community list (Spans 4 columns) */}
          <div data-animate="bento-card" className="lg:col-span-4 bg-[#161920] border border-slate-800/80 rounded-[2rem] p-8 flex flex-col justify-between shadow-apple min-h-[460px] relative overflow-hidden group">
            <div className="space-y-6">
              <div className="w-10 h-10 bg-primary-500/10 text-primary-500 rounded-2xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Active Workspace</h3>
                <p className="text-sm text-slate-350 leading-relaxed">
                  Connect with over 1,000+ developers, track their availability in real time, and share Pomodoro focus sessions.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-800/60">
              {/* Stack of avatars */}
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-3.5 overflow-hidden">
                  <Image width={36} height={36} className="inline-block h-9 w-9 rounded-full ring-2 ring-[#161920] object-cover" src="/Assets/Img/default-avatar.png" alt="A1" />
                  <Image width={36} height={36} className="inline-block h-9 w-9 rounded-full ring-2 ring-[#161920] object-cover" src="/Assets/Img/default-avatar.png" alt="A2" />
                  <Image width={36} height={36} className="inline-block h-9 w-9 rounded-full ring-2 ring-[#161920] object-cover" src="/Assets/Img/default-avatar.png" alt="A3" />
                  <div className="inline-flex items-center justify-center h-9 w-9 rounded-full ring-2 ring-[#161920] bg-primary-500 text-white text-[10px] font-black">
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
          <div data-animate="bento-card" className="lg:col-span-4 bg-primary-500 text-white rounded-[2rem] p-8 flex flex-col justify-between shadow-lg shadow-primary-500/15 relative overflow-hidden group">
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
          <div data-animate="bento-card" className="lg:col-span-4 bg-slate-950 text-white border border-slate-900 rounded-[2rem] p-8 flex flex-col justify-between shadow-apple relative overflow-hidden">
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
          <div data-animate="bento-card" className="lg:col-span-4 bg-[#161920] border border-slate-800/80 rounded-[2rem] p-8 flex flex-col justify-between shadow-apple min-h-[220px]">
            <div className="space-y-4">
              <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">Real-Time Sync</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                SSE (Server-Sent Events) streaming connection pushes notifications and teammate availability updates to the client in under 100ms.
              </p>
            </div>
          </div>

        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: PARTNER LOGO MARQUEE
            Contains: GSAP-driven infinite brand ticker, edge fade masks, hover-pause
            ────────────────────────────────────────────────────────── */}
        <div id="features" className="max-w-7xl mx-auto w-full py-12 mt-12 border-t border-slate-800/60">
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-600 mb-8">
            Trusted by teams at
          </p>
          <div ref={marqueeWrapRef} className="marquee-wrapper">
            <div ref={marqueeTrackRef} className="marquee-track">
              {/* PLACEHOLDER BRANDS — replace with real partners/testimonials before public launch.
                  Two identical sets so an xPercent:-50 shift loops seamlessly. */}
              {['ADIDAS', 'NETFLIX', 'AMAZON', 'SPOTIFY', "MCDONALD'S", 'ADOBE', 'STRIPE',
                'ADIDAS', 'NETFLIX', 'AMAZON', 'SPOTIFY', "MCDONALD'S", 'ADOBE', 'STRIPE'].map((name, i) => (
                <span
                  key={i}
                  className="font-black text-base tracking-widest font-mono text-slate-700 hover:text-slate-400 transition-colors duration-200 px-10 flex-shrink-0 select-none"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

      </main>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: FOOTER
          Contains: Brand logo + name, copyright line
          ────────────────────────────────────────────────────────── */}
      <footer id="about" className="border-t border-slate-800 bg-surface-dark/50 backdrop-blur-sm py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/Assets/Img/Icon-orange.svg" alt="Zomzam Icon" className="w-6 h-6 hidden" />
            <img src="/Assets/Img/Icon-white.svg" alt="Zomzam Icon" className="w-6 h-6 block" />
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
