<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Global Settings - zomzam.com';
$pageDescription = 'Configure your account preferences and regional settings.';
$additionalJS = [
    '/Assets/Js/Time/state.js',
    '/Assets/Js/Time/api.js',
    '/Assets/Js/Time/utils.js',
    '/Assets/Js/settings.js'
];

// Fetch current user settings
$pdo = getConnection();
$stmt = $pdo->prepare("SELECT timezone, notifications_enabled FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$userSettings = $stmt->fetch(PDO::FETCH_ASSOC);

$currentTimezone = $userSettings['timezone'] ?? 'UTC';
$notificationsEnabled = (bool)($userSettings['notifications_enabled'] ?? false);

// Get common timezones
$timezones = DateTimeZone::listIdentifiers();

ob_start();
?>

<!-- Page Header -->
<div class="flex items-center gap-3 mb-6">
  <div class="w-9 h-9 rounded-xl bg-slate-500 flex items-center justify-center shadow-sm">
    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </div>
  <div>
    <h1 class="text-xl font-bold text-slate-900 dark:text-white">Global Settings</h1>
    <p class="text-xs text-slate-400">Personalize your zomzam.com experience and regional preferences.</p>
  </div>
</div>

<div class="max-w-3xl">
  <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-8 shadow-apple border border-slate-100 dark:border-slate-800">
    
    <div class="space-y-8">
      
      <!-- Timezone Section -->
      <section>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h2 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Regional Time</h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Time Location</label>
            <select id="setting-timezone" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all">
              <?php foreach ($timezones as $tz): ?>
                <option value="<?= $tz ?>" <?= $tz === $currentTimezone ? 'selected' : '' ?>><?= $tz ?></option>
              <?php endforeach; ?>
            </select>
            <p class="mt-2 text-[10px] text-slate-400">All your logs and tasks are stored in GMT/UTC, but will appear based on this location.</p>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-4 flex flex-col justify-center">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Display Time</span>
            <span id="settings-current-time" class="text-2xl font-black text-slate-900 dark:text-white tabular-nums">--:--:--</span>
            <span id="settings-gmt-offset" class="text-[10px] font-medium text-primary-500 mt-1">GMT +00:00</span>
          </div>
        </div>
      </section>

      <div class="border-t border-slate-100 dark:border-slate-800"></div>

      <!-- Notifications Section -->
      <section>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <h2 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Interface Notifications</h2>
        </div>
        
        <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Desktop Notifications</h3>
            <p class="text-[10px] text-slate-400">Receive alerts for Pomodoro sessions, new messages, and system announcements.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="setting-notifications" class="sr-only peer" <?= $notificationsEnabled ? 'checked' : '' ?>>
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
          </label>
        </div>
      </section>

      <!-- Action Footer -->
      <div class="pt-6 flex justify-end gap-3">
        <button id="btn-save-settings" class="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-500/20 transition-all active:scale-95 flex items-center gap-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Save Settings
        </button>
      </div>

    </div>
  </div>
</div>

<script>
  // Initial time display
  function updateSettingsClock() {
    const el = document.getElementById('settings-current-time');
    const offsetEl = document.getElementById('settings-gmt-offset');
    const tz = document.getElementById('setting-timezone').value;
    
    if (!el) return;

    const now = new Date();
    try {
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: false });
      el.textContent = timeStr;
      
      const parts = new Intl.DateTimeFormat('en-US', { 
        timeZone: tz, 
        timeZoneName: 'shortOffset' 
      }).formatToParts(now);
      
      const offset = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0';
      offsetEl.textContent = offset;
    } catch(e) {
      el.textContent = now.toLocaleTimeString();
    }
  }

  document.getElementById('setting-timezone').addEventListener('change', updateSettingsClock);
  setInterval(updateSettingsClock, 1000);
  updateSettingsClock();
</script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
