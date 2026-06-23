'use client';

import React, { useRef, useState, useEffect } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useRouter } from 'next/navigation';
import { useTranslation, LANGUAGES } from '@/context/TranslationContext';
import { Settings, Globe, Shield, Bell, Key, Eye, EyeOff, Loader2, Clock, Trash2, AlertOctagon, Briefcase, Database, RefreshCw } from 'lucide-react';
import { Button, Switch, Modal, Select, NumberInput, Alert, useToast } from '@/components/ui';

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
  const { toast } = useToast();

  // Settings states
  const [timezone, setTimezone] = useState('UTC');
  const [primaryCurrency, setPrimaryCurrency] = useState('EGP');
  const [secondaryCurrency, setSecondaryCurrency] = useState('USD');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);


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

  const containerRef = useRef<HTMLDivElement>(null);
  usePageEntrance(containerRef, [isPageLoading]);

  // CRM settings states
  const [crmSettings, setCrmSettings] = useState<Record<string, string>>({
    CLAUDE_API_KEY: "",
    GOOGLE_MAPS_API_KEY: "",
    GOOGLE_MAPS_MAP_ID: "",
    claude_model: "claude-3-5-sonnet-latest",
    claude_tone: "professional",
    claude_temperature: "0.75",
    claude_max_tokens: "800",
    system_signature: "",
  });
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [showMapsKey, setShowMapsKey] = useState(false);
  const [isSavingCrm, setIsSavingCrm] = useState(false);

  // Notion Settings States
  const [notionSettings, setNotionSettings] = useState<Record<string, string>>({
    NOTION_API_KEY: "",
    NOTION_DATABASE_ID_TASKS: "",
    NOTION_DATABASE_ID_PROJECTS: "",
    NOTION_DATABASE_ID_LINKS: "",
  });
  const [showNotionKey, setShowNotionKey] = useState(false);
  const [isSavingNotion, setIsSavingNotion] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // Fetch CRM Settings
  useEffect(() => {
    async function loadCrmSettings() {
      try {
        const response = await fetch('/api/crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_crm_settings' })
        });
        const res = await response.json();
        if (res.success && res.settings) {
          setCrmSettings(prev => ({
            ...prev,
            ...res.settings
          }));
        }
      } catch (err) {
        console.error("Failed to load CRM settings:", err);
      }
    }
    loadCrmSettings();
  }, []);

  // Fetch Notion Settings
  useEffect(() => {
    async function loadNotionSettings() {
      try {
        const response = await fetch('/api/notion');
        const res = await response.json();
        if (res.success && res.settings) {
          setNotionSettings(prev => ({
            ...prev,
            ...res.settings
          }));
        }
      } catch (err) {
        console.error("Failed to load Notion settings:", err);
      }
    }
    loadNotionSettings();
  }, []);

  const handleSaveNotionSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotion(true);

    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_settings', settings: notionSettings }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ variant: 'success', description: 'Notion settings updated successfully!' });
      } else {
        toast({ variant: 'error', description: data.error || 'Failed to save Notion settings' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', description: 'An error occurred while saving Notion settings' });
    } finally {
      setIsSavingNotion(false);
    }
  };

  const handleNotionFieldChange = (key: string, value: string) => {
    setNotionSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSyncNotion = async () => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (data.success) {
        const stats = data.stats;
        toast({
          variant: 'success',
          title: 'Notion sync complete',
          description: `Synced ${stats.tasks} tasks, ${stats.projects} projects, ${stats.links} links.`,
        });
      } else {
        toast({ variant: 'error', description: data.error || 'Failed to synchronize with Notion' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', description: 'An error occurred during synchronization' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveCrmSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCrm(true);

    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_crm_settings', settings: crmSettings }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ variant: 'success', description: 'CRM settings updated successfully!' });
      } else {
        toast({ variant: 'error', description: data.error || 'Failed to save CRM settings' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', description: 'An error occurred while saving CRM settings' });
    } finally {
      setIsSavingCrm(false);
    }
  };

  const handleCrmFieldChange = (key: string, value: string) => {
    setCrmSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

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
        toast({ variant: 'success', description: t('settings_save_success') });
        // Trigger page refresh to propagate header/context updates
        router.refresh();
      } else {
        toast({ variant: 'error', description: data.message || 'Failed to save settings' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', description: 'An error occurred while saving settings' });
    } finally {
      setIsSavingPref(false);
    }
  };

  // Handle saving new password — on success we force a logout so the
  // session can't outlive the credential change (other devices/tabs are
  // invalidated when the user signs back in with the new password).
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({ variant: 'error', description: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      toast({ variant: 'error', description: 'Password must be at least 8 characters' });
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
        toast({ variant: 'success', description: 'Password changed — signing you out…' });
        // Tear down the current session, then bounce to sign-in. Keep the
        // form disabled (isSavingPass stays true) through the redirect.
        await fetch('/api/auth?action=logout', { method: 'POST' }).catch(() => {});
        router.push('/sign');
        router.refresh();
      } else {
        toast({ variant: 'error', description: data.message || 'Failed to update password' });
        setIsSavingPass(false);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', description: 'An error occurred while updating password' });
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
    <div ref={containerRef} className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">
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
          <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple space-y-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Sections
            </h2>
            <nav className="flex flex-col gap-1">
              <a
                href="#preferences"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-350 hover:bg-slate-850 rounded-xl transition-all"
              >
                <Globe className="w-4 h-4 text-slate-400" />
                <span>{t('settings_pref')}</span>
              </a>
              {/* CRM & Outreach nav link — DISABLED for now (CRM & Lead Generation paused).
                  Kept in code for future re-activation. Restore by uncommenting.
              <a
                href="#crm"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-350 hover:bg-slate-850 rounded-xl transition-all"
              >
                <Briefcase className="w-4 h-4 text-slate-400" />
                <span>CRM & Outreach</span>
              </a>
              */}
              <a
                href="#notion"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-350 hover:bg-slate-850 rounded-xl transition-all"
              >
                <Database className="w-4 h-4 text-slate-400" />
                <span>Notion Sync</span>
              </a>
              <a
                href="#security"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-350 hover:bg-slate-850 rounded-xl transition-all"
              >
                <Shield className="w-4 h-4 text-slate-400" />
                <span>{t('settings_security')}</span>
              </a>
              <a
                href="#danger"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-950/20 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Danger Zone</span>
              </a>
            </nav>
          </div>
        </div>

        {/* Form Container */}
        <div className="md:col-span-2 space-y-8">
          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: GENERAL PREFERENCES SECTION
              Contains: Language, Timezone, Currencies, and Notification options
              ────────────────────────────────────────────────────────── */}
          <section
            id="preferences"
            data-entrance="card"
            className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-850">
              <div className="w-8 h-8 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
                <Globe className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
                {t('settings_pref')}
              </h2>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-6">
              {/* Language Preference */}
              <Select
                label={t('settings_lang')}
                value={language}
                onChange={(val) => setLanguage(val)}
                options={LANGUAGES.map((lang) => ({
                  value: lang.code,
                  label: lang.name,
                }))}
              />

              {/* Timezone Preference */}
              <div data-entrance="list-item">
                <Select
                  label={t('settings_timezone')}
                  value={timezone}
                  onChange={(val) => setTimezone(val)}
                  options={COMMON_TIMEZONES}
                />
                {/* Live clock preview */}
                {liveClock && (
                  <div className="mt-2 flex items-center gap-2 px-3.5 py-2 bg-slate-900/30 border border-slate-850 rounded-xl">
                    <Clock className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-300 tabular-nums">
                      {liveClock}
                    </span>
                  </div>
                )}
              </div>

              {/* Currencies preferences */}
              <div data-entrance="list-item" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label={t('settings_primary_curr')}
                  value={primaryCurrency}
                  onChange={(val) => setPrimaryCurrency(val)}
                  options={CURRENCIES}
                />

                <Select
                  label={t('settings_secondary_curr')}
                  value={secondaryCurrency}
                  onChange={(val) => setSecondaryCurrency(val)}
                  options={CURRENCIES}
                />
              </div>

              {/* Notification Preference Toggle */}
              <div data-entrance="list-item" className="flex items-start justify-between p-4 bg-slate-900/30 border border-slate-850/50 rounded-2xl">
                <div className="space-y-0.5 pr-4">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-slate-400" />
                    {t('settings_notifications')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {t('settings_notif_desc')}
                  </span>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onChange={setNotificationsEnabled}
                  ariaLabel="Toggle notifications"
                />
              </div>

              <Button
                type="submit"
                loading={isSavingPref}
                className="w-full h-11"
              >
                {t('settings_save')}
              </Button>
            </form>
          </section>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: CRM & OUTREACH SECTION — DISABLED
              Status: Temporarily disabled (CRM & Lead Generation feature paused).
                      Kept in code for future re-activation — flip the `false &&`
                      guard below back on to restore the full section.
              Contains: Secure API keys (Claude, Maps) and Outreach tone parameters
              ────────────────────────────────────────────────────────── */}
          {false && (
          <section
            id="crm"
            className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-850">
              <div className="w-8 h-8 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
                <Briefcase className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
                CRM & Outreach Settings
              </h2>
            </div>

            <form onSubmit={handleSaveCrmSettings} className="space-y-6">
              {/* API Keys */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Secure API Credentials
                </h3>

                {/* Claude API Key */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Anthropic Claude API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showClaudeKey ? 'text' : 'password'}
                      value={crmSettings.CLAUDE_API_KEY || ''}
                      onChange={(e) => handleCrmFieldChange('CLAUDE_API_KEY', e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full h-11 pl-4 pr-11 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white font-mono"
                    />
                    <Button variant="unstyled"
                      type="button"
                      onClick={() => setShowClaudeKey(!showClaudeKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-350 transition-colors"
                    >
                      {showClaudeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <span className="text-[10px] text-slate-400 block leading-normal">
                    Used to generate customized cold outreach copy via Claude API. Stored securely on your local database.
                  </span>
                </div>

                {/* Google Maps API Key */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Google Maps API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showMapsKey ? 'text' : 'password'}
                      value={crmSettings.GOOGLE_MAPS_API_KEY || ''}
                      onChange={(e) => handleCrmFieldChange('GOOGLE_MAPS_API_KEY', e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full h-11 pl-4 pr-11 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white font-mono"
                    />
                    <Button variant="unstyled"
                      type="button"
                      onClick={() => setShowMapsKey(!showMapsKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-350 transition-colors"
                    >
                      {showMapsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <span className="text-[10px] text-slate-400 block leading-normal">
                    Required for the Live Map Scanner and Place autocomplete. Ensure <strong>Maps JavaScript API</strong> and <strong>Places API (New)</strong> are enabled in Google Cloud Console.
                  </span>
                </div>

                {/* Google Maps Map ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Google Maps Map ID
                  </label>
                  <input
                    type="text"
                    value={crmSettings.GOOGLE_MAPS_MAP_ID || ''}
                    onChange={(e) => handleCrmFieldChange('GOOGLE_MAPS_MAP_ID', e.target.value)}
                    placeholder="e.g. CRM_LEADS_MAP"
                    className="w-full h-11 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-400 block leading-normal">
                    Vector Map ID required for drawing administrative search boundary highlights. Defaults to <code className="bg-white/5 px-1 py-0.5 rounded text-[#EE5712]">CRM_LEADS_MAP</code>.
                  </span>
                </div>
              </div>

              {/* Claude Settings */}
              <div className="space-y-4 border-t border-slate-850 pt-5">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Claude Engine Parameters
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Claude Model Variant"
                    value={crmSettings.claude_model || 'claude-3-5-sonnet-latest'}
                    onChange={(val) => handleCrmFieldChange('claude_model', val)}
                    options={[
                      { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet (Best)' },
                      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet v2' },
                      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
                      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Power)' },
                    ]}
                  />

                  <Select
                    label="Outreach Tone"
                    value={crmSettings.claude_tone || 'professional'}
                    onChange={(val) => handleCrmFieldChange('claude_tone', val)}
                    options={[
                      { value: 'professional', label: 'Professional & Polished' },
                      { value: 'empathetic', label: 'Empathetic & Warm' },
                      { value: 'direct', label: 'Direct & Concise' },
                      { value: 'creative', label: 'Creative & Bold' },
                      { value: 'persuasive', label: 'Persuasive & ROI-driven' },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Max Output Tokens
                    </label>
                    <NumberInput
                      min={100}
                      max={4000}
                      step={100}
                      value={crmSettings.claude_max_tokens || '800'}
                      onChange={(val) => handleCrmFieldChange('claude_max_tokens', val)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>Temperature (Creativity)</span>
                      <span className="text-primary-500 font-extrabold">{crmSettings.claude_temperature || '0.75'}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={crmSettings.claude_temperature || '0.75'}
                      onChange={(e) => handleCrmFieldChange('claude_temperature', e.target.value)}
                      className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#EE5712] outline-none mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* Outreach Signature */}
              <div className="space-y-2 border-t border-slate-850 pt-5">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  System Signature
                </h3>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Outbound Email Signature
                  </label>
                  <textarea
                    value={crmSettings.system_signature || ''}
                    onChange={(e) => handleCrmFieldChange('system_signature', e.target.value)}
                    placeholder="e.g. Best regards,&#10;[Your Name]&#10;Zomzam Executive"
                    rows={3}
                    className="w-full p-3.5 bg-slate-900/30 border border-slate-850 rounded-xl text-xs focus:outline-none focus:border-primary-500 transition-all text-white resize-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                loading={isSavingCrm}
                className="w-full h-11"
              >
                Save CRM & Outreach Settings
              </Button>
            </form>
          </section>
          )}

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: NOTION INTEGRATION SECTION
              Contains: Notion tokens, database mappings, and manual sync action
              ────────────────────────────────────────────────────────── */}
          <section
            id="notion"
            data-entrance="card"
            className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-850">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                <Database className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
                Notion Integration
              </h2>
            </div>

            <form onSubmit={handleSaveNotionSettings} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Notion Connection Parameters
                </h3>

                {/* Notion API Token */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Notion Integration Token
                  </label>
                  <div className="relative">
                    <input
                      type={showNotionKey ? 'text' : 'password'}
                      value={notionSettings.NOTION_API_KEY || ''}
                      onChange={(e) => handleNotionFieldChange('NOTION_API_KEY', e.target.value)}
                      placeholder="secret_..."
                      className="w-full h-11 pl-4 pr-11 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white font-mono"
                    />
                    <Button variant="unstyled"
                      type="button"
                      onClick={() => setShowNotionKey(!showNotionKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-350 transition-colors"
                    >
                      {showNotionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <span className="text-[10px] text-slate-400 block leading-normal">
                    Create an internal integration in Notion and paste the secret token here.
                  </span>
                </div>

                {/* Tasks Database ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Tasks Database ID (Required)
                  </label>
                  <input
                    type="text"
                    value={notionSettings.NOTION_DATABASE_ID_TASKS || ''}
                    onChange={(e) => handleNotionFieldChange('NOTION_DATABASE_ID_TASKS', e.target.value)}
                    placeholder="e.g. 8f4b..."
                    className="w-full h-11 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-400 block leading-normal">
                    The Notion database containing task columns: Name, Priority, status, Estimated Time In Hours, Actual Time in hours, Project, Links.
                  </span>
                </div>

                {/* Projects Database ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Projects Database ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={notionSettings.NOTION_DATABASE_ID_PROJECTS || ''}
                    onChange={(e) => handleNotionFieldChange('NOTION_DATABASE_ID_PROJECTS', e.target.value)}
                    placeholder="e.g. 5d1c..."
                    className="w-full h-11 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-400 block leading-normal">
                    If configured, maps task project relations and imports project lists into the Zomzam CRM projects view.
                  </span>
                </div>

                {/* Links Database ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Links Database ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={notionSettings.NOTION_DATABASE_ID_LINKS || ''}
                    onChange={(e) => handleNotionFieldChange('NOTION_DATABASE_ID_LINKS', e.target.value)}
                    placeholder="e.g. 1a2b..."
                    className="w-full h-11 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-400 block leading-normal">
                    If configured, maps task bookmark links bidirectionally to/from Notion.
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                loading={isSavingNotion}
                className="w-full h-11"
              >
                Save Notion Settings
              </Button>
            </form>

            <div className="border-t border-slate-850 pt-5 mt-5 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Manual Synchronization
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Run the bidirectional synchronization engine to push local tasks/projects/links to Notion and pull new items from Notion.
              </p>
              <Button
                type="button"
                onClick={handleSyncNotion}
                loading={isSyncing}
                className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Notion Databases Now
              </Button>
            </div>
          </section>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: SECURITY CREDENTIALS SECTION
              Contains: Change password form inputs
              ────────────────────────────────────────────────────────── */}
          <section
            id="security"
            data-entrance="card"
            className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-850">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <Key className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
                {t('settings_security')}
              </h2>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-5">
              {/* Current Password */}
              <div data-entrance="list-item" className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('settings_curr_pass')}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full h-11 pl-4 pr-11 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white"
                  />
                  <Button variant="unstyled"
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* New Password */}
              <div data-entrance="list-item" className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('settings_new_pass')}
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full h-11 pl-4 pr-11 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white"
                  />
                  <Button variant="unstyled"
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div data-entrance="list-item" className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('settings_confirm_pass')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full h-11 pl-4 pr-11 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white"
                  />
                  <Button variant="unstyled"
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                variant="secondary"
                loading={isSavingPass}
                className="w-full h-11"
              >
                {t('settings_password_change')}
              </Button>
            </form>
          </section>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: DANGER ZONE
              Contains: Irreversible account deletion controls
              ────────────────────────────────────────────────────────── */}
          <section
            id="danger"
            data-entrance="card"
            className="bg-[#1A1D24] border border-red-900/40 rounded-3xl p-6 shadow-apple scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-red-900/30">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertOctagon className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-red-400 uppercase tracking-widest">Danger Zone</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Irreversible actions. Proceed with caution.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-red-950/20 border border-red-900/30 rounded-2xl">
              <div>
                <p className="text-sm font-bold text-white">Delete Account</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="danger"
                onClick={() => { setShowDeleteModal(true); setDeleteError(null); setDeletePassword(''); }}
              >
                Delete My Account
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* ── Account Deletion Confirmation Modal ── */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(null); }}
        variant="danger"
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Delete Account?</h3>
              <p className="text-xs text-slate-400">This action is permanent and irreversible.</p>
            </div>
          </div>
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(null); }}
              disabled={isDeletingAccount}
              className="flex-grow h-11"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || !deletePassword}
              loading={isDeletingAccount}
              className="flex-grow h-11"
            >
              Yes, Delete Forever
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          All your data — tasks, money records, ideas, plans, and social connections — will be permanently removed.
          Enter your current password to confirm.
        </p>

        {deleteError && <Alert variant="error" className="mb-4">{deleteError}</Alert>}

        <div className="mb-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showDeletePass ? 'text' : 'password'}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full h-11 pl-4 pr-11 bg-slate-900/30 border border-red-900/40 rounded-xl text-sm focus:outline-none focus:border-red-500 transition-all text-white"
              autoFocus
            />
            <Button variant="unstyled"
              type="button"
              onClick={() => setShowDeletePass(!showDeletePass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
            >
              {showDeletePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
