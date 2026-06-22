'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import {
  Globe, ArrowLeft, ArrowRight,
  Mail, Lock, User, Eye, EyeOff,
} from 'lucide-react';
import OrbitRings from '@/components/ui/OrbitRings';
import { DropdownMenu, DropdownItem } from '@/components/ui/Dropdown';
import { Alert } from '@/components/ui/Alert';
import { Button, Input, Divider, SegmentedSwitch } from '@/components/ui';
import { gsap, useGSAP, SplitText } from '@/lib/gsap';

function oauthErrorMessage(code: string): string {
  switch (code) {
    case 'email_unverified':
      return "Your account's email isn't verified yet. Verify it with your provider, then try again.";
    case 'no_email':
      return "We couldn't get your email from Facebook. Allow email access in the consent screen, then try again.";
    case 'account_unavailable':
      return 'This account is unavailable. Contact support if you think this is a mistake.';
    default:
      return "Sign-in didn't go through. Please try again.";
  }
}

function SignPageContent() {
  const { t, language, setLanguage } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  // Drives the SegmentedSwitch indicator only — updates instantly on click
  // (<100ms feedback) while `activeTab` (the form content) is intentionally
  // delayed until the fields finish fading out, see animateTabSwitch below.
  const [pillTab, setPillTab] = useState<'signin' | 'signup'>('signin');
  const [mounted, setMounted] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const pageRef         = useRef<HTMLDivElement>(null);
  const bgGlowRef       = useRef<HTMLDivElement>(null);
  const ringsRef        = useRef<SVGSVGElement>(null);
  const cardRef         = useRef<HTMLDivElement>(null);
  const headingRef      = useRef<HTMLHeadingElement>(null);
  const formFieldsRef   = useRef<HTMLDivElement>(null);
  const alertRef        = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (window.location.hash === '#signup') {
      setActiveTab('signup');
      setPillTab('signup');
    }
    document.documentElement.classList.add('dark');

    const oauthError = searchParams.get('error');
    if (oauthError) {
      setMessage({ type: 'error', text: oauthErrorMessage(oauthError) });
    }
  }, []);

  const handleGoogleSignIn = () => {
    const redirect = searchParams.get('redirect') || '/home';
    window.location.href = `/api/auth/oauth/google?redirect=${encodeURIComponent(redirect)}`;
  };

  const handleFacebookSignIn = () => {
    const redirect = searchParams.get('redirect') || '/home';
    window.location.href = `/api/auth/oauth/facebook?redirect=${encodeURIComponent(redirect)}`;
  };

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: PAGE ENTRANCE CHOREOGRAPHY (GSAP)
  // One orchestrated sequence: glow blooms (t=0) → card rises
  // (t=0.30) → heading SplitText (t=0.55) → fields stagger (t=0.65).
  // bgGlowRef centered via margin offset (not CSS transform) so
  // GSAP's scale tween has no transform conflict.
  // ──────────────────────────────────────────────────────────
  const { contextSafe } = useGSAP(
    () => {
      if (!mounted) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from(bgGlowRef.current, { scale: 0.3, autoAlpha: 0, duration: 1.4, ease: 'power2.out' }, 0);
      tl.from(ringsRef.current, { autoAlpha: 0, duration: 1.2, ease: 'power2.out' }, 0);
      tl.from(cardRef.current, { scale: 0.93, y: 20, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.4)' }, 0.3);

      if (headingRef.current) {
        const split = SplitText.create(headingRef.current, {
          type: 'chars',
          mask: 'chars',
          aria: 'auto',
        });
        tl.from(
          split.chars,
          { yPercent: 110, duration: 0.4, stagger: { amount: 0.28, from: 'start' }, ease: 'back.out(1.4)' },
          0.55,
        );
      }

      if (formFieldsRef.current) {
        const fields = gsap.utils.toArray<HTMLElement>('[data-field]', formFieldsRef.current);
        tl.from(fields, { y: 12, autoAlpha: 0, duration: 0.38, stagger: 0.06 }, 0.65);
      }
    },
    { scope: pageRef, dependencies: [mounted] },
  );

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: TAB SWITCH ANIMATION (GSAP)
  // Pill slides (instant, via pillTab → SegmentedSwitch's own CSS
  // transition) while fields fade-exit → state update → fade-in.
  // window.matchMedia used directly (not gsap.matchMedia) to avoid
  // leaking uncleaned matchMedia instances inside contextSafe.
  // ──────────────────────────────────────────────────────────
  const animateTabSwitch = contextSafe((newTab: 'signin' | 'signup') => {
    const fields = formFieldsRef.current;
    if (!fields) return;

    setPillTab(newTab);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActiveTab(newTab);
      setMessage(null);
      return;
    }

    const tl = gsap.timeline();
    tl.to(fields, { autoAlpha: 0, y: -8, duration: 0.18, ease: 'power2.in' }, 0);
    tl.call(() => { setActiveTab(newTab); setMessage(null); });
    // 50 ms gap lets React flush the DOM update before animating in
    tl.to(fields, { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' }, '+=0.05');
  });

  useGSAP(
    () => {
      if (!message || !alertRef.current) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from(alertRef.current, { y: -10, autoAlpha: 0, duration: 0.35, ease: 'back.out(1.3)' });
    },
    { scope: pageRef, dependencies: [message] },
  );

  const handleTabChange = (tab: 'signin' | 'signup') => {
    if (tab === 'signin') {
      window.history.replaceState(null, '', ' ');
    } else {
      window.history.replaceState(null, '', '#signup');
    }
    animateTabSwitch(tab);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const action = activeTab === 'signin' ? 'login' : 'register';
    const payload =
      activeTab === 'signin'
        ? { identifier: email, password }
        : { username, email, password };

    try {
      const res = await fetch(`/api/auth?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Authentication successful. Redirecting...' });
        const redirect = searchParams.get('redirect') || '/home';
        setTimeout(() => {
          router.push(redirect);
          router.refresh();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Authentication failed' });
        setLoading(false);
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
      setLoading(false);
    }
  };

  return (
    <div ref={pageRef} className="min-h-screen w-full bg-[#09090b] flex items-center justify-center relative overflow-hidden">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: AMBIENT BACKGROUND
          Contains: orange radial glow (bgGlowRef — blooms from
          scale 0.3 at t=0), OrbitRings SVG (ringsRef — 3 concentric
          arc rings, CSS-rotated, GSAP fade-in at t=0)
          ────────────────────────────────────────────────────────── */}
      <div
        ref={bgGlowRef}
        aria-hidden="true"
        className="absolute z-0 pointer-events-none"
        style={{
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(238,87,18,0.35) 0%, rgba(238,87,18,0.12) 36%, rgba(238,87,18,0.03) 58%, transparent 72%)',
          filter: 'blur(40px)',
          top: '50%',
          left: '50%',
          marginLeft: '-450px',
          marginTop: '-450px',
        }}
      />

      <OrbitRings ref={ringsRef} />

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: TOP NAVIGATION BAR
          Contains: back link (left), language switcher (right)
          ────────────────────────────────────────────────────────── */}
      <div className="absolute top-5 left-0 right-0 px-6 flex items-center justify-between z-20">
        <a
          href="/"
          className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-300 transition-colors duration-150"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('auth_back')}
        </a>

        <DropdownMenu
          open={langOpen}
          onClose={() => setLangOpen(false)}
          align="right"
          trigger={
            <Button
              variant="unstyled"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-300 transition-colors duration-150 py-1.5 px-3"
              type="button"
              aria-expanded={langOpen}
            >
              <Globe className="w-3.5 h-3.5" />
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: AUTH CARD
          Contains: logo + wordmark, heading (SplitText target),
          subtext, tab switcher (SegmentedSwitch), alert slot,
          social login grid, Divider OR, form fields (GSAP stagger),
          submit button, terms copy (signup only)
          Orange inset underlight in box-shadow = signature detail.
          ────────────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-[400px] mx-4 sm:mx-6 rounded-3xl"
        style={{
          background: 'rgba(13, 15, 20, 0.80)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow:
            '0 0 0 1px rgba(238, 87, 18, 0.07), 0 40px 80px -20px rgba(0, 0, 0, 0.80), inset 0 -1px 0 0 rgba(238, 87, 18, 0.14)',
        }}
      >
        <div className="p-8 space-y-5">

          {/* Logo + wordmark */}
          <div className="flex items-center gap-2.5">
            <img src="/Assets/Img/Icon-white.svg" alt="Zomzam" className="w-7 h-7" />
            <span className="text-white font-black text-[15px] tracking-tight">zomzam</span>
          </div>

          {/* Heading — SplitText target on entrance */}
          <div className="space-y-1 pt-1">
            <h1
              ref={headingRef}
              className="text-[1.65rem] font-black text-white tracking-tight leading-tight"
            >
              {activeTab === 'signin' ? 'Welcome back.' : 'Create account.'}
            </h1>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              {activeTab === 'signin' ? t('auth_signin_desc') : t('auth_signup_desc')}
            </p>
          </div>

          {/* Tab switcher — Kit SegmentedSwitch, driven by pillTab for instant feedback */}
          <SegmentedSwitch
            ariaLabel="Choose sign in or create account"
            value={pillTab}
            onChange={(tab) => handleTabChange(tab as 'signin' | 'signup')}
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create account' },
            ]}
          />

          {/* Alert — GSAP animates entrance via alertRef */}
          {message && (
            <div ref={alertRef}>
              <Alert variant={message.type} title={message.type === 'success' ? 'Success' : 'Error'}>
                {message.text}
              </Alert>
            </div>
          )}

          {/* Social login — compact two-column grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex items-center justify-center gap-2 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-xl text-[13px] font-semibold text-slate-300 hover:bg-white/[0.07] hover:border-white/[0.13] hover:text-white transition-all duration-150"
            >
              <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] flex-shrink-0" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button
              type="button"
              onClick={handleFacebookSignIn}
              className="flex items-center justify-center gap-2 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-xl text-[13px] font-semibold text-slate-300 hover:bg-white/[0.07] hover:border-white/[0.13] hover:text-white transition-all duration-150"
            >
              <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] flex-shrink-0" aria-hidden="true">
                <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </button>
          </div>

          <Divider label="OR" />

          {/* Form — all field bindings and logic are untouched */}
          <form onSubmit={handleSubmit}>
            <div ref={formFieldsRef} className="space-y-4">

              {activeTab === 'signup' && (
                <div data-field>
                  <Input
                    label={t('auth_fullname')}
                    type="text"
                    required
                    minLength={3}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Unique_Username"
                    leftIcon={<User className="w-4 h-4" />}
                    size="lg"
                  />
                </div>
              )}

              <div data-field>
                <Input
                  label={t('auth_email')}
                  type={activeTab === 'signin' ? 'text' : 'email'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={activeTab === 'signin' ? 'Username or Email' : 'name@company.com'}
                  leftIcon={<Mail className="w-4 h-4" />}
                  size="lg"
                />
              </div>

              <div data-field>
                <Input
                  label={t('auth_password')}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Toggle password visibility"
                      className="hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  size="lg"
                  hint={activeTab === 'signup' ? t('auth_pass_rule') : undefined}
                />
                {activeTab === 'signin' && (
                  <div className="flex justify-end mt-2">
                    <a
                      href="/forgot-password"
                      className="text-[11px] font-semibold text-primary-500 hover:text-primary-400 transition-colors"
                    >
                      {t('auth_forgot')}
                    </a>
                  </div>
                )}
              </div>

              <div data-field className="pt-0.5">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  fullWidth
                  size="lg"
                  shape="2xl"
                  loading={loading}
                  rightIcon={!loading ? <ArrowRight className="w-4 h-4" /> : undefined}
                  className="breathing"
                >
                  {loading
                    ? 'Please wait…'
                    : activeTab === 'signin'
                    ? t('auth_signin')
                    : t('auth_signup')}
                </Button>
              </div>

              {activeTab === 'signup' && (
                <p data-field className="text-[10px] text-center text-slate-500 leading-relaxed">
                  {t('auth_terms')}
                </p>
              )}

            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SignPageContent />
    </Suspense>
  );
}
