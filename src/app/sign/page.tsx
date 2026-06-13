'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Globe, ArrowLeft, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { DropdownItem } from '@/components/ui/DropdownItem';

function SignPageContent() {
  const { t, language, setLanguage } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [mounted, setMounted] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setMounted(true);
    // Read hash from url if any
    if (window.location.hash === '#signup') {
      setActiveTab('signup');
    }
    document.documentElement.classList.add('dark');
  }, []);

  const handleTabChange = (tab: 'signin' | 'signup') => {
    setActiveTab(tab);
    setMessage(null);
    if (tab === 'signin') {
      window.history.replaceState(null, '', ' ');
    } else {
      window.history.replaceState(null, '', '#signup');
    }
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
        const redirect = searchParams.get('redirect') || '/dashboard';
        setTimeout(() => {
          router.push(redirect);
          router.refresh();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Authentication failed' });
        setLoading(false);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Left Side: Image Box (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center">
        <img 
          src="/Assets/Img/auth-split-bg.jpg" 
          alt="Auth Background" 
          className="absolute inset-0 w-full h-full object-cover opacity-50 z-0 pointer-events-none select-none" 
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-[#1A1D24]/80 to-primary-900/30 z-10"></div>
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl z-10"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl z-10"></div>

        <div className="relative z-20 flex flex-col items-center justify-center p-12 text-center space-y-6">
          <span className="text-3xl font-black text-white tracking-widest flex items-center gap-3">
            <img src="/Assets/Img/Icon-white.svg" alt="Zomzam Icon" className="w-10 h-10" />
            zomzam.com
          </span>
          <h2 className="text-4xl font-black text-white tracking-tight leading-tight">
            Welcome to the Future
          </h2>
          <p className="text-slate-300 max-w-md">
            Experience a seamless, secure, and intuitive dashboard environment designed for elite performance.
          </p>
        </div>
      </div>

      {/* Right Side: Form Box */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center p-6 sm:p-12 overflow-y-auto min-h-screen">
        
        {/* Top Controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
          <div>
            <DropdownMenu
              open={langOpen}
              onClose={() => setLangOpen(false)}
              align="right"
              trigger={
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-500 dark:text-slate-400 bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-slate-800 py-2.5 px-4 rounded-full shadow-sm"
                  type="button"
                  aria-expanded={langOpen}
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



          {/* Back Home */}
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-500 dark:text-slate-400 bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-slate-800 py-2.5 px-4 rounded-full shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth_back')}
          </a>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md bg-white dark:bg-[#1A1D24] rounded-[2rem] p-8 sm:p-12 shadow-apple border border-slate-100 dark:border-slate-800/60 mt-12">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeTab === 'signin' ? t('auth_signin') : t('auth_signup')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {activeTab === 'signin' ? t('auth_signin_desc') : t('auth_signup_desc')}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex p-1 bg-slate-100 dark:bg-[#0f1115] rounded-2xl mb-8">
            <button
              onClick={() => handleTabChange('signin')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                activeTab === 'signin'
                  ? 'bg-white dark:bg-[#252830] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => handleTabChange('signup')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                activeTab === 'signup'
                  ? 'bg-white dark:bg-[#252830] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-xl text-sm font-bold flex items-start gap-3 border ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-bold">{message.type === 'success' ? 'Success' : 'Error'}</p>
                <p className="text-xs mt-0.5 opacity-90">{message.text}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {activeTab === 'signup' && (
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {t('auth_fullname')}
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Unique_Username"
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                {t('auth_email')}
              </label>
              <input
                type={activeTab === 'signin' ? 'text' : 'email'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={activeTab === 'signin' ? 'Username or Email' : 'name@company.com'}
                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {t('auth_password')}
                </label>
                {activeTab === 'signin' && (
                  <a href="/forgot-password" className="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors">
                    {t('auth_forgot')}
                  </a>
                )}
              </div>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
              />
              {activeTab === 'signup' && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {t('auth_pass_rule')}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Please wait...' : activeTab === 'signin' ? t('auth_signin') : t('auth_signup')}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </div>

            {activeTab === 'signup' && (
              <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
                {t('auth_terms')}
              </p>
            )}
          </form>

        </div>
      </div>
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f1115]">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SignPageContent />
    </Suspense>
  );
}
