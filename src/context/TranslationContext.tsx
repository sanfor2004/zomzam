'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { LANGUAGES, isSupportedLanguage, RTL_LANGUAGES } from '@/lib/i18n/languages';

// English is the default language and the universal fallback, so it stays inline
// (always bundled). Every other language lives in `@/lib/i18n/extra` and is
// dynamically imported the first time it's selected (or restored from
// localStorage) — keeping ~6 dictionaries out of the initial client bundle for
// the common English-only path. While a non-English dictionary is loading, `t()`
// transparently falls back to English.
const EN_TRANSLATIONS: Record<string, string> = {
  company_name: 'zomzam',
  tagline: 'Software Developer />',
  stat_team: 'Team Members',
  stat_partners: 'Partners',
  stat_requests: 'Request Handled',
  description: 'Building innovative software solutions with cutting-edge technology. We transform ideas into powerful digital experiences that drive success and deliver exceptional results for businesses worldwide.',
  email: 'info@zomzam.com',
  phone: '+1 (234) 567-890',
  lang_name: 'English',
  nav_home: 'Home',
  nav_features: 'Features',
  nav_about: 'About',
  nav_signin: 'Sign In',
  nav_get_started: 'Get Started',
  nav_dashboard: 'Dashboard',
  nav_profile: 'Profile',
  nav_security: 'Security',
  nav_logout: 'Logout',
  nav_overview: 'Overview',
  nav_search: 'Search...',
  auth_back: 'Back',
  auth_signin: 'Sign In',
  auth_signup: 'Create Account',
  auth_signin_desc: 'Welcome back! Please enter your details.',
  auth_signup_desc: 'Join us today. Please fill in your details.',
  auth_email: 'Email Address',
  auth_password: 'Password',
  auth_forgot: 'Forgot password?',
  auth_fullname: 'Username',
  auth_pass_rule: 'Must be at least 8 characters long.',
  auth_terms: 'By signing up, you agree to our Terms of Service and Privacy Policy.',
  nav_time: 'Time Management',
  nav_money: 'Money Management',
  nav_crm: 'CRM Suite',
  nav_community: 'Community',
  btn_add_task: 'Add Task',
  task_urgent: 'Urgent',
  task_medium: 'Medium',
  task_maybe: 'Maybe',
  task_free: 'Free',
  task_completed: 'Completed',
  task_board: 'Task Board',
  task_active: 'Active Tasks',
  task_placeholder: 'What needs to be done?',
  task_priority: 'Priority',
  task_duration: 'Time Block',
  nav_settings: 'Global Settings',
  community_coming_soon: 'Community Coming Soon',
  settings_title: 'Global Settings',
  settings_desc: 'Manage your workspace settings, notifications, language, and security preferences.',
  settings_pref: 'Preferences',
  settings_security: 'Security',
  settings_timezone: 'Timezone',
  settings_notifications: 'Email Notifications',
  settings_notif_desc: 'Receive alerts about system updates and social interactions.',
  settings_primary_curr: 'Primary Currency',
  settings_secondary_curr: 'Secondary Currency',
  settings_lang: 'System Language',
  settings_save: 'Save Settings',
  settings_password_change: 'Change Password',
  settings_curr_pass: 'Current Password',
  settings_new_pass: 'New Password',
  settings_confirm_pass: 'Confirm Password',
  settings_save_success: 'Settings updated successfully!',
  settings_pass_success: 'Password updated successfully!',
  profile_title: 'My Profile',
  profile_desc: 'Customize your public identity, bio, and interest tags.',
  profile_first_name: 'First Name',
  profile_last_name: 'Last Name',
  profile_bio: 'Biography',
  profile_tags: 'Interests Tags',
  profile_tags_desc: 'Add up to 10 tags to help others discover you on the community board.',
  profile_avatar_change: 'Upload Photo',
  profile_avatar_remove: 'Remove Photo',
  profile_save: 'Save Profile',
  profile_success: 'Profile updated successfully!',
};

// Re-exported so consumers (e.g. the settings language picker) can import the
// language list from here without pulling in the lazy dictionaries.
export { LANGUAGES };

interface TranslationContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('en');
  const [dicts, setDicts] = useState<Record<string, Record<string, string>>>({ en: EN_TRANSLATIONS });

  // Restore the saved language; lazily load its dictionary when it isn't English.
  useEffect(() => {
    const stored = localStorage.getItem('preferredLanguage');
    if (!isSupportedLanguage(stored) || stored === 'en') return;
    let cancelled = false;
    import('@/lib/i18n/extra').then((mod) => {
      if (cancelled) return;
      setDicts((prev) => ({ ...prev, ...mod.EXTRA_TRANSLATIONS }));
      setLanguageState(stored as string);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (lang: string) => {
    if (!isSupportedLanguage(lang)) return;
    if (lang !== 'en') {
      const mod = await import('@/lib/i18n/extra');
      setDicts((prev) => (prev[lang] ? prev : { ...prev, ...mod.EXTRA_TRANSLATIONS }));
    }
    setLanguageState(lang);
    localStorage.setItem('preferredLanguage', lang);
  }, []);

  useEffect(() => {
    // Handle HTML RTL / LTR document settings
    const isRtl = RTL_LANGUAGES.includes(language);
    document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const t = useCallback(
    (key: string): string => dicts[language]?.[key] || dicts.en?.[key] || key,
    [dicts, language],
  );

  const value = useMemo<TranslationContextType>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
