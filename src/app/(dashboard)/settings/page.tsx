'use client';

import React, { useRef, useState, useEffect } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useRouter } from 'next/navigation';
import { useTranslation, LANGUAGES } from '@/context/TranslationContext';
import { Globe, Shield, Eye, EyeOff, Loader2, Clock, Trash2, AlertOctagon, Briefcase, Database, RefreshCw } from 'lucide-react';
import { Button, Switch, Modal, Select, NumberInput, Alert, Input, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  fetchUserPrefs, savePreferences, fetchCrmSettings, saveCrmSettings,
  fetchNotionSettings, saveNotionSettings, syncNotion,
  changePassword, logout, deleteAccount, formatLiveClock,
} from './page.services';

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

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: SETTINGS LAYOUT PRIMITIVES (LOCAL)
    Contains: SettingsGroup (iOS inset-grouped card + gray header),
              SettingRow (label-left / control-right cell),
              Field (labelled text field over the Kit Input),
              PwToggle (show/hide secret button)
    ──────────────────────────────────────────────────────────
    Apple "grouped list" scaffolding, local to this page. Hierarchy is
    carried by spacing + weight, not colour: the group header is a calm
    gray label ABOVE an inset card, and rows are separated by hairlines
    (never per-field boxes). If a second surface needs this rhythm,
    promote these into the Zomzam Kit per the Section 2.0 rule-of-three. */

function SettingsGroup({
  id, icon, title, danger = false, padded = false, footer, children,
}: {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  danger?: boolean;
  padded?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-entrance="card" className="scroll-mt-6">
      <div className="flex items-center gap-2 px-1 mb-2.5">
        {icon && (
          <span className={cn('[&>svg]:w-4 [&>svg]:h-4', danger ? 'text-red-500' : 'text-slate-500')}>
            {icon}
          </span>
        )}
        <h2 className={cn('text-[13px] font-semibold tracking-tight', danger ? 'text-red-400' : 'text-slate-400')}>
          {title}
        </h2>
      </div>

      <div
        className={cn(
          // No overflow-hidden: it would clip the Select dropdown popover
          // (absolutely-positioned inside a row). Rows are transparent, so the
          // card's rounded corners need no clipping anyway.
          'surface-card rounded-2xl',
          danger && 'border-red-900/40',
          padded ? 'p-4 sm:p-5 space-y-5' : 'divide-y divide-slate-800/60',
        )}
      >
        {children}
      </div>

      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}

function SettingRow({
  label, sub, children,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div data-entrance="list-item" className="flex items-center justify-between gap-4 px-4 py-3 min-h-[54px]">
      <div className="min-w-0">
        <div className="text-[15px] text-slate-100">{label}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Field({
  id, label, hint, mono = false, className = '', ...inputProps
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  mono?: boolean;
} & React.ComponentProps<typeof Input>) {
  return (
    <div data-entrance="list-item" className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-300">{label}</label>
      <Input id={id} className={cn(mono && 'font-mono', className)} {...inputProps} />
      {hint && <p className="text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

function PwToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Hide value' : 'Show value'}
      className="text-slate-400 hover:text-slate-200 transition-colors"
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

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
    (async () => {
      try {
        const prefs = await fetchUserPrefs();
        if (prefs) {
          setTimezone(prefs.timezone);
          setPrimaryCurrency(prefs.primaryCurrency);
          setSecondaryCurrency(prefs.secondaryCurrency);
          setNotificationsEnabled(prefs.notificationsEnabled);
        }
      } catch (err) {
        console.error('Failed to load user settings:', err);
      } finally {
        setIsPageLoading(false);
      }
    })();
  }, []);

  // Fetch CRM Settings
  useEffect(() => {
    (async () => {
      try {
        const settings = await fetchCrmSettings();
        if (settings) setCrmSettings(prev => ({ ...prev, ...settings }));
      } catch (err) {
        console.error("Failed to load CRM settings:", err);
      }
    })();
  }, []);

  // Fetch Notion Settings
  useEffect(() => {
    (async () => {
      try {
        const settings = await fetchNotionSettings();
        if (settings) setNotionSettings(prev => ({ ...prev, ...settings }));
      } catch (err) {
        console.error("Failed to load Notion settings:", err);
      }
    })();
  }, []);

  const handleSaveNotionSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotion(true);

    try {
      const { success, error } = await saveNotionSettings(notionSettings);
      if (success) {
        toast({ variant: 'success', description: 'Notion settings updated successfully!' });
      } else {
        toast({ variant: 'error', description: error || 'Failed to save Notion settings' });
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
      const { success, stats, error } = await syncNotion();
      if (success && stats) {
        toast({
          variant: 'success',
          title: 'Notion sync complete',
          description: `Synced ${stats.tasks} tasks, ${stats.projects} projects, ${stats.links} links.`,
        });
      } else {
        toast({ variant: 'error', description: error || 'Failed to synchronize with Notion' });
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
      const { success, error } = await saveCrmSettings(crmSettings);
      if (success) {
        toast({ variant: 'success', description: 'CRM settings updated successfully!' });
      } else {
        toast({ variant: 'error', description: error || 'Failed to save CRM settings' });
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
    const updateClock = () => setLiveClock(formatLiveClock(timezone));
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  // Handle saving general preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPref(true);

    try {
      const { success, message } = await savePreferences({
        timezone,
        notificationsEnabled,
        primaryCurrency,
        secondaryCurrency,
      });
      if (success) {
        toast({ variant: 'success', description: t('settings_save_success') });
        // Trigger page refresh to propagate header/context updates
        router.refresh();
      } else {
        toast({ variant: 'error', description: message || 'Failed to save settings' });
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
      const { success, message } = await changePassword(currentPassword, newPassword);
      if (success) {
        toast({ variant: 'success', description: 'Password changed — signing you out…' });
        // Tear down the current session, then bounce to sign-in. Keep the
        // form disabled (isSavingPass stays true) through the redirect. Logout
        // is best-effort — even if it fails we still redirect, since the
        // password is already changed.
        await logout();
        router.push('/sign');
        router.refresh();
      } else {
        toast({ variant: 'error', description: message || 'Failed to update password' });
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
      const { success, message } = await deleteAccount(deletePassword);
      if (success) {
        // Redirect to sign-in after deletion
        router.push('/sign');
        router.refresh();
      } else {
        setDeleteError(message || 'Failed to delete account.');
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
    <div ref={containerRef} className="max-w-2xl mx-auto pb-20">
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: LARGE-TITLE HEADER
          Contains: page title, one-line description
          ────────────────────────────────────────────────────────── */}
      <header className="mb-8">
        <h1 data-entrance="title" className="text-[28px] sm:text-4xl font-bold tracking-tight text-white leading-tight">
          {t('settings_title')}
        </h1>
        <p className="text-sm text-slate-400 mt-1.5">
          {t('settings_desc')}
        </p>
      </header>

      <div className="space-y-10">
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: GENERAL PREFERENCES SECTION
            Contains: Language, Timezone (+ live clock), Currencies, Notifications
            ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSavePreferences}>
          <SettingsGroup
            id="preferences"
            icon={<Globe />}
            title={t('settings_pref')}
            footer={
              <Button type="submit" loading={isSavingPref} className="w-full h-12 rounded-xl">
                {t('settings_save')}
              </Button>
            }
          >
            <SettingRow label={t('settings_lang')}>
              <div className="w-40 sm:w-52">
                <Select
                  value={language}
                  onChange={(val) => setLanguage(val)}
                  options={LANGUAGES.map((lang) => ({ value: lang.code, label: lang.name }))}
                />
              </div>
            </SettingRow>

            <SettingRow
              label={t('settings_timezone')}
              sub={liveClock ? (
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="w-3 h-3 text-primary-500" />
                  {liveClock}
                </span>
              ) : undefined}
            >
              <div className="w-40 sm:w-52">
                <Select
                  value={timezone}
                  onChange={(val) => setTimezone(val)}
                  options={COMMON_TIMEZONES}
                />
              </div>
            </SettingRow>

            <SettingRow label={t('settings_primary_curr')}>
              <div className="w-28">
                <Select
                  value={primaryCurrency}
                  onChange={(val) => setPrimaryCurrency(val)}
                  options={CURRENCIES}
                />
              </div>
            </SettingRow>

            <SettingRow label={t('settings_secondary_curr')}>
              <div className="w-28">
                <Select
                  value={secondaryCurrency}
                  onChange={(val) => setSecondaryCurrency(val)}
                  options={CURRENCIES}
                />
              </div>
            </SettingRow>

            <SettingRow label={t('settings_notifications')} sub={t('settings_notif_desc')}>
              <Switch
                checked={notificationsEnabled}
                onChange={setNotificationsEnabled}
                ariaLabel="Toggle notifications"
              />
            </SettingRow>
          </SettingsGroup>
        </form>

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
          className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple scroll-mt-6"
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
            Contains: Notion token, database mappings, and manual sync action
            ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSaveNotionSettings}>
          <SettingsGroup
            id="notion"
            icon={<Database />}
            title="Notion integration"
            padded
            footer={
              <div className="space-y-4">
                <Button type="submit" loading={isSavingNotion} className="w-full h-12 rounded-xl">
                  Save Notion settings
                </Button>

                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Run the bidirectional sync engine to push local tasks, projects, and links to Notion and pull new items back.
                  </p>
                  <Button
                    type="button"
                    onClick={handleSyncNotion}
                    loading={isSyncing}
                    variant="secondary"
                    className="w-full h-11 rounded-xl"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Notion now
                  </Button>
                </div>
              </div>
            }
          >
            <Field
              id="notion-token"
              label="Integration token"
              mono
              type={showNotionKey ? 'text' : 'password'}
              value={notionSettings.NOTION_API_KEY || ''}
              onChange={(e) => handleNotionFieldChange('NOTION_API_KEY', e.target.value)}
              placeholder="secret_..."
              rightIcon={<PwToggle show={showNotionKey} onToggle={() => setShowNotionKey(!showNotionKey)} />}
              hint="Create an internal integration in Notion and paste its secret token here."
            />

            <Field
              id="notion-tasks"
              label="Tasks database ID (required)"
              mono
              type="text"
              value={notionSettings.NOTION_DATABASE_ID_TASKS || ''}
              onChange={(e) => handleNotionFieldChange('NOTION_DATABASE_ID_TASKS', e.target.value)}
              placeholder="e.g. 8f4b…"
              hint="The database with task columns: Name, Priority, status, Estimated/Actual hours, Project, Links."
            />

            <Field
              id="notion-projects"
              label="Projects database ID (optional)"
              mono
              type="text"
              value={notionSettings.NOTION_DATABASE_ID_PROJECTS || ''}
              onChange={(e) => handleNotionFieldChange('NOTION_DATABASE_ID_PROJECTS', e.target.value)}
              placeholder="e.g. 5d1c…"
              hint="If set, maps task project relations and imports project lists into the Zomzam projects view."
            />

            <Field
              id="notion-links"
              label="Links database ID (optional)"
              mono
              type="text"
              value={notionSettings.NOTION_DATABASE_ID_LINKS || ''}
              onChange={(e) => handleNotionFieldChange('NOTION_DATABASE_ID_LINKS', e.target.value)}
              placeholder="e.g. 1a2b…"
              hint="If set, maps task bookmark links bidirectionally to and from Notion."
            />
          </SettingsGroup>
        </form>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: SECURITY CREDENTIALS SECTION
            Contains: Change password form inputs
            ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSavePassword}>
          <SettingsGroup
            id="security"
            icon={<Shield />}
            title={t('settings_security')}
            padded
            footer={
              <Button type="submit" variant="secondary" loading={isSavingPass} className="w-full h-12 rounded-xl">
                {t('settings_password_change')}
              </Button>
            }
          >
            <Field
              id="current-pass"
              label={t('settings_curr_pass')}
              required
              type={showCurrentPass ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              rightIcon={<PwToggle show={showCurrentPass} onToggle={() => setShowCurrentPass(!showCurrentPass)} />}
            />

            <Field
              id="new-pass"
              label={t('settings_new_pass')}
              required
              hint="At least 8 characters."
              type={showNewPass ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              rightIcon={<PwToggle show={showNewPass} onToggle={() => setShowNewPass(!showNewPass)} />}
            />

            <Field
              id="confirm-pass"
              label={t('settings_confirm_pass')}
              required
              type={showConfirmPass ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              rightIcon={<PwToggle show={showConfirmPass} onToggle={() => setShowConfirmPass(!showConfirmPass)} />}
            />
          </SettingsGroup>
        </form>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: DANGER ZONE
            Contains: Irreversible account deletion controls
            ────────────────────────────────────────────────────────── */}
        <SettingsGroup id="danger" icon={<AlertOctagon />} title="Danger zone" danger>
          <div
            data-entrance="list-item"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-4"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-white">Delete account</p>
              <p className="text-xs text-slate-500 mt-0.5 max-w-sm leading-relaxed">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => { setShowDeleteModal(true); setDeleteError(null); setDeletePassword(''); }}
              className="shrink-0 whitespace-nowrap"
            >
              Delete account
            </Button>
          </div>
        </SettingsGroup>
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

        <Field
          id="delete-pass"
          label="Confirm password"
          type={showDeletePass ? 'text' : 'password'}
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder="Enter your current password"
          autoFocus
          className="border-red-900/40 focus:border-red-500"
          rightIcon={<PwToggle show={showDeletePass} onToggle={() => setShowDeletePass(!showDeletePass)} />}
        />
      </Modal>
    </div>
  );
}
