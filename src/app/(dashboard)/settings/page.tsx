'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation, ZLANG_CONFIG } from '@/context/TranslationContext';
import { Settings, Globe, Shield, Bell, Key, Eye, EyeOff, Save, CheckCircle, AlertTriangle, Loader2, Clock, Trash2, AlertOctagon } from 'lucide-react';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { DropdownItem } from '@/components/ui/DropdownItem';

const COMMON_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Asia/Singapore',
];

const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP'];

export default function SettingsPage() {
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();

  // Settings states
  const [timezone, setTimezone] = useState('UTC');
  const [primaryCurrency, setPrimaryCurrency] = useState('EGP');
  const [secondaryCurrency, setSecondaryCurrency] = useState('USD');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [primaryCurrencyOpen, setPrimaryCurrencyOpen] = useState(false);
  const [secondaryCurrencyOpen, setSecondaryCurrencyOpen] = useState(false);

  // Live timezone clock
  const [liveClock, setLiveClock] = useState('');

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Account deletion states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePass, setShowDeletePass] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Status states
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);

  const [prefError, setPrefError] = useState<string | null>(null);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // Fetch initial user settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/auth?action=check');
        const data = await res.json();
        if (data.success && data.authenticated && data.user) {
          setTimezone(data.user.timezone || 'UTC');
          setPrimaryCurrency(data.user.primary_currency || 'EGP');
          setSecondaryCurrency(data.user.secondary_currency || 'USD');
          setNotificationsEnabled(!!data.user.notifications_enabled);
        }
      } catch (err) {
        console.error('Failed to load user settings:', err);
      } finally {
        setIsPageLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Live clock that updates every second in the selected timezone
  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          weekday: 'short',
        });
        const dateFormatted = now.toLocaleDateString('en-US', {
          timeZone: timezone,
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        setLiveClock(`${formatted} · ${dateFormatted}`);
      } catch {
        setLiveClock('');
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  // Handle saving general preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefError(null);
    setPrefSuccess(null);
    setIsSavingPref(true);

    try {
      const res = await fetch('/api/auth?action=update_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          notifications_enabled: notificationsEnabled,
          primary_currency: primaryCurrency,
          secondary_currency: secondaryCurrency,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPrefSuccess(t('settings_save_success'));
        // Trigger page refresh to propagate header/context updates
        router.refresh();
      } else {
        setPrefError(data.message || 'Failed to save settings');
      }
    } catch (err) {
      console.error(err);
      setPrefError('An error occurred while saving settings');
    } finally {
      setIsSavingPref(false);
    }
  };

  // Handle saving new password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPassError('Password must be at least 8 characters');
      return;
    }

    setIsSavingPass(true);

    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPassSuccess(t('settings_pass_success'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassError(data.message || 'Failed to update password');
      }
    } catch (err) {
      console.error(err);
      setPassError('An error occurred while updating password');
    } finally {
      setIsSavingPass(false);
    }
  };

  // Handle account deletion with password verification
  const handleDeleteAccount = async () => {
    setDeleteError(null);
    if (!deletePassword) {
      setDeleteError('Please enter your current password to confirm deletion.');
      return;
    }
    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (data.success) {
        // Redirect to sign-in after deletion
        router.push('/sign');
        router.refresh();
      } else {
        setDeleteError(data.message || 'Failed to delete account.');
        setIsDeletingAccount(false);
      }
    } catch {
      setDeleteError('An unexpected error occurred.');
      setIsDeletingAccount(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('settings_title')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('settings_desc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Navigation / Intro card */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple space-y-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Sections
            </h2>
            <nav className="flex flex-col gap-1">
              <a
                href="#preferences"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-all"
              >
                <Globe className="w-4 h-4 text-slate-400" />
                <span>{t('settings_pref')}</span>
              </a>
              <a
                href="#security"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-all"
              >
                <Shield className="w-4 h-4 text-slate-400" />
                <span>{t('settings_security')}</span>
              </a>
              <a
                href="#danger"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Danger Zone</span>
              </a>
            </nav>
          </div>
        </div>

        {/* Form Container */}
        <div className="md:col-span-2 space-y-8">
          {/* General Settings Form */}
          <section
            id="preferences"
            className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-850">
              <div className="w-8 h-8 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
                <Globe className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                {t('settings_pref')}
              </h2>
            </div>

            {prefSuccess && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-xs">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{prefSuccess}</span>
              </div>
            )}

            {prefError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{prefError}</span>
              </div>
            )}

            <form onSubmit={handleSavePreferences} className="space-y-6">
              {/* Language Preference */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('settings_lang')}
                </label>
                <DropdownMenu
                  open={langOpen}
                  onClose={() => setLangOpen(false)}
                  align="left"
                  trigger={
                    <button
                      type="button"
                      onClick={() => setLangOpen((s) => !s)}
                      className="w-full h-11 flex items-center justify-between px-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none"
                      aria-expanded={langOpen}
                    >
                      <span className="truncate">{ZLANG_CONFIG[language]?.lang_name || language}</span>
                      <span className="text-xs text-slate-400">▼</span>
                    </button>
                  }
                >
                  {Object.keys(ZLANG_CONFIG).map((lang) => (
                    <DropdownItem
                      key={lang}
                      onClick={() => {
                        setLanguage(lang);
                        setLangOpen(false);
                      }}
                    >
                      {ZLANG_CONFIG[lang].lang_name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </div>

              {/* Timezone Preference */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('settings_timezone')}
                </label>
                <DropdownMenu
                  open={timezoneOpen}
                  onClose={() => setTimezoneOpen(false)}
                  align="left"
                  trigger={
                    <button
                      type="button"
                      onClick={() => setTimezoneOpen((s) => !s)}
                      className="w-full h-11 flex items-center justify-between px-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none"
                      aria-expanded={timezoneOpen}
                    >
                      <span className="truncate">{timezone}</span>
                      <span className="text-xs text-slate-400">▼</span>
                    </button>
                  }
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <DropdownItem
                      key={tz}
                      onClick={() => {
                        setTimezone(tz);
                        setTimezoneOpen(false);
                      }}
                    >
                      {tz}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
                {/* Live clock preview */}
                {liveClock && (
                  <div className="mt-2 flex items-center gap-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl">
                    <Clock className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                      {liveClock}
                    </span>
                  </div>
                )}
              </div>

              {/* Currencies preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    {t('settings_primary_curr')}
                  </label>
                  <DropdownMenu
                    open={primaryCurrencyOpen}
                    onClose={() => setPrimaryCurrencyOpen(false)}
                    align="left"
                    trigger={
                      <button
                        type="button"
                        onClick={() => setPrimaryCurrencyOpen((s) => !s)}
                        className="w-full h-11 flex items-center justify-between px-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none"
                        aria-expanded={primaryCurrencyOpen}
                      >
                        <span className="truncate">{primaryCurrency}</span>
                        <span className="text-xs text-slate-400">▼</span>
                      </button>
                    }
                  >
                    {CURRENCIES.map((c) => (
                      <DropdownItem
                        key={c}
                        onClick={() => {
                          setPrimaryCurrency(c);
                          setPrimaryCurrencyOpen(false);
                        }}
                      >
                        {c}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    {t('settings_secondary_curr')}
                  </label>
                  <DropdownMenu
                    open={secondaryCurrencyOpen}
                    onClose={() => setSecondaryCurrencyOpen(false)}
                    align="left"
                    trigger={
                      <button
                        type="button"
                        onClick={() => setSecondaryCurrencyOpen((s) => !s)}
                        className="w-full h-11 flex items-center justify-between px-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none"
                        aria-expanded={secondaryCurrencyOpen}
                      >
                        <span className="truncate">{secondaryCurrency}</span>
                        <span className="text-xs text-slate-400">▼</span>
                      </button>
                    }
                  >
                    {CURRENCIES.map((c) => (
                      <DropdownItem
                        key={c}
                        onClick={() => {
                          setSecondaryCurrency(c);
                          setSecondaryCurrencyOpen(false);
                        }}
                      >
                        {c}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </div>
              </div>

              {/* Notification Preference Toggle */}
              <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850/50 rounded-2xl">
                <div className="space-y-0.5 pr-4">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-slate-400" />
                    {t('settings_notifications')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {t('settings_notif_desc')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${
                    notificationsEnabled ? 'bg-primary-500' : 'bg-slate-350 dark:bg-slate-700'
                  }`}
                  aria-label="Toggle notifications"
                >
                  <span
                    className={`w-4 h-4 bg-white rounded-full transition-transform absolute shadow-sm ${
                      notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                disabled={isSavingPref}
                className="w-full h-11 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSavingPref ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {t('settings_save')}
              </button>
            </form>
          </section>

          {/* Security Change Password Form */}
          <section
            id="security"
            className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-850">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <Key className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                {t('settings_security')}
              </h2>
            </div>

            {passSuccess && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-xs">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            {passError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-5">
              {/* Current Password */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('settings_curr_pass')}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full h-11 pl-4 pr-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('settings_new_pass')}
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full h-11 pl-4 pr-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('settings_confirm_pass')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full h-11 pl-4 pr-11 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingPass}
                className="w-full h-11 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-750 disabled:bg-slate-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSavingPass ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                {t('settings_password_change')}
              </button>
            </form>
          </section>

          {/* ── DANGER ZONE ── */}
          <section
            id="danger"
            className="bg-white dark:bg-[#1A1D24] border border-red-200 dark:border-red-900/40 rounded-3xl p-6 shadow-apple scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-red-100 dark:border-red-900/30">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertOctagon className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Danger Zone</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Irreversible actions. Proceed with caution.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Delete Account</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-xs">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(true); setDeleteError(null); setDeletePassword(''); }}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all active:scale-[0.98] shadow-sm shadow-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete My Account
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ── Account Deletion Confirmation Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1A1D24] rounded-3xl p-8 shadow-xl border border-red-200 dark:border-red-900/40 animate-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Delete Account?</h3>
                <p className="text-xs text-slate-400">This action is permanent and irreversible.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              All your data — tasks, money records, ideas, plans, and social connections — will be permanently removed.
              Enter your current password to confirm.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mb-6">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showDeletePass ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full h-11 pl-4 pr-11 bg-slate-50 dark:bg-slate-900/30 border border-red-200 dark:border-red-900/40 rounded-xl text-sm focus:outline-none focus:border-red-500 transition-all text-slate-800 dark:text-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePass(!showDeletePass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showDeletePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(null); }}
                disabled={isDeletingAccount}
                className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || !deletePassword}
                className="flex-1 h-11 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeletingAccount ? 'Deleting…' : 'Yes, Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
