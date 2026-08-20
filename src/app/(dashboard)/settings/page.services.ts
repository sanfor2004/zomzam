// ──────────────────────────────────────────────────────────
// Settings — client-side data services.
//
// Wraps every /api/* call the settings page makes (preferences read/write,
// CRM + Notion settings read/write, Notion sync, password change, logout,
// account deletion) plus the pure live-clock formatter. No React — the page
// owns all form/UI state and toast/router orchestration.
// ──────────────────────────────────────────────────────────

export interface UserPrefs {
  timezone: string;
  primaryCurrency: string;
  secondaryCurrency: string;
  notificationsEnabled: boolean;
}

export interface PreferencesInput {
  timezone: string;
  notificationsEnabled: boolean;
  primaryCurrency: string;
  secondaryCurrency: string;
}

export interface NotionSyncStats {
  tasks: number;
  links: number;
}

type Settings = Record<string, string>;

// ── Preferences ──────────────────────────────────────────────

// Normalized user preferences, or null when the viewer isn't authenticated.
// Throws on network error (the page logs + stops the loader, matching the
// original behavior — no redirect on transient failure).
export async function fetchUserPrefs(): Promise<UserPrefs | null> {
  const res = await fetch('/api/auth?action=check');
  const data = await res.json();
  if (!(data.success && data.authenticated && data.user)) return null;
  const u = data.user;
  return {
    timezone: u.timezone || 'UTC',
    primaryCurrency: u.primary_currency || 'EGP',
    secondaryCurrency: u.secondary_currency || 'USD',
    notificationsEnabled: !!u.notifications_enabled,
  };
}

export async function savePreferences(input: PreferencesInput): Promise<{ success: boolean; message?: string }> {
  const res = await fetch('/api/auth?action=update_settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timezone: input.timezone,
      notifications_enabled: input.notificationsEnabled,
      primary_currency: input.primaryCurrency,
      secondary_currency: input.secondaryCurrency,
    }),
  });
  const data = await res.json();
  return { success: !!data.success, message: data.message };
}


// ── Notion settings + sync ───────────────────────────────────

export async function fetchNotionSettings(): Promise<Settings | null> {
  const res = await fetch('/api/notion');
  const data = await res.json();
  return data.success && data.settings ? data.settings : null;
}

export async function saveNotionSettings(settings: Settings): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/notion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_settings', settings }),
  });
  const data = await res.json();
  return { success: !!data.success, error: data.error };
}

export async function syncNotion(): Promise<{ success: boolean; stats?: NotionSyncStats; error?: string }> {
  const res = await fetch('/api/notion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync' }),
  });
  const data = await res.json();
  return { success: !!data.success, stats: data.stats, error: data.error };
}

// ── Security: password + account ─────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch('/api/profile/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const data = await res.json();
  return { success: !!data.success, message: data.message };
}

// Best-effort session teardown after a credential change. Never throws — the
// caller redirects to /sign regardless, since the password is already changed.
export async function logout(): Promise<void> {
  await fetch('/api/auth?action=logout', { method: 'POST' }).catch((err) =>
    console.error('Logout after password change failed:', err),
  );
}

export async function deleteAccount(password: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch('/api/profile', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  return { success: !!data.success, message: data.message };
}

// ── Pure derivation ──────────────────────────────────────────

// Formats "Mon 03:24:01 PM · Jun 29, 2026" in the given IANA timezone. Returns
// '' on an invalid timezone (toLocale* throws a RangeError) — the page hides
// the clock chip when empty. `now` is injectable for testing.
export function formatLiveClock(timezone: string, now: Date = new Date()): string {
  try {
    const time = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      weekday: 'short',
    });
    const date = now.toLocaleDateString('en-US', {
      timeZone: timezone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${time} · ${date}`;
  } catch {
    return '';
  }
}
