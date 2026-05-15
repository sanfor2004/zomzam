<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Community - zomzam.com';
$pageDescription = 'Connect with other users and share your productivity journey.';

ob_start();
?>

<div class="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <div class="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-3xl flex items-center justify-center text-primary-500 mb-6 shadow-xl shadow-primary-500/10">
        <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
    </div>
    
    <h1 class="text-3xl font-black text-slate-900 dark:text-white mb-4">
        <zlang key="community_coming_soon">Community Coming Soon</zlang>
    </h1>
    
    <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
        We are building a space for you to connect, share ideas, and grow together. Stay tuned for the official launch!
    </p>

    <div class="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <div class="p-6 bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 mb-4">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-2 text-sm">Discussions</h3>
            <p class="text-xs text-slate-400">Join focused conversations on productivity and tech.</p>
        </div>
        
        <div class="p-6 bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 mb-4">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-2 text-sm">Study Groups</h3>
            <p class="text-xs text-slate-400">Find partners to keep you accountable and focused.</p>
        </div>
        
        <div class="p-6 bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 mb-4">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-2 text-sm">Resources</h3>
            <p class="text-xs text-slate-400">Access exclusive templates and guides for your journey.</p>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
