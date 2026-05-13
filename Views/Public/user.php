<?php
require_once __DIR__ . '/../../config.php';

$username = $_GET['username'] ?? '';
$userModel = new User();
$publicUser = $userModel->getUserByUsername($username);

if (!$publicUser) {
    header("Location: /404");
    exit;
}

// Check if viewer is the owner
session_start();
$isOwner = isset($_SESSION['user_id']) && $_SESSION['user_id'] == $publicUser['id'];

$pageTitle = htmlspecialchars($publicUser['username']) . ' (@' . htmlspecialchars($publicUser['username']) . ')';
$pageDescription = "View " . htmlspecialchars($publicUser['username']) . "'s public profile on zomzam.com.";

// Check public user online status
$isPublicUserOnline = false;
$offlineDuration = "";
$lastSeenRaw = null;
try {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT last_seen FROM user_online_status WHERE user_id = ?");
    $stmt->execute([$publicUser['id']]);
    $lastSeenRaw = $stmt->fetchColumn();
    if ($lastSeenRaw) {
        $diff = time() - strtotime($lastSeenRaw);
        $isPublicUserOnline = $diff < 5; // 5 seconds threshold
        
        if (!$isPublicUserOnline) {
            if ($diff < 60) $offlineDuration = $diff . "s ago";
            elseif ($diff < 3600) $offlineDuration = floor($diff / 60) . "m ago";
            elseif ($diff < 86400) $offlineDuration = floor($diff / 3600) . "h ago";
            else $offlineDuration = floor($diff / 86400) . "d ago";
        }
    }
} catch (Exception $e) {
    $isPublicUserOnline = false;
}

ob_start();
?>

<div class="max-w-4xl mx-auto py-8 px-4">
    <!-- Profile Header Card -->
    <div class="bg-white dark:bg-[#1a1d24] rounded-[2rem] p-8 shadow-apple border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
        <!-- Background Accent -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all group-hover:bg-primary-500/10"></div>
        
        <div class="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <!-- Avatar Section -->
            <div class="relative">
                <div class="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-primary-500 to-primary-600 p-1 shadow-lg transform transition-transform group-hover:scale-105">
                    <div class="w-full h-full rounded-[2.3rem] bg-white dark:bg-[#1a1d24] flex items-center justify-center overflow-hidden border-4 border-white dark:border-[#1a1d24]">
                        <?php if (!empty($publicUser['avatar'])): ?>
                            <img src="<?php echo htmlspecialchars($publicUser['avatar']); ?>" alt="Avatar" class="w-full h-full object-cover">
                        <?php else: ?>
                            <span class="text-4xl font-black text-primary-500"><?php echo strtoupper(substr($publicUser['username'], 0, 1)); ?></span>
                        <?php endif; ?>
                    </div>
                </div>
                <!-- Status Badge -->
                <div class="absolute -bottom-1 -right-1 flex items-center gap-2">
                    <?php if (!$isPublicUserOnline && $offlineDuration): ?>
                        <span id="viewed-user-offline-badge" class="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 shadow-sm whitespace-nowrap">
                            <?php echo strtoupper($offlineDuration); ?>
                        </span>
                    <?php else: ?>
                        <span id="viewed-user-offline-badge" class="hidden px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 shadow-sm whitespace-nowrap"></span>
                    <?php endif; ?>
                    <div id="viewed-user-online-indicator" class="w-8 h-8 <?php echo $isPublicUserOnline ? 'bg-emerald-500' : 'bg-slate-400'; ?> rounded-2xl border-4 border-white dark:border-[#1a1d24] flex items-center justify-center shadow-sm transition-colors duration-500">
                        <div id="viewed-user-online-pulse" class="w-2 h-2 bg-white rounded-full <?php echo $isPublicUserOnline ? 'animate-pulse' : 'opacity-50'; ?>"></div>
                    </div>
                </div>
            </div>

            <!-- Info Section -->
            <div class="flex-1 text-center md:text-left">
                <div class="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                    <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        <?php echo htmlspecialchars($publicUser['first_name'] . ' ' . $publicUser['last_name']); ?>
                    </h1>
                    <span class="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
                        @<?php echo htmlspecialchars($publicUser['username']); ?>
                    </span>
                </div>
                
                <p class="text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed mb-6">
                    <?php echo !empty($publicUser['bio']) ? nl2br(htmlspecialchars($publicUser['bio'])) : 'This user prefers to keep their bio a mystery for now. 🚀'; ?>
                </p>

                <div class="flex flex-wrap justify-center md:justify-start gap-4">
                    <div class="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <svg class="w-4 h-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Member since <?php echo date('M Y', strtotime($publicUser['created_at'])); ?></span>
                    </div>
                    <?php if ($isOwner): ?>
                        <a href="/me" class="flex items-center gap-2 px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl shadow-lg shadow-primary-500/20 transition-all hover:scale-105 active:scale-95 font-bold text-xs uppercase tracking-widest">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit My Profile
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <!-- Additional Public Sections (Optional) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div class="md:col-span-1 bg-white dark:bg-[#1a1d24] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Activity</h3>
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full <?php echo $isPublicUserOnline ? 'bg-emerald-500' : 'bg-slate-400'; ?>"></div>
                    <span id="viewed-user-online-label" class="text-sm text-slate-600 dark:text-slate-300">
                        <?php echo $isPublicUserOnline ? 'Currently Online' : 'Offline (' . $offlineDuration . ')'; ?>
                    </span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full bg-primary-500"></div>
                    <span class="text-sm text-slate-600 dark:text-slate-300">Focus master badge</span>
                </div>
            </div>
        </div>
        
        <div class="md:col-span-2 bg-gradient-to-br from-primary-500/5 to-amber-500/5 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center text-center">
            <div class="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm mb-4">
                <svg class="w-8 h-8 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect & Grow</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">Want to see more? Follow @<?php echo htmlspecialchars($publicUser['username']); ?> to track progress together.</p>
            <button class="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl">Follow User</button>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
// Use public layout if viewing anonymously, or app layout if logged in
if (isset($_SESSION['user_id'])) {
    require_once __DIR__ . '/../app_layout.php';
} else {
    require_once __DIR__ . '/../public_layout.php';
}
?>

<script>
    // Set context for the Stream Waiter
    document.body.dataset.viewingUserId = '<?php echo $publicUser['id']; ?>';
</script>
