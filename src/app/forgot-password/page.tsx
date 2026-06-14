'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, Mail, KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1 — request reset
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  // Step 2 — reset with token
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const isResetStep = !!token;

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add('dark');
  }, []);

  // Step 1: Request password reset email
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setRequestSent(true);
        setMessage({ type: 'success', text: data.message || 'Reset link sent! Check your inbox.' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to send reset link.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit new password with token
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setResetDone(true);
        setMessage({ type: 'success', text: 'Password updated successfully! Redirecting to login…' });
        setTimeout(() => router.push('/sign'), 2500);
      } else {
        setMessage({ type: 'error', text: data.message || 'Invalid or expired reset token.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-[#0f1115] text-slate-100 transition-colors duration-300">

      {/* Left decorative panel */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#1A1D24] to-primary-900/40 z-0" />
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl z-0" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl z-0" />
        <div className="relative z-20 flex flex-col items-center justify-center p-12 text-center space-y-6">
          <span className="text-3xl font-black text-white tracking-widest flex items-center gap-3">
            <img src="/Assets/Img/Icon-white.svg" alt="Zomzam Icon" className="w-10 h-10" />
            zomzam.com
          </span>
          <h2 className="text-4xl font-black text-white tracking-tight leading-tight">
            {isResetStep ? 'Create a New Password' : 'Recover Your Account'}
          </h2>
          <p className="text-slate-300 max-w-md">
            {isResetStep
              ? 'Choose a strong, unique password to secure your Zomzam account.'
              : 'Enter your registered email address and we\'ll send you a secure password reset link.'}
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center p-6 sm:p-12 overflow-y-auto min-h-screen">

        {/* Top controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
          <a
            href="/sign"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-primary-500 bg-[#1A1D24] border border-slate-800 py-2.5 px-4 rounded-full shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </a>
        </div>

        {/* Form card */}
        <div className="w-full max-w-md bg-[#1A1D24] rounded-[2rem] p-8 sm:p-12 shadow-apple border border-slate-800/60 mt-12">

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              {isResetStep ? <KeyRound className="w-8 h-8 text-white" /> : <Mail className="w-8 h-8 text-white" />}
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white tracking-tight">
              {isResetStep ? 'New Password' : 'Forgot Password?'}
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              {isResetStep
                ? 'Enter and confirm your new password below.'
                : 'No worries — we\'ll send a reset link to your email.'}
            </p>
          </div>

          {/* Status message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-bold flex items-start gap-3 border${
              message.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success'
                ? <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                : <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />}
              <p className="text-xs mt-0.5 opacity-90">{message.text}</p>
            </div>
          )}

          {/* ── STEP 1: Request Reset ── */}
          {!isResetStep && !requestSent && (
            <form onSubmit={handleRequestReset} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-5 py-3.5 bg-[#0f1115] border border-slate-800 rounded-xl text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}

          {/* Step 1 success state */}
          {!isResetStep && requestSent && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-sm text-slate-400">
                Check your inbox at <span className="font-bold text-white">{email}</span> for the reset link.
              </p>
              <button
                onClick={() => { setRequestSent(false); setEmail(''); setMessage(null); }}
                className="text-xs text-primary-500 hover:text-primary-600 font-semibold underline underline-offset-2"
              >
                Try a different email
              </button>
            </div>
          )}

          {/* ── STEP 2: Set New Password ── */}
          {isResetStep && !resetDone && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* New password */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-5 py-3.5 pr-12 bg-[#0f1115] border border-slate-800 rounded-xl text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Must be at least 8 characters</p>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-5 py-3.5 pr-12 bg-[#0f1115] border border-slate-800 rounded-xl text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
                </button>
              </div>
            </form>
          )}

          {/* Step 2 success state */}
          {isResetStep && resetDone && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-sm text-slate-400">
                Your password has been updated. Redirecting you to sign in…
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0f1115]">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
