<?php
/**
 * Dashboard Home/Landing Page
 * 
 * Main landing page after successful login
 */

require_once __DIR__ . '/../../config.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

$pageTitle = 'Dashboard - zomzam.com';
$pageDescription = 'Welcome to your dashboard';

ob_start();
?>

<div class="space-y-6">
  <!-- Welcome Banner -->
  <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 to-primary-600 p-8 sm:p-10 text-white shadow-apple border border-primary-400/20">
    <!-- Decorative background elements -->
    <div class="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
    <div class="absolute bottom-0 right-1/4 mb-[-2rem] w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
    
    <div class="relative z-10">
      <h2 class="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Welcome back, <?php echo htmlspecialchars($_SESSION['username'] ?? 'User'); ?>!</h2>
      <p class="text-primary-50 text-lg max-w-xl">Take control of your time and data. Let's make today productive.</p>
    </div>
  </div>

  <!-- Main Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    
    <!-- Profile Quick View -->
    <div class="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800 transition-shadow hover:shadow-lg">
      <div class="flex flex-col items-center text-center">
        <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-3xl font-bold shadow-sm mb-4 overflow-hidden border border-primary-500/20">
          <?php if (!empty($_SESSION['user_avatar'])): ?>
            <img src="<?php echo htmlspecialchars($_SESSION['user_avatar']); ?>?t=<?php echo time(); ?>" alt="Profile" class="w-full h-full object-cover">
          <?php else: ?>
            <?php echo strtoupper(substr($_SESSION['username'] ?? 'U', 0, 1)); ?>
          <?php endif; ?>
        </div>
        <h3 class="font-semibold text-lg text-slate-900 dark:text-white"><?php echo htmlspecialchars($_SESSION['username'] ?? 'User'); ?></h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6"><?php echo htmlspecialchars($_SESSION['email'] ?? ''); ?></p>
        <a href="/profile" class="w-full py-2.5 px-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-medium rounded-xl transition-colors border border-slate-200 dark:border-slate-700">
          View Profile
        </a>
      </div>
    </div>

    <!-- Account Status -->
    <div class="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <h3 class="font-semibold text-lg text-slate-900 dark:text-white mb-5">Account Status</h3>
      <div class="space-y-4">
        <div class="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/50">
          <span class="text-slate-500 dark:text-slate-400 text-sm">Status</span>
          <span class="px-3 py-1 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-semibold">Active</span>
        </div>
        <div class="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/50">
          <span class="text-slate-500 dark:text-slate-400 text-sm">Role</span>
          <span class="px-3 py-1 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-full text-xs font-semibold capitalize">
            <?php echo htmlspecialchars($_SESSION['role'] ?? 'user'); ?>
          </span>
        </div>
        <div class="flex justify-between items-center py-2">
          <span class="text-slate-500 dark:text-slate-400 text-sm">Member Since</span>
          <span class="text-slate-900 dark:text-white text-sm font-medium"><?php echo date('M Y'); ?></span>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <h3 class="font-semibold text-lg text-slate-900 dark:text-white mb-5">Quick Actions</h3>
      <div class="space-y-3">
        <a href="/profile" class="group flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
          <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center group-hover:scale-105 transition-transform">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div>
            <p class="font-medium text-sm text-slate-900 dark:text-white">Edit Profile</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">Update your information</p>
          </div>
        </a>
        
        <a href="/change-password" class="group flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
          <div class="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center group-hover:scale-105 transition-transform">
            <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div>
            <p class="font-medium text-sm text-slate-900 dark:text-white">Security</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">Change your password</p>
          </div>
        </a>
      </div>
    </div>
    
  </div>

  <!-- Recent Activity -->
  <div class="bg-white dark:bg-surface-dark rounded-3xl p-6 sm:p-8 shadow-apple border border-slate-100 dark:border-slate-800">
    <div class="flex items-center justify-between mb-6">
      <h3 class="font-semibold text-lg text-slate-900 dark:text-white">Recent Activity</h3>
      <button class="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">View All</button>
    </div>
    
    <div class="space-y-4">
      <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50">
        <div class="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
          <svg class="w-5 h-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div>
          <p class="font-medium text-sm text-slate-900 dark:text-white">Logged in successfully</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Just now &bull; from IP <?php echo $_SERVER['REMOTE_ADDR'] ?? 'Unknown'; ?></p>
        </div>
      </div>
    </div>
  </div>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
